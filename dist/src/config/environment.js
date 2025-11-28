"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
// Load environment variables FIRST
dotenv.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).default(3000),
    DATABASE_URL: zod_1.z.string(),
    REDIS_URL: zod_1.z.string(),
    //External Service
    ACCOUNT_SERVICE_URL: zod_1.z.string(),
    TRANSACTION_SERVICE_URL: zod_1.z.string(),
    LIMIT_SERVICE_URL: zod_1.z.string(),
    NOTIFICATION_SERVICE_URL: zod_1.z.string(),
    // Payment Rails
    NIP_API_URL: zod_1.z.string(),
    NIP_API_KEY: zod_1.z.string(),
    NIP_API_SECRET: zod_1.z.string(),
    // security
    JWT_SECRET: zod_1.z.string(),
    ENCRYPTION_KEY: zod_1.z.string()
});
exports.env = envSchema.parse(process.env);
