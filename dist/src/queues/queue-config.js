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
exports.JobNames = exports.QueueNames = exports.QueueConfig = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const environment_1 = require("../config/environment");
/**
 * Queue configuration and connection management
 */
class QueueConfig {
    static getConnection() {
        if (!this.connection) {
            this.connection = new ioredis_1.default(environment_1.env.REDIS_URL, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false
            });
        }
        return this.connection;
    }
    static closeConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                yield this.connection.quit();
            }
        });
    }
}
exports.QueueConfig = QueueConfig;
//Queue names
var QueueNames;
(function (QueueNames) {
    QueueNames["SINGLE_TRANSFER"] = "single-transfer";
    QueueNames["BULK_TRANSFER"] = "bulk-transfer";
    QueueNames["RECURRING_TRANSFER"] = "recurring-transfer";
    QueueNames["TRANSFER_STATUS_UPDATE"] = "transfer-status-update";
})(QueueNames || (exports.QueueNames = QueueNames = {}));
//Job names
var JobNames;
(function (JobNames) {
    JobNames["PROCESS_SINGLE_TRANSFER"] = "process-single-transfer";
    JobNames["PROCESS_BULK_TRANSFER"] = "process-bulk-transfer";
    JobNames["PROCESS_RECURRING_TRANSFER"] = "process-recurring-transfer";
    JobNames["UPDATE_TRANSFER_STATUS"] = "update-transfer-status";
})(JobNames || (exports.JobNames = JobNames = {}));
