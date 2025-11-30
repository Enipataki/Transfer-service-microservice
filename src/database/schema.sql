--Transfer service Database Schema

--Transfers table
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) UNIQUE NOT NULL,
    sender_account_id UUID NOT NULL,
    sender_account_number VARCHAR(20),
    sender_bank_code VARCHAR(10),
    recipient_account_id UUID,
    recipient_bank_code VARCHAR(10),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_account_number VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    type VARCHAR(20) NOT NULL CHECK (type in ('INTRA_BANK', 'INTERBANK')),
    category VARCHAR(20) DEFAULT 'SINGLE' CHECK (category in ('SINGLE', 'BULK', 'RECURRING')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    fee DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    narration TEXT,
    external_reference VARCHAR(100),
    scheduled_for TIMESTAMP,
    processed_at TIMESTAMP,
    failure_reason TEXT,
    bulk_transfer_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Bulk transfers table
CREATE TABLE bulk_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) UNIQUE NOT NULL,
    sender_account_id UUID NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    total_fee DECIMAL(15, 2) NOT NULL,
    transfer_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Recurring transfers table

CREATE TABLE recurring_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) UNIQUE NOT NULL,
    sender_account_id UUID NOT NULL,
    recipient_account_id UUID NOT NULL,
    recipient_bank_code VARCHAR(10),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_account_number VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
    next_execution TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status in ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Idempotency keys table
CREATE TABLE Idempotency_key (
    key VARCHAR(255) PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);
-- Indexes for better performance
CREATE INDEX idx_transfers_sender_account_id ON transfers(sender_account_id);
CREATE INDEX idx_transfers_recipient_account_id ON transfers(recipient_account_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);
CREATE INDEX idx_transfers_reference ON transfers(reference);

CREATE INDEX idx_bulk_transfers_sender_account_id ON bulk_transfers(sender_account_id);

CREATE INDEX idx_recurring_transfers_next_execution ON recurring_transfers(next_execution);
CREATE INDEX idx_recurring_transfers_status ON recurring_transfers(status);


-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Triggers for updated_at
CREATE TRIGGER update_transfers_updated_at
BEFORE UPDATE ON transfers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_transfers_updated_at
BEFORE UPDATE ON bulk_transfers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_transfers_updated_at
BEFORE UPDATE ON recurring_transfers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
