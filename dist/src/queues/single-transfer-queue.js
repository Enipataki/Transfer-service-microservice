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
exports.singleTransferQueue = exports.SingleTransferQueue = void 0;
const bullmq_1 = require("bullmq");
const queue_config_1 = require("./queue-config");
const core_transfer_service_1 = require("../services/core-transfer-service");
const logger_service_1 = require("../services/logger-service");
/**
 * Single transfer queue system
 * Handles processing of individual transfers with:
 * Retry logic with exponential back off
 * Failure handling
 * Progress reporting
 * Dead letter queue for failed jobs
 */
class SingleTransferQueue {
    constructor() {
        this.queue = new bullmq_1.Queue(queue_config_1.QueueNames.SINGLE_TRANSFER, {
            connection: queue_config_1.QueueConfig.getConnection(),
            defaultJobOptions: {
                removeOnComplete: 100, //keep last 100 completed jobs
                removeOnFail: 50, //keep last 50 failed jobs
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000, //1 second initial delay
                }
            }
        });
        this.worker = new bullmq_1.Worker(queue_config_1.QueueNames.SINGLE_TRANSFER, this.processJob.bind(this), {
            connection: queue_config_1.QueueConfig.getConnection(),
            concurrency: 5, //Process 5 transfers concurrently
        });
        this.setupEventListeners();
    }
    //add a transfer to the queue
    addTransferJob(transferId, delay) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobOptions = {
                JobId: `transfer-${transferId}-${Date.now()}`,
                delay, //optional delay for scheduled transfers
            };
            yield this.queue.add(queue_config_1.JobNames.PROCESS_SINGLE_TRANSFER, { transferId }, jobOptions);
            logger_service_1.logger.info('Transfer job queued', { transferId, delay });
        });
    }
    /**
     * Process a single job transfer
     */
    processJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const { transferId } = job.data;
            try {
                logger_service_1.logger.info('processing transfer job', {
                    jobId: job.id,
                    transferId,
                    attempt: job.attemptsMade
                });
                //update job progress
                yield job.updateProgress(10);
                //process the transfer
                yield core_transfer_service_1.transferService.processTransfer(transferId);
                //mark job as completed
                yield job.updateProgress(100);
                logger_service_1.logger.info('Transfer job completed successfully', {
                    jobId: job.id,
                    transferId
                });
            }
            catch (error) {
                logger_service_1.logger.error('Transfer job failed', {
                    jobId: job.id,
                    transferId,
                    error: error instanceof Error ? error.message : 'Uknown error',
                    attempt: job.attemptsMade
                });
                //Check if we should retry or fail permanently
                if (job.attemptsMade >= job.opts.attempts) {
                    yield this.handlePermanentFailure(transferId, error);
                }
                throw error; //will trigger retry mechanism
            }
        });
    }
    //Handle permanent job failure
    handlePermanentFailure(transferId, error) {
        return __awaiter(this, void 0, void 0, function* () {
            //update transfer status to failed
            //send notification
            //Log to monitoring system
            logger_service_1.logger.error('Transfer job permanently failed', {
                transferId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            //could move to a dead letter queue here
        });
    }
    //Setup queue event listeners
    setupEventListeners() {
        this.worker.on('completed', (job) => {
            logger_service_1.logger.info('Transfer job completed', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
        this.worker.on('failed', (job, error) => {
            logger_service_1.logger.error('Transfer job failed', {
                jobId: job === null || job === void 0 ? void 0 : job.id,
                transferId: job === null || job === void 0 ? void 0 : job.data.transferId,
                error: error.message
            });
        });
        this.worker.on('stalled', (jobId) => {
            logger_service_1.logger.info('Transfer job stalled', {
                jobId: jobId // Just the ID as string
                // No transferId available here!
            });
        });
        this.worker.on('progress', (job) => {
            logger_service_1.logger.info('Transfer job progress', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
    }
    //clean up resources
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.worker.close();
            yield this.queue.close();
        });
    }
}
exports.SingleTransferQueue = SingleTransferQueue;
exports.singleTransferQueue = new SingleTransferQueue();
