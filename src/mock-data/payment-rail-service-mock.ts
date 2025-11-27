export class PaymentRailServiceMock {
  private nipTransactions = new Map();

  async processNIPTransfer(transferData: {
    senderAccountNumber: string;
    senderBankCode: string;
    recipientAccountNumber: string;
    recipientBankCode: string;
    amount: number;
    currency: string;
    reference: string;
    narration?: string;
    category: 'individual' | 'corporate';
  }) {
    // Simulate NIP API call with realistic delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simulate random failures for testing (3% failure rate)
    if (Math.random() < 0.03) {
      const errorResponse = {
        success: false,
        error: {
          code: '96',
          message: 'System malfunction',
          description: 'Unable to process transfer at this time'
        },
        reference: transferData.reference,
        timestamp: new Date()
      };
      
      throw new Error(`NIP_ERROR_${errorResponse.error.code}: ${errorResponse.error.message}`);
    }

    const sessionId = `NIP${Date.now()}${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    const nipTransactionId = `NIP${Date.now()}`;

    // Calculate NIP fees (based on CBN guidelines)
    const fees = this.calculateNIPFees(transferData.amount, transferData.category);
    
    const nipResponse = {
      id: nipTransactionId,
      sessionId: sessionId,
      status: 'completed',
      reference: transferData.reference,
      senderAccount: transferData.senderAccountNumber,
      recipientAccount: transferData.recipientAccountNumber,
      amount: transferData.amount,
      currency: transferData.currency,
      fees: fees,
      totalDebit: transferData.amount + fees,
      narration: transferData.narration,
      responseCode: '00',
      responseMessage: 'Approved',
      settlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // T+1 settlement
      processedAt: new Date(),
      nipMetadata: {
        channel: 'API',
        category: transferData.category,
        destinationInstitution: transferData.recipientBankCode
      },
      success: true
    };

    this.nipTransactions.set(nipTransactionId, nipResponse);
    
    // Log for compliance (as per NIBSS requirements)
    console.log(`NIP_TRANSACTION: ${sessionId} - ${transferData.amount}${transferData.currency} - ${transferData.reference}`);
    
    return nipResponse;
  }

  private calculateNIPFees(amount: number, category: 'individual' | 'corporate'): number {
    // Simulate NIP fee structure based on CBN guidelines
    if (category === 'individual') {
      if (amount <= 5000) return 10;
      if (amount <= 50000) return 25;
      return 50;
    } else {
      // Corporate fees
      if (amount <= 5000) return 50;
      if (amount <= 50000) return 100;
      return 200;
    }
  }

  async validateNIPAccount(accountNumber: string, bankCode: string) {
    // Simulate NIP account validation
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      isValid: true,
      accountNumber: accountNumber,
      accountName: `NIP_ACCOUNT_${accountNumber.slice(-4)}`,
      bankCode: bankCode,
      bankName: this.getBankName(bankCode),
      kycLevel: 'tier_3',
      status: 'active',
      validatedAt: new Date()
    };
  }

  private getBankName(bankCode: string): string {
    const banks: { [key: string]: string } = {
      '044': 'Access Bank',
      '063': 'Diamond Bank',
      '050': 'Ecobank Nigeria',
      '070': 'Fidelity Bank',
      '011': 'First Bank of Nigeria',
      '214': 'First City Monument Bank',
      '058': 'Guaranty Trust Bank',
      '030': 'Heritage Bank',
      '301': 'Jaiz Bank',
      '082': 'Keystone Bank',
      '014': 'MainStreet Bank',
      '076': 'Polaris Bank',
      '221': 'Stanbic IBTC Bank',
      '232': 'Sterling Bank',
      '032': 'Union Bank of Nigeria',
      '033': 'United Bank for Africa',
      '215': 'Unity Bank',
      '035': 'Wema Bank',
      '057': 'Zenith Bank'
    };
    
    return banks[bankCode] || 'Unknown Bank';
  }

  async getNIPTransactionStatus(sessionId: string) {
    const transactions = Array.from(this.nipTransactions.values());
    const transaction = transactions.find(tx => tx.sessionId === sessionId);
    
    if (!transaction) {
      throw new Error('NIP_TRANSACTION_NOT_FOUND');
    }
    
    return transaction;
  }
}

export const paymentRailServiceInstance = new PaymentRailServiceMock();