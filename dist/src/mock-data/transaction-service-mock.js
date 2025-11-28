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
exports.transactionServiceInstance = exports.TransactionServiceMock = void 0;
class TransactionServiceMock {
    constructor() {
        this.transactions = new Map();
    }
    createTransaction(transactionData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Simulate audit trail creation
            yield new Promise(resolve => setTimeout(resolve, 30));
            const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const transaction = {
                id: transactionId,
                reference: transactionData.reference,
                type: transactionData.type,
                status: 'completed',
                amount: transactionData.amount,
                currency: transactionData.currency,
                senderAccountId: transactionData.senderAccountId,
                recipientAccountId: transactionData.recipientAccountId,
                description: transactionData.description || 'Funds transfer',
                metadata: Object.assign(Object.assign({}, transactionData.metadata), { auditTrail: {
                        createdBy: 'system',
                        createdAt: new Date(),
                        ipAddress: '192.168.1.1'
                    } }),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.transactions.set(transactionId, transaction);
            // Log for audit trail (as per documentation requirements)
            console.log(`AUDIT_TRAIL: Transaction ${transactionId} created for transfer ${transactionData.reference}`);
            return transaction;
        });
    }
    updateTransactionStatus(transactionId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = this.transactions.get(transactionId);
            if (!transaction) {
                throw new Error('TRANSACTION_NOT_FOUND');
            }
            transaction.status = status;
            transaction.updatedAt = new Date();
            return transaction;
        });
    }
    getTransactionHistory(accountId_1) {
        return __awaiter(this, arguments, void 0, function* (accountId, limit = 50, offset = 0) {
            // Simulate database query
            yield new Promise(resolve => setTimeout(resolve, 100));
            const allTransactions = Array.from(this.transactions.values());
            const accountTransactions = allTransactions.filter(tx => tx.senderAccountId === accountId || tx.recipientAccountId === accountId);
            return {
                transactions: accountTransactions
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(offset, offset + limit),
                total: accountTransactions.length,
                limit,
                offset
            };
        });
    }
    generateReceipt(transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = this.transactions.get(transactionId);
            if (!transaction) {
                throw new Error('TRANSACTION_NOT_FOUND');
            }
            return {
                receiptId: `RCP-${Date.now()}`,
                transaction,
                generatedAt: new Date(),
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${transactionId}`,
                terms: "This is an electronic receipt for your transaction"
            };
        });
    }
}
exports.TransactionServiceMock = TransactionServiceMock;
exports.transactionServiceInstance = new TransactionServiceMock();
