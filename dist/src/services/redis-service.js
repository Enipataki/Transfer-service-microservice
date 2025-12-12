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
exports.redis = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const environment_1 = require("../config/environment");
class RedisService {
    constructor() {
        this.client = new ioredis_1.default(environment_1.env.REDIS_URL);
        this.client.on('connect', () => {
            console.log('Redis connected successfully');
        });
        this.client.on('error', (error) => {
            console.log("Redis connection error", error);
        });
    }
    set(key, value, expiry) {
        return __awaiter(this, void 0, void 0, function* () {
            const stringValue = JSON.stringify(value);
            if (expiry) {
                yield this.client.setex(key, expiry, stringValue);
            }
            else {
                yield this.client.set(key, stringValue);
            }
        });
    }
    //Advanced set with Redis options (NX, EX, etc.)
    setWithOptions(key, value, mode, //NX = only set if not exists, XX = only set if exists
    expiryTime, // Expiration in seconds
    expireMode //EX = seconds, PX = millisecond
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            const stringValue = JSON.stringify(value);
            const args = [key, stringValue];
            if (mode)
                args.push(mode);
            if (expiryTime && expireMode) {
                args.push(expireMode);
                args.push(expiryTime);
            }
            //Returns 'ok' if successfull, null if NX failed
            const result = yield this.client.set(...args);
            return result;
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const value = yield this.client.get(key);
            return value ? JSON.parse(value) : null;
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.del(key);
        });
    }
    delMultiple(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length > 0) {
                yield this.client.del(...keys);
            }
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.client.exists(key);
            return result === 1;
        });
    }
    keys(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.client.keys(pattern);
        });
    }
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.client.ttl(key);
        });
    }
    //pipelime for batch operations
    pipeline() {
        return this.client.pipeline();
    }
    //Get the raw Redis client for advanced operations
    getClient() {
        return this.client;
    }
}
exports.RedisService = RedisService;
exports.redis = new RedisService();
