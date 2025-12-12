import Redis from "ioredis";
import {env} from '../config/environment';

export class RedisService {
    private client: Redis;

    constructor() {
        this.client = new Redis(env.REDIS_URL);

        this.client.on('connect', () => {
            console.log('Redis connected successfully');
        });

        this.client.on('error', (error) => {
            console.log("Redis connection error", error)
        })
    }

    async set(key: string, value: any, expiry?: number): Promise<void> {
        const stringValue = JSON.stringify(value);
        if (expiry) {
            await this.client.setex(key, expiry, stringValue);
        } else {
            await this.client.set(key, stringValue);
        }
    }

    //Advanced set with Redis options (NX, EX, etc.)
    async setWithOptions(
        key: string, 
        value: any, 
        mode?: 'NX' | 'XX', //NX = only set if not exists, XX = only set if exists
        expiryTime?: number, // Expiration in seconds
        expireMode?: 'EX' | 'PX' //EX = seconds, PX = millisecond
        ): Promise<string | null> {
            const stringValue = JSON.stringify(value);
            const args: any[] = [key, stringValue];

            if(mode) args.push(mode);
            if (expiryTime && expireMode) {
                args.push(expireMode);
                args.push(expiryTime);
            }

            //Returns 'ok' if successfull, null if NX failed
             const result = await (this.client.set as any)(...args);
             return result;
        }

    async get<T>(key: string): Promise<T|null> {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async delMultiple(keys: string[]): Promise<void> {
       if (keys.length > 0) {
        await this.client.del(...keys);
       }
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1
    }

    async keys(pattern: string): Promise<string[]> {
        return await this.client.keys(pattern);
    }

    async ttl(key: string): Promise<number> {
        return await this.client.ttl(key);
    }

    //pipelime for batch operations
    pipeline() {
        return this.client.pipeline();
    }

    //Get the raw Redis client for advanced operations
    getClient(): Redis {
        return this.client;
    }
}

export const redis = new RedisService();