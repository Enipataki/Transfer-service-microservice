import IORedis from "ioredis";
import {env} from "../config/environment"

/**
 * Queue configuration and connection management
 */

export class QueueConfig {
    private static connection: IORedis;

    static getConnection(): IORedis {
        if(!this.connection) {
            this.connection = new IORedis(env.REDIS_URL, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false
            });
        }
        return this.connection;
    }

    static async closeConnection(): Promise<void> {
        if(this.connection) {
            await this.connection.quit();
        }
    }
}

//Queue names
export enum QueueNames {
    SINGLE_TRANSFER = 'single-transfer',
    BULK_TRANSFER = 'bulk-transfer',
    RECURRING_TRANSFER = 'recurring-transfer',
    TRANSFER_STATUS_UPDATE = 'transfer-status-update'
}

//Job names
export enum JobNames {
    PROCESS_SINGLE_TRANSFER = 'process-single-transfer',
    PROCESS_BULK_TRANSFER = 'process-bulk-transfer',
    PROCESS_RECURRING_TRANSFER = 'process-recurring-transfer',
    UPDATE_TRANSFER_STATUS = 'update-transfer-status'
}