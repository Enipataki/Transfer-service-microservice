import {Request, Response, NextFunction} from "express";
import {redis} from "../services/redis-service";
import {logger} from "../services/logger-service"
import crypto from 'crypto'

/**
 * Idempotency Middleware
 * Features:
 * Atomic Redis operation (no race conditions)
 * Request fingerprinting (same key + different request = new request)
 * Automatic cleanup on errors
 * HTTP header support
 * Concurrent request handling (409 conflict)
 */


export class IdempotencyMiddleware {
    private static readonly IDEMPOTENCY_HEADER = 'Idempotency-Key';
    private static readonly TTL_SECONDS = 24 * 60 * 60;//24 hours
    private static readonly LOCK_TIMEOUT = 30; //30 seconds for processing lock

    /**
     * Generate a fingerprint for the request
     * Same key + different fingerprint = different request
     */

    private static generateRequestFingerprint(
        method: string,
        path: string,
        body: any
    ): string {
        //Normalize the request for consistent hashing
        const normalized = {
            method: method.toUpperCase(),
            path: path,
            body: this.normalizedBody(body),
            timestamp: Math.floor(Date.now() / 1000)// second precision
        };
        const content = JSON.stringify(normalized);
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Normalize request body for consistent hashing
     */
    private static normalizedBody(body: any): any {
        if (!body || typeof body !== 'object') return body;

        //sort object keys for consistent ordering
        const sorted: any = {};
        Object.keys(body).sort().forEach(key => {
            sorted[key] = body[key];
        });
        return sorted;
    }

    /**
     * Atomic lock axquisition using redis NX flag
     */
    private static async acquireLock(idempotencyKey: string): Promise<boolean> {
        const lockKey = `idempotency:lock:${idempotencyKey}`;

        try {
            //Atomic SET with NX (not exists) and EX (expire in seconds)
            const result = await redis.setWithOptions(lockKey, 'processing', 'NX', this.LOCK_TIMEOUT, 'EX');
            //Returns 'OK' if lock acquired, null if already exists

            return result === 'OK';
        } catch (error) {
            logger.error('Failed to acquire idempotency lock', {
                idempotencyKey,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;

        }
    }

    /**
     * get cached response if exists
     */
    private static async getCachedResponse(idempotencyKey: string): Promise<{statusCode: number; body: any; headers: Record<string, string>} | null> {
        try {
            const data = await redis.get(`idempotency:response:${idempotencyKey}`);
            return data as any;
        } catch (error) {
            logger.warn('Failed to get cached response', { idempotencyKey });
            return null;
        }
    }

    /**
     * store successful response
     */
    private static async storeResponse(idempotencyKey: string, fingerprint: string, statusCode: number, body: any, headers: Record<string, string>): Promise<void> {
        try {
            const responseData = {
                statusCode,
                body,
                headers: {
                    ...headers,
                    'X-idempotency-Replayed': 'true'
                },
                storedAt: new Date().toISOString()
            };
            //store response with TTl
            await redis.set(`idempotency:response:${idempotencyKey}`, responseData, this.TTL_SECONDS);
            //store fingerprint to detect different requests wuth same key
            await redis.set(`idempotency:fingerprint:${idempotencyKey}`, fingerprint, this.TTL_SECONDS);
            //Convert lock to completed state with full TTL
            await redis.set(`idempotency:lock:${idempotencyKey}`, 'completed', this.TTL_SECONDS);
            logger.debug('Stored idempotent response', { idempotencyKey })
        } catch (error) {
            logger.error('Failed to store idempotency response', {
                idempotencyKey,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Clear idempotency data (for errors or different requests)
     */
    private static async clearKey(idempotencyKey: string): Promise<void> {
        try {
            await redis.delMultiple([
                `idempotency:response:${idempotencyKey}`,
                `idempotency:lock:${idempotencyKey}`,
                `idempotency:fingerprint:${idempotencyKey}`
            ]);
        } catch (error) {
            logger.error('Failed to clear idempotency key', { idempotencyKey });
        }
    }

    /**
     * Validate idempotency key format
     */
    private static isValidKey(key: string): boolean {
        //Alphanumeric, dashes, underscores, 1-255 chars
        return /^[a-zA-Z0-9\-_]{1,255}$/.test(key);
    }

    /**
     * Main middleware handler
     */
    static async handle(req:Request, res: Response, next: NextFunction) {
        //Only apply to mutation methods
        if(!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            return next();
        }
        const idempotencyKey = req.headers[IdempotencyMiddleware.IDEMPOTENCY_HEADER] as string;
        if(!idempotencyKey) {
            return next();
        }
        //Validate key format
        if(!this.isValidKey(idempotencyKey)) {
            logger.warn('Invalid idempotency key format', { idempotencyKey });
            return res.status(400).json({
                success: false,
                message: 'Invalid idempotency key format. Use alphanumeric characters with dashes/underscore only (1-255 chars).',
                data: null
            });
        }
        //Generate request fingerprint
        const fingerprint = this.generateRequestFingerprint(req.method, req.path, req.body);
        try {
            //1. Check for cached response
            const cachedResponse = await this.getCachedResponse(idempotencyKey);
            if(cachedResponse) {
                //verify this is the exact same request (check fingerprint)
                const storedFingerprint = await redis.get(`idempotency:fingerprint:${idempotencyKey}`);
                if(storedFingerprint === fingerprint) {
                    logger.info('Serving cached idempotent response', {
                        idempotencyKey,
                        path: req.path
                    });

                    //Add informative headers 
                    const responseHeaders = {
                        ...cachedResponse.headers,
                        'X-Idempotency-Replayed': 'true',
                        'X-Original-Request-Id': idempotencyKey
                    };

                    return res.status(cachedResponse.statusCode).set(responseHeaders).json(cachedResponse.body);
                } else {
                    // Same key but different request - clear old data
                    logger.warn('Idempotency key reused with different request', { idempotencyKey });
                    await this.clearKey(idempotencyKey);
                }
            }
            //2. Try to acquire atomic lock
            const lockAcquired = await this.acquireLock(idempotencyKey);
            if(!lockAcquired) {
                logger.warn('Concurrent idempotent request detected', { idempotencyKey });
                return res.status(409).json({
                    success: false,
                    message: 'A request with this idempotency key is already being processed. Please wait or use a different key.',
                    data: null
                });
            }

            //3. set up response interception
            const originalJson = res.json.bind(res);
            const originalStatus = res.status.bind(res);

            let responseStatusCode = 200;
            let responseBody: any;
            let responseHeaders: Record<string, string> = {};

            //Overridde res.status to capture status code
            res.status = (code: number) => {
                responseStatusCode = code;
                return originalStatus(code);
            };

            //Override res.json to capture response body
            res.json = (body: any) => {
                responseBody = body;
                //capture safe headers
                responseHeaders = {
                    'content-type': res.get('content-type') || 'application/json',
                    'x-request-id': res.get('x-request-id') || ''
                };
                return originalJson(body)
            };

            // 4. Handle response completion
            const onFinish = async () => {
                res.removeListener('finish', onFinish);

                try {
                    if (responseStatusCode >= 200 && responseStatusCode < 300) {
                        //success - store response
                        await this.storeResponse(idempotencyKey, fingerprint, responseStatusCode, responseBody, responseHeaders);

                        logger.debug('Idempotent request completed successfully', {idempotencyKey});
                    } else {
                        //Error - clear key to allow retry with same key
                    await this.clearKey(idempotencyKey);
                    logger.debug('Cleared idempotency key on error', { 
                            idempotencyKey, 
                            statusCode: responseStatusCode 
                        });
                    }
                } catch (error) {
                    logger.error('Failed to process idempotency completion', {
                        idempotencyKey,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    //clean up on error
                    await this.clearKey(idempotencyKey);
                }
            };
            res.on('finish', onFinish);

            //continue on next middleware/route handler
            next();
        } catch (error) {
            logger.error('Idempotency middleware error', {
                idempotencyKey,
                error: error instanceof Error ? error.message : 'Uknown error',
                path: req.path
            });
            //clean up and continue without idempotency
            await this.clearKey(idempotencyKey);
            next();
        }
    }
}