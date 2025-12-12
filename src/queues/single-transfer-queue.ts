import {Queue, Worker} from 'bullmq';
import {QueueConfig, QueueNames, JobNames} from "./queue-config";
import {transferService} from '../services/core-transfer-service';
import { logger } from '../services/logger-service';

/**
 * Single transfer queue system
 * Handles processing of individual transfers with:
 * Retry logic with exponential back off
 * Failure handling
 * Progress reporting
 * Dead letter queue for failed jobs
 */

export class SingleTransferQueue {
    public queue: Queue;
    private worker: Worker;

    constructor() {
        this.queue = new Queue(QueueNames.SINGLE_TRANSFER, {
            connection: QueueConfig.getConnection(),
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
        this.worker = new Worker(QueueNames.SINGLE_TRANSFER, this.processJob.bind(this), {
            connection: QueueConfig.getConnection(),
            concurrency: 5, //Process 5 transfers concurrently
        });
        this.setupEventListeners();
    }

    //add a transfer to the queue
    async addTransferJob(transferId: string, delay?: number): Promise<void> {
        const jobOptions: any = {
            JobId: `transfer-${transferId}-${Date.now()}`,
            delay, //optional delay for scheduled transfers
        };
        await this.queue.add(JobNames.PROCESS_SINGLE_TRANSFER, {transferId}, jobOptions);
        
        logger.info('Transfer job queued', {transferId, delay});
    }

    /**
     * Process a single job transfer
     */
    private async processJob(job: any) : Promise<void> {
        const {transferId} = job.data;

        try {
            logger.info('processing transfer job', {
                jobId: job.id,
                transferId,
                attempt: job.attemptsMade
            });
            //update job progress
            await job.updateProgress(10);

            //process the transfer
            await transferService.processTransfer(transferId);

            //mark job as completed
            await job.updateProgress(100);
            
            logger.info('Transfer job completed successfully', {
                jobId: job.id,
                transferId
            });
        } catch (error) {
            logger.error('Transfer job failed', {
                jobId: job.id,
                transferId,
                error: error instanceof Error ? error.message : 'Uknown error',
                attempt: job.attemptsMade
            });

            //Check if we should retry or fail permanently
            if (job.attemptsMade >= job.opts.attempts) {
                await this.handlePermanentFailure(transferId, error);
            }
            throw error; //will trigger retry mechanism
        }
    }

    //Handle permanent job failure
    private async handlePermanentFailure(transferId: string, error: any): Promise<void> {
        //update transfer status to failed
        //send notification
        //Log to monitoring system
        logger.error('Transfer job permanently failed', {
            transferId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        //could move to a dead letter queue here
    }

    //Setup queue event listeners
    private setupEventListeners(): void {
        this.worker.on('completed', (job) => {
            logger.info('Transfer job completed', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });

        this.worker.on('failed', (job, error) => {
            logger.error('Transfer job failed', {
                jobId: job?.id,
                transferId: job?.data.transferId,
                error: error.message
            });
        });

        this.worker.on('stalled', (jobId) => {
        logger.info('Transfer job stalled', {
            jobId: jobId  // Just the ID as string
            // No transferId available here!
        });
    });

        this.worker.on('progress', (job) => {
            logger.info('Transfer job progress', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
    }
    //clean up resources
    async close(): Promise<void> {
        await this.worker.close();
        await this.queue.close();
    }
}

export const singleTransferQueue = new SingleTransferQueue();