export interface Transfer {
    id: string;
    reference: string;
    senderAccountId: string;
    senderAccountNumber?: string;
    senderBankCode?: string;
    recipientAccountId: string;
    recipientBankCode?: string;
    recipientName: string;
    recipientAccountNumber: string;
    amount: number;
    currency: string;
    type: 'INTRA_BANK' | 'INTERBANK';
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    category: 'SINGLE' | 'BULK' | 'RECURRING';
    fee: number;
    totalAmount: number;
    narration?: string;
    scheduledFor?: Date;
    processedAt?: Date;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface BulkTransfer {
    id: string;
    reference: string;
    senderAccountId: string;
    totalAmount: number;
    totalFee: number;
    transferCount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
    transfers: Transfer[];
    createdAt: Date;
    updatedAt: Date;
}

export interface RecurringTransfer {
    id: string;
    reference: string;
    senderAccountId: string;
    recipientAccountId: string;
    recipientBankCode?: string;
    recipientName: string;
    recipientAccountNumber: string;
    amount: number;
    currency: string;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    nextExecution: Date;
    endDate?: Date;
    status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
    createdAt: Date;
    updatedAt: Date;
}