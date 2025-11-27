import { z } from 'zod';
export const CreateTransferSchema = z.object({
    senderAccountId: z.uuid(),
    senderAccountNumber: z.string().min(10).max(20).optional(),
    senderBankCode: z.string().optional(),
    recipientAccountId: z.uuid().optional(),
    recipientBankCode: z.string().optional(),
    recipientName: z.string().min(1).max(255),
    recipientAccountNumber: z.string().min(10).max(20),
    amount: z.number().positive(),
    currency: z.string().default('NGN'),
    type: z.enum(['INTRA_BANK', 'INTERBANK']),
    narration: z.string().max(140).optional(),
    scheduledFor: z.iso.datetime().optional()
});
export const CreateBulkTransferSchema = z.object({
    senderAccountId: z.uuid(),
    transfers: z.array(CreateTransferSchema.omit({
        senderAccountId: true
    })).min(1).max(100)
});
export const CreateRecurringTransferSchema = z.object({
    senderAccountId: z.uuid(),
    recipientAccountId: z.uuid().optional(),
    recipientBankCode: z.string().optional(),
    recipientName: z.string().min(1).max(255),
    recipientAccountNumber: z.string().min(10).max(20),
    amount: z.number().positive(),
    currency: z.string().default('NGN'),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    endDate: z.iso.datetime().optional(),
    narration: z.string().max(140).optional()
});
