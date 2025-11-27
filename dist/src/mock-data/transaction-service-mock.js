export class TransactionServiceMock {
    transactions = new Map();
    async createTransaction(transactionData) {
        // Simulate audit trail creation
        await new Promise(resolve => setTimeout(resolve, 30));
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
            metadata: {
                ...transactionData.metadata,
                auditTrail: {
                    createdBy: 'system',
                    createdAt: new Date(),
                    ipAddress: '192.168.1.1'
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.transactions.set(transactionId, transaction);
        // Log for audit trail (as per documentation requirements)
        console.log(`AUDIT_TRAIL: Transaction ${transactionId} created for transfer ${transactionData.reference}`);
        return transaction;
    }
    async updateTransactionStatus(transactionId, status) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            throw new Error('TRANSACTION_NOT_FOUND');
        }
        transaction.status = status;
        transaction.updatedAt = new Date();
        return transaction;
    }
    async getTransactionHistory(accountId, limit = 50, offset = 0) {
        // Simulate database query
        await new Promise(resolve => setTimeout(resolve, 100));
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
    }
    async generateReceipt(transactionId) {
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
    }
}
export const transactionServiceInstance = new TransactionServiceMock();
