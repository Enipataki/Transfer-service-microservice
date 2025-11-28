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
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.DatabaseService = void 0;
const pg_1 = require("pg");
const environment_1 = require("../config/environment");
class DatabaseService {
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: environment_1.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });
    }
    query(text, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield this.pool.connect();
            try {
                const result = yield client.query(text, params);
                return result;
            }
            catch (error) {
                console.error(error);
                throw error;
            }
            finally {
                client.release();
            }
        });
    }
    transaction(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield this.pool.connect();
            try {
                yield client.query('BEGIN');
                const result = yield cb(client); // ✅ Capture the return value
                yield client.query('COMMIT');
                return result; // ✅ Return the result from the callback
            }
            catch (error) {
                yield client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        });
    }
}
exports.DatabaseService = DatabaseService;
exports.db = new DatabaseService();
