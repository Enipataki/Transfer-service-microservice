"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyMiddleware = void 0;
const redis_service_1 = require("../services/redis-service");
const logger_service_1 = require("../services/logger-service");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Idempotency Middleware
 * Features:
 * Atomic Redis operation (no race conditions)
 * Request fingerprinting (same key + different request = new request)
 * Automatic cleanup on errors
 * HTTP header support
 * Concurrent request handling (409 conflict)
 */
class IdempotencyMiddleware {
    /**
     * Generate a fingerprint for the request
     * Same key + different fingerprint = different request
     */
    static generateRequestFingerprint(method, path, body) {
        //Normalize the request for consistent hashing
        const normalized = {
            method: method.toUpperCase(),
            path: path,
            body: this.normalizedBody(body),
            timestamp: Math.floor(Date.now() / 1000) // second precision
        };
        const content = JSON.stringify(normalized);
        return crypto_1.default.createHash('sha256').update(content).digest('hex');
    }
    /**
     * Normalize request body for consistent hashing
     */
    static normalizedBody(body) {
        if (!body || typeof body !== 'object')
            return body;
        //sort object keys for consistent ordering
        const sorted = {};
        Object.keys(body).sort().forEach(key => {
            sorted[key] = body[key];
        });
        return sorted;
    }
    /**
     * Atomic lock axquisition using redis NX flag
     */
    static acquireLock(idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const lockKey = `idempotency:lock:${idempotencyKey}`;
            try {
                //Atomic SET with NX (not exists) and EX (expire in seconds)
                const result = yield redis_service_1.redis.setWithOptions(lockKey, 'processing', 'NX', this.LOCK_TIMEOUT, 'EX');
                //Returns 'OK' if lock acquired, null if already exists
                return result === 'OK';
            }
            catch (error) {
                logger_service_1.logger.error('Failed to acquire idempotency lock', {
                    idempotencyKey,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                return false;
            }
        });
    }
    /**
     * get cached response if exists
     */
    static getCachedResponse(idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield redis_service_1.redis.get(`idempotency:response:${idempotencyKey}`);
                return data;
            }
            catch (error) {
                logger_service_1.logger.warn('Failed to get cached response', { idempotencyKey });
                return null;
            }
        });
    }
    /**
     * store successful response
     */
    static storeResponse(idempotencyKey, fingerprint, statusCode, body, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const responseData = {
                    statusCode,
                    body,
                    headers: Object.assign(Object.assign({}, headers), { 'X-idempotency-Replayed': 'true' }),
                    storedAt: new Date().toISOString()
                };
                //store response with TTl
                yield redis_service_1.redis.set(`idempotency:response:${idempotencyKey}`, responseData, this.TTL_SECONDS);
                //store fingerprint to detect different requests wuth same key
                yield redis_service_1.redis.set(`idempotency:fingerprint:${idempotencyKey}`, fingerprint, this.TTL_SECONDS);
                //Convert lock to completed state with full TTL
                yield redis_service_1.redis.set(`idempotency:lock:${idempotencyKey}`, 'completed', this.TTL_SECONDS);
                logger_service_1.logger.debug('Stored idempotent response', { idempotencyKey });
            }
            catch (error) {
                logger_service_1.logger.error('Failed to store idempotency response', {
                    idempotencyKey,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    /**
     * Clear idempotency data (for errors or different requests)
     */
    static clearKey(idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield redis_service_1.redis.delMultiple([
                    `idempotency:response:${idempotencyKey}`,
                    `idempotency:lock:${idempotencyKey}`,
                    `idempotency:fingerprint:${idempotencyKey}`
                ]);
            }
            catch (error) {
                logger_service_1.logger.error('Failed to clear idempotency key', { idempotencyKey });
            }
        });
    }
    /**
     * Validate idempotency key format
     */
    static isValidKey(key) {
        //Alphanumeric, dashes, underscores, 1-255 chars
        return /^[a-zA-Z0-9\-_]{1,255}$/.test(key);
    }
    /**
     * Main middleware handler
     */
    static handle(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            //Only apply to mutation methods
            if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                return next();
            }
            const idempotencyKey = req.headers[IdempotencyMiddleware.IDEMPOTENCY_HEADER];
            if (!idempotencyKey) {
                return next();
            }
            //Validate key format
            if (!this.isValidKey(idempotencyKey)) {
                logger_service_1.logger.warn('Invalid idempotency key format', { idempotencyKey });
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
                const cachedResponse = yield this.getCachedResponse(idempotencyKey);
                if (cachedResponse) {
                    //verify this is the exact same request (check fingerprint)
                    const storedFingerprint = yield redis_service_1.redis.get(`idempotency:fingerprint:${idempotencyKey}`);
                    if (storedFingerprint === fingerprint) {
                        logger_service_1.logger.info('Serving cached idempotent response', {
                            idempotencyKey,
                            path: req.path
                        });
                        //Add informative headers 
                        const responseHeaders = Object.assign(Object.assign({}, cachedResponse.headers), { 'X-Idempotency-Replayed': 'true', 'X-Original-Request-Id': idempotencyKey });
                        return res.status(cachedResponse.statusCode).set(responseHeaders).json(cachedResponse.body);
                    }
                    else {
                        // Same key but different request - clear old data
                        logger_service_1.logger.warn('Idempotency key reused with different request', { idempotencyKey });
                        yield this.clearKey(idempotencyKey);
                    }
                }
                //2. Try to acquire atomic lock
                const lockAcquired = yield this.acquireLock(idempotencyKey);
                if (!lockAcquired) {
                    logger_service_1.logger.warn('Concurrent idempotent request detected', { idempotencyKey });
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
                let responseBody;
                let responseHeaders = {};
                //Overridde res.status to capture status code
                res.status = (code) => {
                    responseStatusCode = code;
                    return originalStatus(code);
                };
                //Override res.json to capture response body
                res.json = (body) => {
                    responseBody = body;
                    //capture safe headers
                    responseHeaders = {
                        'content-type': res.get('content-type') || 'application/json',
                        'x-request-id': res.get('x-request-id') || ''
                    };
                    return originalJson(body);
                };
                // 4. Handle response completion
                const onFinish = () => __awaiter(this, void 0, void 0, function* () {
                    res.removeListener('finish', onFinish);
                    try {
                        if (responseStatusCode >= 200 && responseStatusCode < 300) {
                            //success - store response
                            yield this.storeResponse(idempotencyKey, fingerprint, responseStatusCode, responseBody, responseHeaders);
                            logger_service_1.logger.debug('Idempotent request completed successfully', { idempotencyKey });
                        }
                        else {
                            //Error - clear key to allow retry with same key
                            yield this.clearKey(idempotencyKey);
                            logger_service_1.logger.debug('Cleared idempotency key on error', {
                                idempotencyKey,
                                statusCode: responseStatusCode
                            });
                        }
                    }
                    catch (error) {
                        logger_service_1.logger.error('Failed to process idempotency completion', {
                            idempotencyKey,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                        //clean up on error
                        yield this.clearKey(idempotencyKey);
                    }
                });
                res.on('finish', onFinish);
                //continue on next middleware/route handler
                next();
            }
            catch (error) {
                logger_service_1.logger.error('Idempotency middleware error', {
                    idempotencyKey,
                    error: error instanceof Error ? error.message : 'Uknown error',
                    path: req.path
                });
                //clean up and continue without idempotency
                yield this.clearKey(idempotencyKey);
                next();
            }
        });
    }
}
exports.IdempotencyMiddleware = IdempotencyMiddleware;
IdempotencyMiddleware.IDEMPOTENCY_HEADER = 'Idempotency-Key';
IdempotencyMiddleware.TTL_SECONDS = 24 * 60 * 60; //24 hours
IdempotencyMiddleware.LOCK_TIMEOUT = 30; //30 seconds for processing lock
