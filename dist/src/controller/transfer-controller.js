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
exports.transferController = exports.TransferController = void 0;
const core_transfer_service_1 = require("../services/core-transfer-service");
const validation_1 = require("../utils/validation");
const logger_service_1 = require("../services/logger-service");
/**
 * Transfer controller
 * Handles HTTp requests for transfer operations
 * validate input, handles errors, and format responses
 */
class TransferController {
    /**
     * Create a single transfer
     * POST / transfers
     */
    createTransfer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // validate request body
                const validatedData = validation_1.CreateTransferSchema.parse(req.body);
                // Get idempotencyKey from header
                const idempotencyKey = req.headers['idempotency-key'];
                //create transfer 
                const transfer = yield core_transfer_service_1.transferService.createTransfer(validatedData, idempotencyKey);
                logger_service_1.logger.info('Transfer creation successful', {
                    transferId: transfer.id, reference: transfer.reference
                });
                res.status(201).json({
                    success: true,
                    message: 'Treansfer created successfully',
                    data: transfer
                });
            }
            catch (error) {
                logger_service_1.logger.error('Transfer creation failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                if (error instanceof Error) {
                    res.status(400).json({
                        success: false,
                        message: error.message,
                        data: null
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: 'Internal server error',
                        data: null
                    });
                }
            }
        });
    }
    /**
     * Create bulk transfers
     * POST /transfers/bulk
     */
    createBulkTransfer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                //validate request body
                const validatedData = validation_1.CreateBulkTransferSchema.parse(req.body);
                //get idemootency key from header
                const idempotencyKey = req.headers['idempotency-key'];
                //create bulk transfer
                const bulkTransfer = yield core_transfer_service_1.transferService.createdBulkTransfer(validatedData, idempotencyKey);
                logger_service_1.logger.info('Bulk transfer creation request successful', { bulkTransferId: bulkTransfer.id, transferCount: bulkTransfer.transferCount });
                res.status(201).json({
                    success: true,
                    message: 'Bulk transfer created successfully',
                    data: bulkTransfer
                });
            }
            catch (error) {
                logger_service_1.logger.error('Bulk transfer creation failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                if (error instanceof Error) {
                    res.status(400).json({
                        success: false,
                        message: error.message,
                        data: null
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: 'Internal server error',
                        data: null
                    });
                }
            }
        });
    }
    /**
     * Create recurring transfer
     * POST /transfers/recurring
     */
    createRecurringTransfer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const validatedData = validation_1.CreateRecurringTransferSchema.parse(req.body);
                //Create recurring transfer
                const recurringTransfer = yield core_transfer_service_1.transferService.createRecurringTransfer(validatedData);
                logger_service_1.logger.info('Recurring transfer creation request successful', { bulkTransferId: recurringTransfer.id, frequency: recurringTransfer.frequency });
                res.status(201).json({
                    success: true,
                    message: 'Recurring transfer created successfully',
                    data: recurringTransfer
                });
            }
            catch (error) {
                logger_service_1.logger.error('Recurring transfer creation failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                if (error instanceof Error) {
                    res.status(400).json({
                        success: false,
                        message: error.message,
                        data: null
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: 'Internal server error',
                        data: null
                    });
                }
            }
        });
    }
    /**
     * Get transfer by ID
     * GET /transfers/:id
     */
    getTransfer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                //This would call a method in transfer service to get transfer by ID
                //for now, returning a placeholder response
                logger_service_1.logger.info('Transfer retrieval request', { transferId: id });
                res.status(200).json({
                    success: true,
                    message: 'Transfer details retrieved successfully',
                    data: {
                        id,
                        status: 'COMPLETED', //This would come from the database
                        reference: `TF-${id}`,
                        //... other transfer details from the database
                    }
                });
            }
            catch (error) {
                logger_service_1.logger.error('Transfer retrieval failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                res.status(500).json({
                    success: false,
                    message: 'Failed to retrieve transfer',
                    data: null
                });
            }
        });
    }
    /**
     * Get transfer status
     * GET /transfers/:id/status
     */
    getTransferStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                logger_service_1.logger.info('transfer status request', { transferId: id });
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
            }
            catch (error) {
                logger_service_1.logger.error('Transfer status retrieval failed', {
                    transferId: req.params.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                res.status(500).json({
                    success: false,
                    message: 'Failed to retrieve transfer status',
                    data: null
                });
            }
        });
    }
    /**
     * cancel a pending transfer
     * POST /transfers/:id/cancel
     */
    cancelTransfer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                logger_service_1.logger.info('Transfer cancellation request', { transferId: id });
                //This would call a method in transferService to cancel transfer
                //For now returning a placeholder response
                res.status(200).json({
                    success: true,
                    message: 'Transfer cancelled successfully',
                    data: {
                        id,
                        status: 'CANCELLED',
                        cancelledAt: new Date().toISOString()
                    }
                });
            }
            catch (error) {
                logger_service_1.logger.error('Transfer cancellation failed', {
                    transferId: req.params.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                res.status(500).json({
                    success: false,
                    message: 'Failed to cancel transfer',
                    data: null
                });
            }
        });
    }
    /**
     * Health check endpoint
     * GET /transfer/health
     */
    healthCheck(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_service_1.logger.info('Health check requested');
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
            }
            catch (error) {
                logger_service_1.logger.error('Health check failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    body: req.body
                });
                res.status(500).json({
                    success: false,
                    message: 'Service unhealthy',
                    data: null
                });
            }
        });
    }
}
exports.TransferController = TransferController;
exports.transferController = new TransferController();
