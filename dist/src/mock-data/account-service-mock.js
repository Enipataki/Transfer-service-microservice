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
exports.accountServiceInstance = exports.AccountServiceMock = void 0;
class AccountServiceMock {
    getAccount(accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Simulate database call
            yield new Promise(resolve => setTimeout(resolve, 50));
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
        });
    }
    debitAccount(accountId, amount, reference) {
        return __awaiter(this, void 0, void 0, function* () {
            const account = yield this.getAccount(accountId);
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
        });
    }
    creditAccount(accountId, amount, reference) {
        return __awaiter(this, void 0, void 0, function* () {
            const account = yield this.getAccount(accountId);
            // Simulate ledger entry
            console.log(`CREDIT: Account ${accountId}, Amount: ${amount}, Ref: ${reference}`);
            return {
                success: true,
                newBalance: account.balance + amount,
                newAvailableBalance: account.availableBalance + amount,
                transactionId: `ledger-${Date.now()}`
            };
        });
    }
    validateAccounts(senderAccountId, recipientAccountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [sender, recipient] = yield Promise.all([
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
        });
    }
}
exports.AccountServiceMock = AccountServiceMock;
exports.accountServiceInstance = new AccountServiceMock();
