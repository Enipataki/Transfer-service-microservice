import Redis from "ioredis";
import { env } from '../config/environment';
export class RedisService {
    client;
    constructor() {
        this.client = new Redis(env.REDIS_URL);
    }
    async set(key, value, expiry) {
        const stringValue = JSON.stringify(value);
        if (expiry) {
            await this.client.setex(key, expiry, stringValue);
        }
        else {
            await this.client.set(key, stringValue);
        }
    }
    async get(key) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }
    async del(key) {
        await this.client.del(key);
    }
    async exists(key) {
        const result = await this.client.exists(key);
        return result === 1;
    }
}
export const redis = new RedisService();
