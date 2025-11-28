"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRecurringTransferSchema = exports.CreateBulkTransferSchema = exports.CreateTransferSchema = void 0;
const zod_1 = require("zod");
exports.CreateTransferSchema = zod_1.z.object({
    senderAccountId: zod_1.z.uuid(),
    senderAccountNumber: zod_1.z.string().min(10).max(20).optional(),
    senderBankCode: zod_1.z.string().optional(),
    recipientAccountId: zod_1.z.uuid().optional(),
    recipientBankCode: zod_1.z.string().optional(),
    recipientName: zod_1.z.string().min(1).max(255),
    recipientAccountNumber: zod_1.z.string().min(10).max(20),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default('NGN'),
    type: zod_1.z.enum(['INTRA_BANK', 'INTERBANK']),
    narration: zod_1.z.string().max(140).optional(),
    scheduledFor: zod_1.z.iso.datetime().optional()
});
exports.CreateBulkTransferSchema = zod_1.z.object({
    senderAccountId: zod_1.z.uuid(),
    transfers: zod_1.z.array(exports.CreateTransferSchema.omit({
        senderAccountId: true
    })).min(1).max(100)
});
exports.CreateRecurringTransferSchema = zod_1.z.object({
    senderAccountId: zod_1.z.uuid(),
    recipientAccountId: zod_1.z.uuid().optional(),
    recipientBankCode: zod_1.z.string().optional(),
    recipientName: zod_1.z.string().min(1).max(255),
    recipientAccountNumber: zod_1.z.string().min(10).max(20),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default('NGN'),
    frequency: zod_1.z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    endDate: zod_1.z.iso.datetime().optional(),
    narration: zod_1.z.string().max(140).optional()
});
