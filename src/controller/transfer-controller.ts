import {Request, Response} from 'express';
import {transferService} from "../services/core-transfer-service"
import {CreateTransferSchema, CreateBulkTransferSchema, CreateRecurringTransferSchema} from '../utils/validation'
import {logger} from '../services/logger-service';
import { success } from 'zod';


/**
 * Transfer controller
 * Handles HTTp requests for transfer operations
 * validate input, handles errors, and format responses
 */

export class TransferController {
    /**
     * Create a single transfer
     * POST / transfers
     */

    async createTransfer(req: Request, res: Response) {
        try {
            // validate request body
            const validatedData = CreateTransferSchema.parse(req.body);
            // Get idempotencyKey from header
            const idempotencyKey = req.headers['idempotency-key'] as string;

            //create transfer 
            const transfer = await transferService.createTransfer(validatedData, idempotencyKey);

            logger.info('Transfer creation successful', {
                transferId: transfer.id, reference: transfer.reference
            })

            res.status(201).json({
                success: true,
                message: 'Treansfer created successfully',
                data: transfer
            });
        } catch (error) {
            logger.error('Transfer creation failed', {
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            if (error instanceof Error) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                    data: null
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    data: null
                });
            }
        }
    }

    /**
     * Create bulk transfers
     * POST /transfers/bulk
     */
    async createBulkTransfer(req: Request, res: Response) {
        try {
            //validate request body
            const validatedData = CreateBulkTransferSchema.parse(req.body);

            //get idemootency key from header
            const idempotencyKey = req.headers['idempotency-key'] as string;

            //create bulk transfer
            const bulkTransfer = await transferService.createdBulkTransfer(validatedData, idempotencyKey);

            logger.info('Bulk transfer creation request successful', {bulkTransferId: bulkTransfer.id, transferCount: bulkTransfer.transferCount});

            res.status(201).json({
                success: true,
                message: 'Bulk transfer created successfully',
                data: bulkTransfer
            });
        } catch (error) {
            logger.error('Bulk transfer creation failed', {
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            if (error instanceof Error) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                    data: null
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    data: null
                });
            }
        }
    }

    /**
     * Create recurring transfer
     * POST /transfers/recurring
     */

    async createRecurringTransfer(req: Request, res: Response) {
        try {
            // Validate request body
            const validatedData = CreateRecurringTransferSchema.parse(req.body);

            //Create recurring transfer
            const recurringTransfer = await transferService.createRecurringTransfer(validatedData);

            logger.info('Recurring transfer creation request successful', {bulkTransferId: recurringTransfer.id, frequency: recurringTransfer.frequency});

            res.status(201).json({
                success: true,
                message: 'Recurring transfer created successfully',
                data: recurringTransfer
            });
        } catch (error) {
            logger.error('Recurring transfer creation failed', {
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            if (error instanceof Error) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                    data: null
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    data: null
                });
            }
        }
    }

    /**
     * Get transfer by ID
     * GET /transfers/:id
     */

    async getTransfer(req: Request, res: Response) {
        try {
            const {id} = req.params;

        //This would call a method in transfer service to get transfer by ID
        //for now, returning a placeholder response

        logger.info('Transfer retrieval request', {transferId: id});

        res.status(200).json({
            success: true,
            message: 'Transfer details retrieved successfully',
            data: {
                id,
                status: 'COMPLETED', //This would come from the database
                reference: `TF-${id}`,
                //... other transfer details from the database
            }
        })
        } catch (error) {
            logger.error('Transfer retrieval failed', {
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve transfer',
                data: null
            });
        }
    }

    /**
     * Get transfer status
     * GET /transfers/:id/status
     */

    async getTransferStatus(req: Request, res: Response) {
        try {
            const {id} = req.params;

            logger.info('transfer status request', {transferId: id});

            //This would call a method in transferService to get transfer status
            res.status(200).json({
                success: true,
                message: 'Transfer status retrieved successfully',
                data: {
                    transferId: id,
                    status: 'COMPLETED', ////This would come from the database
                    reference: `TF-${id}`,
                    processedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Transfer status retrieval failed', {
                transferId: req.params.id,
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve transfer status',
                data: null
            });
        }
    }

    /**
     * cancel a pending transfer
     * POST /transfers/:id/cancel
     */
    async cancelTransfer(req: Request, res: Response) {
        try {
            const {id} = req.params;

            logger.info('Transfer cancellation request', { transferId: id});

            //This would call a method in transferService to cancel transfer
            //For now returning a placeholder response

            res.status(200).json({
                success: true,
                message: 'Transfer cancelled successfully',
                data: {
                    id,
                    status:  'CANCELLED',
                    cancelledAt: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Transfer cancellation failed', {
                transferId: req.params.id,
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            res.status(500).json({
                success: false,
                message: 'Failed to cancel transfer',
                data: null
            });
        }
    }

    /**
     * Health check endpoint
     * GET /transfer/health
     */

    async healthCheck(req: Request, res: Response) {
        try {
            logger.info('Health check requested');

            res.status(200).json({
                success: true,
                message: 'Transfer service is healthy',
                data: {
                    service: 'transfer-service',
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            });
        } catch (error) {
            logger.error('Health check failed', {
                error: error instanceof Error? error.message : 'Unknown error',
                body: req.body
            });

            res.status(500).json({
                success: false,
                message: 'Service unhealthy',
                data: null
            });
        }
    }
}

export const transferController = new TransferController();