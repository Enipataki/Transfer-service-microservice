export class AccountServiceMock {
    async getAccount(accountId) {
        // Simulate database call
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
            id: accountId,
            accountNumber: `ACC${accountId.slice(-8)}`,
            userId: `user-${accountId.slice(-6)}`,
            balance: 15000.75,
            availableBalance: 14800.25,
            currency: 'NGN',
            type: 'checking',
            status: 'active',
            ledgerBalance: 15000.75,
            holdBalance: 200.50,
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date()
        };
    }
    async debitAccount(accountId, amount, reference) {
        const account = await this.getAccount(accountId);
        if (account.availableBalance < amount) {
            throw new Error('INSUFFICIENT_FUNDS');
        }
        // Simulate ledger entry
        console.log(`DEBIT: Account ${accountId}, Amount: ${amount}, Ref: ${reference}`);
        return {
            success: true,
            newBalance: account.balance - amount,
            newAvailableBalance: account.availableBalance - amount,
            transactionId: `ledger-${Date.now()}`
        };
    }
    async creditAccount(accountId, amount, reference) {
        const account = await this.getAccount(accountId);
        // Simulate ledger entry
        console.log(`CREDIT: Account ${accountId}, Amount: ${amount}, Ref: ${reference}`);
        return {
            success: true,
            newBalance: account.balance + amount,
            newAvailableBalance: account.availableBalance + amount,
            transactionId: `ledger-${Date.now()}`
        };
    }
    async validateAccounts(senderAccountId, recipientAccountId) {
        const [sender, recipient] = await Promise.all([
            this.getAccount(senderAccountId),
            this.getAccount(recipientAccountId)
        ]);
        if (sender.status !== 'active') {
            throw new Error('SENDER_ACCOUNT_INACTIVE');
        }
        if (recipient.status !== 'active') {
            throw new Error('RECIPIENT_ACCOUNT_INACTIVE');
        }
        if (sender.currency !== recipient.currency) {
            throw new Error('CURRENCY_MISMATCH');
        }
        return { sender, recipient, isValid: true };
    }
}
export const accountServiceInstance = new AccountServiceMock();
