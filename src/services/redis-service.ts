import Redis from "ioredis";
import {env} from '../config/environment';

export class RedisService {
    private client: Redis;

    constructor() {
        this.client = new Redis(env.REDIS_URL);
    }

    async set(key: string, value: any, expiry?: number): Promise<void> {
        const stringValue = JSON.stringify(value);
        if (expiry) {
            await this.client.setex(key, expiry, stringValue);
        } else {
            await this.client.set(key, stringValue);
        }
    }

    async get<T>(key: string): Promise<T|null> {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1
    }
}

export const redis = new RedisService();