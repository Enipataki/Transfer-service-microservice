import {Queue, Worker} from 'bullmq';
import {QueueConfig, JobNames, QueueNames} from './queue-config';
import {transferService} from '../services/core-transfer-service';
import {logger} from '../services/logger-service';

/**
 * Bulk transfer queue system
 * Handles processing of bulk transfers with:
 * Parallel processing of individual transfers
 * Progress tracking for the entire batch
 * Partial completion handling
 * Batch-level retry logic
 */

export class BulkTransferQueue {
    public queue: Queue;
    private worker: Worker;

    constructor() {
        this.queue = new Queue(QueueNames.BULK_TRANSFER, {
            connection: QueueConfig.getConnection(),
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

        this.worker = new Worker(QueueNames.BULK_TRANSFER, this.processJob.bind(this), {
            connection: QueueConfig.getConnection(),
            concurrency: 2 // process 2 bulk transfers concurently
        })
    }

    //add bulk transfer to queue
    async addBulkTransferJob(bulkTransferId: string): Promise<void> {
        await this.queue.add(JobNames.PROCESS_BULK_TRANSFER, {bulkTransferId}, {
            jobId: `bulk-${bulkTransferId}-${Date.now()}`
        });
        logger.info('Bulk transfer job queued', {bulkTransferId});
    }

    //process bulk transfer job
    private async processJob(job:any): Promise<void> {
        const {bulkTransferId} = job.data;

        try {
            logger.info('Processing bulk transfer job', {
                jobId: job.id,
                bulkTransferId
            });
            //update bulk transfer status to PROCESSING
            await this.updateBulkTransferStatus(bulkTransferId, 'PROCESSING');

            //Get bulk transfer details with individual transfers
            const bulkTransfer = await this.getBulkTransferWithTransfers(bulkTransferId);

            const results = await this.processIndividualTransfer(bulkTransfer.transfers, job);

            //caculate results
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            //Determine final status
            let finalStatus: string;
            if(failed === 0) {
                finalStatus = 'COMPLETED';
            } else if (successful === 0) {
                finalStatus = 'FAILED';
            } else {
                finalStatus = 'PARTIALLY_COMPLETED';
            }

            //update bulk transfer status
            await this.updateBulkTransferStatus(bulkTransferId, finalStatus, {successfulCount: successful, failedCount: failed});

            logger.info('Bulk transfer job completed', {
                jobId: job.id,
                bulkTransferId,
                successful,
                failed,
                finalStatus
            })
        } catch (error) {
            logger.error('bulk transfer job failed', {
                jobId: job.id,
                bulkTransferId,
                error: error instanceof Error? error.message : 'Unknown error'
            });

            await this.updateBulkTransferStatus(bulkTransferId, 'FAILED');
            throw error;
        }
    }


    //process indiviual transfer within bulk transfer
    private async processIndividualTransfer(transfers: any[], job: any): Promise<any[]> {
        const concurrency = 3;//process 3 transfers at a time
        const results = [];

        for(let i = 0; i < transfers.length; i+= concurrency) {
            const batch = transfers.slice(i, i + concurrency);
            const batchPromises = batch.map(async(transfer) => {
                try {
                    await transferService.processTransfer(transfer.id);
                    return {transferId: transfer.id, success: true}
                } catch (error) {
                    logger.error('Individual transfer in bulk failed', {
                        transferId: transfer.id,
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                    return {transferId: transfer.id, success: false, error}
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults)

            //update job progress
            const progress = Math.round((i + batch.length) / transfers.length * 100);
            await job.updateProgress(progress);
        }
        return results;

    }

    private async updateBulkTransferStatus(bulkTransferId: string, status: string, metadeta?: any): Promise<void> {
        //Implemetation to update bulk transfer status in database

        logger.info('Updating bulk trasnfer status', {bulkTransferId, status, metadeta});
    }

    private async getBulkTransferWithTransfers(bulk_transfer_id: string): Promise<any> {
        //Implementation to fetch bulk transfer with it's individual transfers

        return {transfers: []}//placeholder
    }

    private setupEventListeners(): void {
        this.worker.on('completed', (job) => {
            logger.info('Bulk transfer job completed', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });

        this.worker.on('failed', (job, error) => {
            logger.error('Bulk transfer job failed', {
                jobId: job?.id,
                transferId: job?.data.transferId,
                error: error.message
            });
        });

        this.worker.on('stalled', (jobId) => {
        logger.info('Bulk transfer job stalled', {
            jobId: jobId  
        });
    });

        this.worker.on('progress', (job) => {
            logger.info('Bulk transfer job progress', {
                jobId: job.id,
                transferId: job.data.transferId
            });
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
        await this.queue.close();
    }
}