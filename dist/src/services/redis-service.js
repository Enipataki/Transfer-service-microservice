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
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.client.exists(key);
            return result === 1;
        });
    }
}
exports.RedisService = RedisService;
exports.redis = new RedisService();
