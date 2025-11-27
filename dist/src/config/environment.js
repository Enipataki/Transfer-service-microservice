import { z } from 'zod';
import * as dotenv from 'dotenv';
// Load environment variables FIRST
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default(3000),
    DATABASE_URL: z.string(),
    REDIS_URL: z.string(),
    //External Service
    ACCOUNT_SERVICE_URL: z.string(),
    TRANSACTION_SERVICE_URL: z.string(),
    LIMIT_SERVICE_URL: z.string(),
    NOTIFICATION_SERVICE_URL: z.string(),
    // Payment Rails
    NIP_API_URL: z.string(),
    NIP_API_KEY: z.string(),
    NIP_API_SECRET: z.string(),
    // security
    JWT_SECRET: z.string(),
    ENCRYPTION_KEY: z.string()
});
export const env = envSchema.parse(process.env);
