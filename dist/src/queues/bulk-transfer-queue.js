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
exports.BulkTransferQueue = void 0;
const bullmq_1 = require("bullmq");
const queue_config_1 = require("./queue-config");
const core_transfer_service_1 = require("../services/core-transfer-service");
const logger_service_1 = require("../services/logger-service");
/**
 * Bulk transfer queue system
 * Handles processing of bulk transfers with:
 * Parallel processing of individual transfers
 * Progress tracking for the entire batch
 * Partial completion handling
 * Batch-level retry logic
 */
class BulkTransferQueue {
    constructor() {
        this.queue = new bullmq_1.Queue(queue_config_1.QueueNames.BULK_TRANSFER, {
            connection: queue_config_1.QueueConfig.getConnection(),
            defaultJobOptions: {
                removeOnComplete: 50,
                removeOnFail: 20,
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        });
        this.worker = new bullmq_1.Worker(queue_config_1.QueueNames.BULK_TRANSFER, this.processJob.bind(this), {
            connection: queue_config_1.QueueConfig.getConnection(),
            concurrency: 2 // process 2 bulk transfers concurently
        });
    }
    //add bulk transfer to queue
    addBulkTransferJob(bulkTransferId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.queue.add(queue_config_1.JobNames.PROCESS_BULK_TRANSFER, { bulkTransferId }, {
                jobId: `bulk-${bulkTransferId}-${Date.now()}`
            });
            logger_service_1.logger.info('Bulk transfer job queued', { bulkTransferId });
        });
    }
    //process bulk transfer job
    processJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bulkTransferId } = job.data;
            try {
                logger_service_1.logger.info('Processing bulk transfer job', {
                    jobId: job.id,
                    bulkTransferId
                });
                //update bulk transfer status to PROCESSING
                yield this.updateBulkTransferStatus(bulkTransferId, 'PROCESSING');
                //Get bulk transfer details with individual transfers
                const bulkTransfer = yield this.getBulkTransferWithTransfers(bulkTransferId);
                const results = yield this.processIndividualTransfer(bulkTransfer.transfers, job);
                //caculate results
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                //Determine final status
                let finalStatus;
                if (failed === 0) {
                    finalStatus = 'COMPLETED';
                }
                else if (successful === 0) {
                    finalStatus = 'FAILED';
                }
                else {
                    finalStatus = 'PARTIALLY_COMPLETED';
                }
                //update bulk transfer status
                yield this.updateBulkTransferStatus(bulkTransferId, finalStatus, { successfulCount: successful, failedCount: failed });
                logger_service_1.logger.info('Bulk transfer job completed', {
                    jobId: job.id,
                    bulkTransferId,
                    successful,
                    failed,
                    finalStatus
                });
            }
            catch (error) {
                logger_service_1.logger.error('bulk transfer job failed', {
                    jobId: job.id,
                    bulkTransferId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                yield this.updateBulkTransferStatus(bulkTransferId, 'FAILED');
                throw error;
            }
        });
    }
    //process indiviual transfer within bulk transfer
    processIndividualTransfer(transfers, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const concurrency = 3; //process 3 transfers at a time
            const results = [];
            for (let i = 0; i < transfers.length; i += concurrency) {
                const batch = transfers.slice(i, i + concurrency);
                const batchPromises = batch.map((transfer) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield core_transfer_service_1.transferService.processTransfer(transfer.id);
                        return { transferId: transfer.id, success: true };
                    }
                    catch (error) {
                        logger_service_1.logger.error('Individual transfer in bulk failed', {
                            transferId: transfer.id,
                            error: error instanceof Error ? error.message : "Unknown error"
                        });
                        return { transferId: transfer.id, success: false, error };
                    }
                }));
                const batchResults = yield Promise.all(batchPromises);
                results.push(...batchResults);
                //update job progress
                const progress = Math.round((i + batch.length) / transfers.length * 100);
                yield job.updateProgress(progress);
            }
            return results;
        });
    }
    updateBulkTransferStatus(bulkTransferId, status, metadeta) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implemetation to update bulk transfer status in database
            logger_service_1.logger.info('Updating bulk trasnfer status', { bulkTransferId, status, metadeta });
        });
    }
    getBulkTransferWithTransfers(bulk_transfer_id) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implementation to fetch bulk transfer with it's individual transfers
            return { transfers: [] }; //placeholder
        });
    }
    setupEventListeners() {
        this.worker.on('completed', (job) => {
            logger_service_1.logger.info('Bulk transfer job completed', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
        this.worker.on('failed', (job, error) => {
            logger_service_1.logger.error('Bulk transfer job failed', {
                jobId: job === null || job === void 0 ? void 0 : job.id,
                transferId: job === null || job === void 0 ? void 0 : job.data.transferId,
                error: error.message
            });
        });
        this.worker.on('stalled', (jobId) => {
            logger_service_1.logger.info('Bulk transfer job stalled', {
                jobId: jobId
            });
        });
        this.worker.on('progress', (job) => {
            logger_service_1.logger.info('Bulk transfer job progress', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.worker.close();
            yield this.queue.close();
        });
    }
}
exports.BulkTransferQueue = BulkTransferQueue;
