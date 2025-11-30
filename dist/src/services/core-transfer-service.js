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
exports.transferService = exports.TransferService = void 0;
const uuid_1 = require("uuid");
const database_service_1 = require("./database-service");
const redis_service_1 = require("./redis-service");
const logger_service_1 = require("./logger-service");
const account_service_mock_1 = require("../mock-data/account-service-mock");
const transaction_service_mock_1 = require("../mock-data/transaction-service-mock");
const notification_service_mock_1 = require("../mock-data/notification-service-mock");
const payment_rail_service_mock_1 = require("../mock-data/payment-rail-service-mock");
const limit_service_mock_1 = require("../mock-data/limit-service-mock");
/**
 * Core Transfer Service
 * Handles all transfer operations including:
 * - Single transfers (intra-bank and interbank)
 * - Bulk transfers
 * - Recurring transfers
 * - Idempotency and retry safety
 * - Fee calculation and application
 * - compliance and validation
 */
class TransferService {
    constructor() {
        this.accountService = new account_service_mock_1.AccountServiceMock();
        this.transactionService = new transaction_service_mock_1.TransactionServiceMock();
        this.limitService = new limit_service_mock_1.LimitServiceMock();
        this.paymentRailService = new payment_rail_service_mock_1.PaymentRailServiceMock();
        this.notificationService = new notification_service_mock_1.NotificationServiceMock();
    }
    /**
     * Database operations
     */
    createTransferRecord(input, fee, totalAmount, client, bulkTransferId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transferId = (0, uuid_1.v4)();
            const reference = `TF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const query = `
        INSERT INTO transfers(
        id, reference, sender_account_id, recipient_account_id, recipient_bank_code, recipient_name, recipient_account_number, amount, currency, type, category, fee, total_amount, narration, scheduled_for, bulk_transfer_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
        `;
            const values = [transferId, reference, input.senderAccountId, input.recipientAccountId, input.recipientBankCode, input.recipientName, input.recipientAccountNumber, input.amount, input.currency, input.type, 'SINGLE', fee, totalAmount, input.narration, input.scheduledFor, bulkTransferId, 'PENDING'];
            const result = yield client.query(query, values);
            return result.rows[0];
        });
    }
    createBulkTransferRecord(id, reference, senderAccountId, totalAmount, totalFee, transferCount, transfers, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        INSERT INTO bulk_transfers (
        id, reference, sender_account_id, total_amount, total_fee, transfer_count, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `;
            const values = [id, reference, senderAccountId, totalAmount, totalFee, transferCount, 'PENDING'];
            const result = yield client.query(query, values);
            return Object.assign(Object.assign({}, result.rows[0]), { transfers });
        });
    }
    createRecurringTransferRecord(input, nextExecution, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const recurringTransferId = (0, uuid_1.v4)();
            const reference = `RECUR-${Date.now()}`;
            const query = `
        insert INTO recurring_transfers (
        id, reference, sender_account_id, recipient_account_id, recipient_bank_code, recipient_name, recipient_account_number, amount, currency, frequency, next_execution, end_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `;
            const values = [recurringTransferId, reference, input.senderAccountId, input.recipientAccountId, input.recipientBankCode, input.recipientName, input.recipientAccountNumber, input.amount, input.currency, input.frequency, nextExecution, input.endDate, 'ACTIVE'];
            const result = yield client.query(query, values);
            return result.rows[0];
        });
    }
    updateTransferStatus(transferId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        UPDATE transfers
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `;
            yield database_service_1.db.query(query, [status, transferId]);
        });
    }
    completeTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        UPDATE transfers
        SET status = 'COMPLETED',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `;
            yield database_service_1.db.query(query, [transfer.id]);
            //send notification
            yield this.notificationService.sendTransferNotification({ userId: transfer.id, type: 'transfer_sent', transferReference: transfer.reference, amount: transfer.amount, currency: transfer.currency, recipientName: transfer.recipientName });
            logger_service_1.logger.info('Transfer completed successfully', { transferId: transfer.id });
        });
    }
    failTransfer(transfer, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const transferId = typeof transfer === 'string' ? transfer : transfer.id;
            const query = `
        UPDATE transfers
        SET status = 'FAILED',
        failure_reason = $1,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = 2
        `;
            yield database_service_1.db.query(query, [reason, transferId]);
            //Refund if already debited
            if (typeof transfer !== 'string') {
                yield this.accountService.creditAccount(transfer.senderAccountId, transfer.totalAmount, `${transfer.reference}-REFUND`);
            }
            // send failure notification
            if (typeof transfer !== 'string') {
                yield this.notificationService.sendTransferNotification({ userId: transfer.id, type: 'transfer_failed', transferReference: transfer.reference, amount: transfer.amount, currency: transfer.currency, recipientName: transfer.recipientName });
            }
            logger_service_1.logger.error('Transfer failed', { transferId, reason });
        });
    }
    getTransferById(transferId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        SELECT * FROM transfers WHERE id = $1
        `;
            const result = yield database_service_1.db.query(query, [transferId]);
            return result.rows[0] || null;
        });
    }
    //Calculate next extension for recurring transfer
    calculateNextExecution(frequency) {
        const now = new Date();
        switch (frequency) {
            case 'DAILY':
                return new Date(now.setDate(now.getDate() + 1));
            case 'WEEKLY':
                return new Date(now.setDate(now.getDate() + 7));
            case 'MONTHLY':
                return new Date(now.setMonth(now.getMonth() + 1));
            case 'YEARLY':
                return new Date(now.setFullYear(now.getFullYear() + 1));
            default:
                return new Date(now.setDate(now.getDate() + 1));
        }
    }
    // Compliance check
    performComplianceChecks(input) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implementation KYC/AML checks here
            // This would integrate with external compliance services
            const complianceResult = yield this.limitService.checkAMLCompliance({ userId: input.senderAccountId, amount: input.amount, recipientAccountId: input.recipientAccountId, transactionType: input.type });
            if (!complianceResult.approved) {
                throw new Error(`Compliance check failed: ${complianceResult}`);
            }
        });
    }
    recordExternalTransactionReference(transferId, externalReference, processedAt) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        UPDATE transfers
        SET external_reference = $1,
        processed_at = $2
        WHERE id = $3
        `;
            yield database_service_1.db.query(query, [externalReference, processedAt, transferId]);
        });
    }
    // Validate transfer against business rule and compliance
    validateTransfer(input, transactionType) {
        return __awaiter(this, void 0, void 0, function* () {
            //check transaction limits
            yield this.limitService.validateTransferLimits({ userId: input.senderAccountId, amount: input.amount, currency: input.currency, transactionType: transactionType, recipientType: input.type });
            //validate recipient account for intra-bank
            if (input.type === "INTRA_BANK" && input.recipientAccountId) {
                const isValid = yield this.accountService.validateAccounts(input.senderAccountId, input.recipientAccountId);
                if (!isValid) {
                    throw new Error('Invalid recipient account');
                }
            }
            //Additional compliance checks
            yield this.performComplianceChecks(input);
        });
    }
    //Idempotency management
    checkIdempotency(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_service_1.redis.get(`idempotency:${key}`);
        });
    }
    storeIdempotency(key, data) {
        return __awaiter(this, void 0, void 0, function* () {
            //store for 24 hours yp prevent duplicates
            yield redis_service_1.redis.set(`idempotency:${key}`, data, 86400);
        });
    }
    //calculate transfer fee based on type and amount
    calculateFee(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseFee = 10; //NGN base fee
            let fee = baseFee;
            //Interbank transfers have higher fees
            if (input.type === 'INTERBANK') {
                fee += 25; //Additional interbank fee
            }
            //Percentage-based fee for larger amounts 
            if (input.amount > 50000) {
                fee += input.amount * 0.001; //0.1% for amounts over 50,000
            }
            //cap fees at a maximum
            return Math.min(fee, 5000);
        });
    }
    // Process intra-bank transfer
    processIntraBankTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.accountService.creditAccount(transfer.recipientAccountId, transfer.amount, transfer.reference);
                //Record transaction for audit trail
                yield this.transactionService.createTransaction({ type: 'transfer', amount: transfer.amount, currency: transfer.currency, senderAccountId: transfer.senderAccountId, recipientAccountId: transfer.recipientAccountId, reference: transfer.reference, metadata: transfer.id });
                return true;
            }
            catch (error) {
                logger_service_1.logger.error('Intra-bank transfer failed', { transferId: transfer.id, error: error instanceof Error ? error.message : 'unknown error' });
                return false;
            }
        });
    }
    // Process interbank transfer using Payment rails
    processInterbankTransfer(transfer, externalReference) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.paymentRailService.processNIPTransfer({ senderAccountNumber: transfer.senderAccountNumber, senderBankCode: transfer.senderBankCode, recipientAccountNumber: transfer.recipientAccountNumber, recipientBankCode: transfer.recipientBankCode, amount: transfer.amount, currency: transfer.currency, reference: transfer.reference, category: 'individual' });
                if (result.success) {
                    // Record external transaction reference
                    yield this.recordExternalTransactionReference(transfer.id, externalReference, result.processedAt);
                    yield this.transactionService.createTransaction({ type: 'transfer', amount: transfer.amount, currency: transfer.currency, senderAccountId: transfer.senderAccountId, recipientAccountId: transfer.recipientAccountId, reference: transfer.reference, metadata: transfer.id });
                    return true;
                }
                else {
                    throw new Error('Payment rail processing failed');
                }
            }
            catch (error) {
                logger_service_1.logger.error('Interbank transfer failed', { transferId: transfer.id, error: error instanceof Error ? error.message : 'Unknowkn error' });
                return false;
            }
        });
    }
    //Queue operations to be implementef with BullMQ
    queueTransferProcessing(trasnferId) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implementation with BullMQ
            logger_service_1.logger.info('Transfer queued for processing', { trasnferId });
        });
    }
    queueBulkTransferProcessing(bulkTransferId) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implementation with BullMQ
            logger_service_1.logger.info('Bulk transfer queued for processing', { bulkTransferId });
        });
    }
    scheduleRecurringTransfer(recurringTransferId) {
        return __awaiter(this, void 0, void 0, function* () {
            //Implementation with BullMQ/node-cron
            logger_service_1.logger.info('Recurring transfer scheduled', { recurringTransferId });
        });
    }
    //Process a single transfer called by job processor
    // @params transferId ID of the transfer to process
    processTranfer(transferId, externalReference) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transfer = yield this.getTransferById(transferId);
                if (!transfer || transfer.status !== 'PENDING') {
                    logger_service_1.logger.warn('Transfer not found or not in pending state', { transferId });
                    return;
                }
                //update status to processing
                yield this.updateTransferStatus(transferId, 'PROCESSING');
                // Debit sender account
                yield this.accountService.debitAccount(transfer.senderAccountId, transfer.amount, transfer.reference);
                let success = false;
                if (transfer.type === 'INTRA_BANK') {
                    //for intrabank transfer - credit recipient account
                    success = yield this.processIntraBankTransfer(transfer);
                }
                else {
                    // for interbank transfer- use payment rail
                    success = yield this.processInterbankTransfer(transfer, externalReference);
                }
                if (success) {
                    yield this.completeTransfer(transfer);
                }
                else {
                    yield this.failTransfer(transfer, 'Transfer processing failed');
                }
            }
            catch (error) {
                logger_service_1.logger.error('Error processing transfer', { transferId, error: error instanceof Error ? error.message : 'Unknown error' });
                yield this.failTransfer(transferId, error instanceof Error ? error.message : 'Processing error');
            }
        });
    }
    /**
     * Create a single transfer
     * @param input transfer creation data
     * @paramm idempotencyKey unique key to prevent duplicate transfers
     * @returns created transfer record
     * @throws {Error} when validation fails, limits exceeded or insufficient funds
     */
    createTransfer(input, idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check idempotency to prevent duplicate transfers
            if (idempotencyKey) {
                const existingTransfer = yield this.checkIdempotency(idempotencyKey);
                if (existingTransfer) {
                    logger_service_1.logger.info('Idempotent transfer request detected, returning existing transfer', {
                        idempotencyKey,
                        transferId: existingTransfer.id
                    });
                    return existingTransfer;
                }
            }
            return yield database_service_1.db.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                // 1. Validate transfer limits and compliance
                yield this.validateTransfer(input, 'bulk');
                // 2. Calculate fees
                const fee = yield this.calculateFee(input);
                const totalAmount = input.amount + fee;
                // 3. Check account balance 
                const senderAccount = yield this.accountService.getAccount(input.senderAccountId);
                if (senderAccount.availableBalance < totalAmount) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                // 4. Create transfer record
                const transfer = yield this.createTransferRecord(input, fee, totalAmount, client);
                // 5. Store idempotency key if provided
                if (idempotencyKey) {
                    yield this.storeIdempotency(idempotencyKey, transfer);
                }
                // 6. Process transfer asynchronously 
                yield this.queueTransferProcessing(transfer.id);
                logger_service_1.logger.info('Transfer created successfully', {
                    transferId: transfer.id,
                    reference: transfer.reference,
                    amount: transfer.amount,
                    type: transfer.type
                });
                return transfer;
            }));
        });
    }
    /**
     * Create bulk transfers for multiple recipient
     * @params input Bulk transfer data
     * @params idempotencyKey Unique key to prevent duplicate bulk transfers
     * @returns created bulk transfer record
     */
    createdBulkTransfer(input, idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (idempotencyKey) {
                const existingBulkTransfer = yield this.checkIdempotency(idempotencyKey);
                if (existingBulkTransfer) {
                    return existingBulkTransfer;
                }
            }
            return yield database_service_1.db.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                const bulkTransferId = (0, uuid_1.v4)();
                const bulkReference = `BULK-${Date.now()}`;
                let totalAmount = 0;
                let totalFee = 0;
                const trasnfers = [];
                //Process each transfer in the bulk request
                for (const transferInput of input.transfers) {
                    const fullInput = Object.assign(Object.assign({}, transferInput), { senderAccountId: input.senderAccountId });
                    //Validate individual transfer
                    yield this.validateTransfer(fullInput, 'single');
                    //calculate fees and totals
                    const fee = yield this.calculateFee(fullInput);
                    const transferTotal = fullInput.amount + fee;
                    totalAmount += fullInput.amount;
                    totalFee += fee;
                    //create transfer record
                    const transfer = yield this.createTransferRecord(fullInput, fee, transferTotal, client, bulkTransferId);
                    trasnfers.push(transfer);
                }
                //check total balance requirement
                const senderAccount = yield this.accountService.getAccount(input.senderAccountId);
                if (senderAccount.availableBalance < (totalAmount + totalFee)) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                //create bulk transfer record
                const bulkTransfer = yield this.createBulkTransferRecord(bulkTransferId, bulkReference, input.senderAccountId, totalAmount, totalFee, trasnfers.length, trasnfers, client);
                if (idempotencyKey) {
                    yield this.storeIdempotency(idempotencyKey, bulkTransfer);
                }
                //Queue bulk transfer processing
                yield this.queueBulkTransferProcessing(bulkTransferId);
                logger_service_1.logger.info('Bulk transfer created successfully', { bulkTransferId, reference: bulkReference, totaltransfers: trasnfers.length, totalAmount });
                return bulkTransfer;
            }));
        });
    }
    /**
     * Create a recurring transfer schedule
     * @param input Recurring transfer configuration
     * @returns created recurring transfer record
     */
    createRecurringTransfer(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_service_1.db.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                //validate the recurring transfer
                yield this.validateTransfer(Object.assign(Object.assign({}, input), { type: input.recipientBankCode ? 'INTERBANK' : 'INTRA_BANK' }), 'single');
                //calculate next execution
                const nextExecution = this.calculateNextExecution(input.frequency);
                //create recurring transfer record
                const recurringTransfer = yield this.createRecurringTransferRecord(input, nextExecution, client);
                //schedule the recurring job
                yield this.scheduleRecurringTransfer(recurringTransfer.id);
                logger_service_1.logger.info('Recurring transfer created successfully', { recurringTransferId: recurringTransfer.id, frequency: input.frequency, nextExecution });
                return recurringTransfer;
            }));
        });
    }
}
exports.TransferService = TransferService;
exports.transferService = new TransferService();
