import {v4 as uuidv4} from "uuid";
import {db} from "./database-service";
import {redis} from "./redis-service";
import {logger} from "./logger-service";
import {CreateTransferInput, CreateBulkTransferInput, CreateRecurringTransferInput} from "../utils/validation";
import{Transfer, BulkTransfer, RecurringTransfer} from "../models/transfer_model";
import {accountServiceInstance, AccountServiceMock} from "../mock-data/account-service-mock";
import {TransactionServiceMock, transactionServiceInstance} from "../mock-data/transaction-service-mock";
import {NotificationServiceMock, notificationServicInstancee} from "../mock-data/notification-service-mock";
import {paymentRailServiceInstance, PaymentRailServiceMock} from '../mock-data/payment-rail-service-mock'
import {limitServiceInstance, LimitServiceMock} from '../mock-data/limit-service-mock'
import { singleTransferQueue } from "../queues/single-transfer-queue";


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


export class TransferService {
    private accountService: AccountServiceMock
    private transactionService: TransactionServiceMock
    private limitService: LimitServiceMock;
    private paymentRailService: PaymentRailServiceMock;
    private notificationService: NotificationServiceMock;

    constructor() {
        this.accountService = new AccountServiceMock();
        this.transactionService = new TransactionServiceMock();
        this.limitService = new LimitServiceMock();
        this.paymentRailService = new PaymentRailServiceMock();
        this.notificationService = new NotificationServiceMock()
    }

    /**
     * Database operations
     */

    private async createTransferRecord(input: CreateTransferInput, fee: number, totalAmount: number, client: any, bulkTransferId?: string): Promise<Transfer> {
        const transferId = uuidv4();
        const reference = `TF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const query = `
        INSERT INTO transfers(
        id, reference, sender_account_id, recipient_account_id, recipient_bank_code, recipient_name, recipient_account_number, amount, currency, type, category, fee, total_amount, narration, scheduled_for, bulk_transfer_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
        `;

        const values = [transferId, reference, input.senderAccountId, input.recipientAccountId, input.recipientBankCode, input.recipientName, input.recipientAccountNumber, input.amount, input.currency, input.type, 'SINGLE', fee, totalAmount, input.narration, input.scheduledFor, bulkTransferId, 'PENDING'];

        const result = await client.query(query, values);
        return result.rows[0]
    }

    private async createBulkTransferRecord(id:string, reference:string, senderAccountId: string, totalAmount: number, totalFee: number, transferCount: number, transfers: Transfer[], client: any) : Promise<BulkTransfer> {
        const query = `
        INSERT INTO bulk_transfers (
        id, reference, sender_account_id, total_amount, total_fee, transfer_count, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `;

        const values = [id, reference, senderAccountId, totalAmount, totalFee, transferCount, 'PENDING'];

        const result = await client.query(query, values)
        return {...result.rows[0], transfers}
    }

    private async createRecurringTransferRecord(input: CreateRecurringTransferInput, nextExecution: Date, client: any): Promise<RecurringTransfer> {
        const recurringTransferId = uuidv4();
        const reference = `RECUR-${Date.now()}`;

        const query = `
        insert INTO recurring_transfers (
        id, reference, sender_account_id, recipient_account_id, recipient_bank_code, recipient_name, recipient_account_number, amount, currency, frequency, next_execution, end_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `;

        const values = [recurringTransferId, reference, input.senderAccountId, input.recipientAccountId!, input.recipientBankCode!, input.recipientName, input.recipientAccountNumber, input.amount, input.currency, input.frequency, nextExecution, input.endDate!, 'ACTIVE'];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    private async updateTransferStatus(transferId: string, status:Transfer['status']): Promise<void> {
        const query = `
        UPDATE transfers
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `;

        await db.query(query, [status, transferId]);
    }

    private async completeTransfer(transfer:Transfer): Promise<void> {
        const query = `
        UPDATE transfers
        SET status = 'COMPLETED',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `;

        await db.query(query, [transfer.id])

        //send notification
        await this.notificationService.sendTransferNotification({userId: transfer.id, type: 'transfer_sent', transferReference: transfer.reference, amount: transfer.amount, currency: transfer.currency, recipientName: transfer.recipientName})

        logger.info('Transfer completed successfully', {transferId: transfer.id})
    }

    private async failTransfer(transfer: string | Transfer, reason: string): Promise<void> {
        const transferId = typeof transfer === 'string' ? transfer : transfer.id;
        const query = `
        UPDATE transfers
        SET status = 'FAILED',
        failure_reason = $1,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `;

        await db.query(query, [reason, transferId]);

        //Refund if already debited
        if (typeof transfer !== 'string') {
            await this.accountService.creditAccount(transfer.senderAccountId, transfer.totalAmount, `${transfer.reference}-REFUND`);
        }
        // send failure notification
        if (typeof transfer !== 'string') {
            await this.notificationService.sendTransferNotification({userId: transfer.id, type: 'transfer_failed', transferReference: transfer.reference, amount: transfer.amount, currency: transfer.currency, recipientName: transfer.recipientName});
        }

        logger.error('Transfer failed', {transferId, reason});
    }

    private async getTransferById(transferId: string): Promise<Transfer | null> {
        const query = `
        SELECT * FROM transfers WHERE id = $1
        `;
        const result = await db.query(query, [transferId]);
        return result.rows[0] || null;
    }

    //Calculate next extension for recurring transfer
    private calculateNextExecution(frequency: string): Date {
        const now = new Date();
        switch(frequency) {
            case 'DAILY':
                return new Date(now.setDate(now.getDate() + 1));
            case 'WEEKLY':
                return new Date(now.setDate(now.getDate() + 7))
            case 'MONTHLY':
                return new Date(now.setMonth(now.getMonth() + 1));
            case 'YEARLY':
                return new Date(now.setFullYear(now.getFullYear() + 1));
            default:
                return new Date(now.setDate(now.getDate() + 1));                
        }
    }


    // Compliance check
    private async performComplianceChecks(input: CreateTransferInput): Promise <void> {
        //Implementation KYC/AML checks here
        // This would integrate with external compliance services
        const complianceResult = await this.limitService.checkAMLCompliance({userId: input.senderAccountId, amount: input.amount, recipientAccountId: input.recipientAccountId!, transactionType: input.type});

        if (!complianceResult.approved) {
            throw new Error(`Compliance check failed: ${complianceResult}`)
        }
    }

    private async recordExternalTransactionReference(transferId: string, externalReference: string, processedAt?: Date): Promise<void> {
        const query = `
        UPDATE transfers
        SET external_reference = $1,
        processed_at = $2
        WHERE id = $3
        `;

        await db.query(query, [externalReference, processedAt, transferId])
    }


    // Validate transfer against business rule and compliance
    private async validateTransfer(input: CreateTransferInput, transactionType: 'single' | 'bulk' | 'recurring'): Promise<void> {
        //check transaction limits
        //await this.limitService.validateTransferLimits({userId: input.senderAccountId, amount: input.amount, currency: input.currency, transactionType: transactionType, recipientType: input.type});

        //validate recipient account for intra-bank
        if(input.type === "INTRA_BANK" && input.recipientAccountId) {
            const isValid = await this.accountService.validateAccounts(input.senderAccountId, input.recipientAccountId);
            if (!isValid) {
                throw new Error('Invalid recipient account');
            }
        }

        //Additional compliance checks
        await this.performComplianceChecks(input)
    }


    //calculate transfer fee based on type and amount
    private async calculateFee(input: CreateTransferInput): Promise<number> {
        const baseFee = 10; //NGN base fee
        let fee = baseFee

        //Interbank transfers have higher fees
        if (input.type === 'INTERBANK') {
            fee += 25; //Additional interbank fee
        }

        //Percentage-based fee for larger amounts 
        if (input.amount > 50000) {
            fee += input.amount * 0.001; //0.1% for amounts over 50,000
        }

        //cap fees at a maximum
        return Math.min(fee, 5000)
    }

    // Process intra-bank transfer
    private async processIntraBankTransfer(transfer: Transfer): Promise<boolean> {
        try {
            await this.accountService.creditAccount(transfer.recipientAccountId!, transfer.amount, transfer.reference);

            //Record transaction for audit trail
            await this.transactionService.createTransaction({type: 'transfer', amount: transfer.amount, currency: transfer.currency, senderAccountId: transfer.senderAccountId, recipientAccountId: transfer.recipientAccountId, reference: transfer.reference, metadata: transfer.id})

            return true
        } catch (error) {
            logger.error('Intra-bank transfer failed', {transferId: transfer.id, error: error instanceof Error ? error.message : 'unknown error'});
            return false;
        }
    }

    // Process interbank transfer using Payment rails
    private async processInterbankTransfer(transfer: Transfer, externalReference: string): Promise<boolean> {
        try {
            const result = await this.paymentRailService.processNIPTransfer({senderAccountNumber: transfer.senderAccountNumber!, senderBankCode: transfer.senderBankCode!, recipientAccountNumber: transfer.recipientAccountNumber, recipientBankCode: transfer.recipientBankCode!, amount: transfer.amount, currency: transfer.currency, reference: transfer.reference, category: 'individual'});
            if (result.success) {
                // Record external transaction reference
                await this.recordExternalTransactionReference(transfer.id, externalReference, result.processedAt);
                await this.transactionService.createTransaction({type: 'transfer', amount: transfer.amount, currency: transfer.currency, senderAccountId: transfer.senderAccountId, recipientAccountId: transfer.recipientAccountId, reference: transfer.reference, metadata: transfer.id});
                return true;
            } else {
                throw new Error('Payment rail processing failed');
            }
        } catch (error) {
            logger.error('Interbank transfer failed', {transferId: transfer.id, error: error instanceof Error ? error.message : 'Unknowkn error'});
            return false;
        }
    }

    //Queue operations to be implementef with BullMQ
    private async queueTransferProcessing(transferId: string): Promise<void> {
        //Implementation with BullMQ
        await singleTransferQueue.addTransferJob(transferId);

        logger.info('Transfer queued for processing', {transferId});
    }

    private async queueBulkTransferProcessing(bulkTransferId: string): Promise<void> {
        //Implementation with BullMQ
        logger.info('Bulk transfer queued for processing', {bulkTransferId});
    }

    private async scheduleRecurringTransfer(recurringTransferId: string): Promise<void> {
        //Implementation with BullMQ/node-cron
        logger.info('Recurring transfer scheduled', {recurringTransferId})
    }

    //Process a single transfer called by job processor
    // @params transferId ID of the transfer to process

    async processTransfer(transferId: string, externalReference?: string): Promise<void> {
        try {
            const transfer = await this.getTransferById(transferId);
            if (!transfer || transfer.status !== 'PENDING'){
                logger.warn('Transfer not found or not in pending state', {transferId});
                return;
            }
            //update status to processing
            await this.updateTransferStatus(transferId, 'PROCESSING');
            // Debit sender account
            await this.accountService.debitAccount(transfer.senderAccountId, transfer.amount, transfer.reference);
            let success = false;
            if (transfer.type === 'INTRA_BANK') {
                //for intrabank transfer - credit recipient account
                success = await this.processIntraBankTransfer(transfer);
            } else {
                // for interbank transfer- use payment rail
                success = await this.processInterbankTransfer(transfer, externalReference!)
            }

            if (success) {
                await this.completeTransfer(transfer)
            } else {
                await this.failTransfer(transfer, 'Transfer processing failed');
            }
        } catch (error) {
            logger.error('Error processing transfer', {transferId, error: error instanceof Error ? error.message : 'Unknown error'});
            await this.failTransfer(transferId, error instanceof Error ? error.message : 'Processing error');
        }
    }

    /**
     * Create a single transfer
     * @param input transfer creation data
     * @returns created transfer record
     * @throws {Error} when validation fails, limits exceeded or insufficient funds
     */

    async createTransfer(input: CreateTransferInput): Promise<Transfer> {

    return await db.transaction(async (client) => {
        // 1. Validate transfer limits and compliance
        await this.validateTransfer(input, 'single');

        // 2. Calculate fees
        const fee = await this.calculateFee(input);
        const totalAmount = input.amount + fee;

        // 3. Check account balance 
        const senderAccount = await this.accountService.getAccount(input.senderAccountId);
        if (senderAccount.availableBalance < totalAmount) {
            throw new Error('INSUFFICIENT_FUNDS');
        }

        // 4. Create transfer record
        const transfer = await this.createTransferRecord(input, fee, totalAmount, client);

        // 5. Process transfer asynchronously 
        await this.queueTransferProcessing(transfer.id);

        logger.info('Transfer created successfully', { 
            transferId: transfer.id, 
            reference: transfer.reference, 
            amount: transfer.amount, 
            type: transfer.type 
        });
        
        return transfer;
    });
}

/**
 * Create bulk transfers for multiple recipient
 * @params input Bulk transfer data
 * @returns created bulk transfer record
 */

async createBulkTransfer(input: CreateBulkTransferInput): Promise<BulkTransfer> {
    
    return await db.transaction(async(client) => {
        const bulkTransferId = uuidv4();
        const bulkReference = `BULK-${Date.now()}`;

        let totalAmount = 0;
        let totalFee = 0;
        const transfers: Transfer[] = [];

        //Process each transfer in the bulk request
        for (const transferInput of input.transfers) {
            const fullInput = {
                ...transferInput, senderAccountId: input.senderAccountId
            };
            //Validate individual transfer
            await this.validateTransfer(fullInput, 'bulk');
            //calculate fees and totals
            const fee = await this.calculateFee(fullInput);
            const transferTotal = fullInput.amount + fee;
            totalAmount += fullInput.amount;
            totalFee += fee;

            //create transfer record
            const transfer = await this.createTransferRecord(fullInput, fee, transferTotal, client, bulkTransferId);

            transfers.push(transfer);
        }
        //check total balance requirement
        const senderAccount = await this.accountService.getAccount(input.senderAccountId);
        if (senderAccount.availableBalance < (totalAmount + totalFee)) {
            throw new Error('INSUFFICIENT_FUNDS');
        }

        //create bulk transfer record
        const bulkTransfer = await this.createBulkTransferRecord(bulkTransferId, bulkReference, input.senderAccountId, totalAmount, totalFee, transfers.length, transfers, client);

        //Queue bulk transfer processing
        await this.queueBulkTransferProcessing(bulkTransferId);

        logger.info('Bulk transfer created successfully', {bulkTransferId, reference: bulkReference, totaltransfers: transfers.length, totalAmount});

        return bulkTransfer
    })
}

/**
 * Create a recurring transfer schedule
 * @param input Recurring transfer configuration
 * @returns created recurring transfer record
 */

async createRecurringTransfer(input: CreateRecurringTransferInput): Promise<RecurringTransfer> {
    return await db.transaction(async(client) => {
        //validate the recurring transfer
        await this.validateTransfer({...input, type: input.recipientBankCode? 'INTERBANK' : 'INTRA_BANK'}, 'recurring');

        //calculate next execution
        const nextExecution = this.calculateNextExecution(input.frequency);

        //create recurring transfer record
        const recurringTransfer = await this.createRecurringTransferRecord(input, nextExecution, client);

        //schedule the recurring job
        await this.scheduleRecurringTransfer(recurringTransfer.id);

        logger.info('Recurring transfer created successfully', {recurringTransferId: recurringTransfer.id, frequency: input.frequency, nextExecution});

        return recurringTransfer;
    })
}


    
}

export const transferService = new TransferService();