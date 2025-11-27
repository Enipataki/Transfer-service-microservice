export class LimitServiceMock {
    userLimits = new Map([
        ['user-123', {
                userId: 'user-123',
                tier: 'gold',
                dailyTransferLimit: 500000, // 500,000 NGN
                weeklyTransferLimit: 2000000, // 2,000,000 NGN
                monthlyTransferLimit: 10000000, // 10,000,000 NGN
                perTransactionLimit: 1000000, // 1,000,000 NGN
                remainingDailyLimit: 350000,
                remainingWeeklyLimit: 1500000,
                remainingMonthlyLimit: 8000000,
                currency: 'NGN',
                kycLevel: 'tier_3',
                limitsLastUpdated: new Date('2024-06-20')
            }],
        ['user-456', {
                userId: 'user-456',
                tier: 'silver',
                dailyTransferLimit: 300000, // 300,000 NGN
                weeklyTransferLimit: 1000000, // 1,000,000 NGN
                monthlyTransferLimit: 5000000, // 5,000,000 NGN
                perTransactionLimit: 500000, // 500,000 NGN
                remainingDailyLimit: 120000,
                remainingWeeklyLimit: 400000,
                remainingMonthlyLimit: 3000000,
                currency: 'NGN',
                kycLevel: 'tier_2',
                limitsLastUpdated: new Date('2024-06-19')
            }]
    ]);
    transactionHistory = new Map();
    async validateTransferLimits(validationData) {
        // Simulate validation processing
        await new Promise(resolve => setTimeout(resolve, 40));
        const userLimit = this.userLimits.get(validationData.userId);
        if (!userLimit) {
            throw new Error('USER_LIMITS_NOT_FOUND');
        }
        // Check per transaction limit
        if (validationData.amount > userLimit.perTransactionLimit) {
            throw new Error(`PER_TRANSACTION_LIMIT_EXCEEDED: Maximum ${userLimit.perTransactionLimit} ${userLimit.currency} per transaction`);
        }
        // Check daily limit
        if (validationData.amount > userLimit.remainingDailyLimit) {
            throw new Error(`DAILY_LIMIT_EXCEEDED: Remaining daily limit is ${userLimit.remainingDailyLimit} ${userLimit.currency}`);
        }
        // Check weekly limit
        if (validationData.amount > userLimit.remainingWeeklyLimit) {
            throw new Error(`WEEKLY_LIMIT_EXCEEDED: Remaining weekly limit is ${userLimit.remainingWeeklyLimit} ${userLimit.currency}`);
        }
        // Check monthly limit
        if (validationData.amount > userLimit.remainingMonthlyLimit) {
            throw new Error(`MONTHLY_LIMIT_EXCEEDED: Remaining monthly limit is ${userLimit.remainingMonthlyLimit} ${userLimit.currency}`);
        }
        // Regulatory limits for inter-bank transfers
        if (validationData.recipientType === 'INTERBANK' && validationData.amount > 10000000) {
            throw new Error('REGULATORY_LIMIT_EXCEEDED: Maximum 10,000,000 NGN for inter-bank transfers');
        }
        return {
            isValid: true,
            limits: userLimit,
            recommended: {
                canProceed: true,
                withinLimits: true,
                nextLimitReset: this.getNextLimitReset(),
                suggestedAmount: validationData.amount <= userLimit.remainingDailyLimit ?
                    validationData.amount : userLimit.remainingDailyLimit
            }
        };
    }
    async updateLimitsAfterTransfer(updateData) {
        const userLimit = this.userLimits.get(updateData.userId);
        if (!userLimit) {
            throw new Error('USER_LIMITS_NOT_FOUND');
        }
        // Update remaining limits
        userLimit.remainingDailyLimit -= updateData.amount;
        userLimit.remainingWeeklyLimit -= updateData.amount;
        userLimit.remainingMonthlyLimit -= updateData.amount;
        userLimit.limitsLastUpdated = new Date();
        // Record transaction for audit
        this.transactionHistory.set(updateData.transactionId, {
            transactionId: updateData.transactionId,
            userId: updateData.userId,
            amount: updateData.amount,
            currency: updateData.currency,
            previousLimits: { ...userLimit },
            newLimits: { ...userLimit },
            timestamp: new Date()
        });
        return {
            success: true,
            updatedLimits: userLimit,
            transactionRecorded: true
        };
    }
    async getUserLimits(userId) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const userLimit = this.userLimits.get(userId);
        if (!userLimit) {
            throw new Error('USER_LIMITS_NOT_FOUND');
        }
        return {
            ...userLimit,
            nextReset: this.getNextLimitReset(),
            utilization: {
                daily: ((userLimit.dailyTransferLimit - userLimit.remainingDailyLimit) / userLimit.dailyTransferLimit) * 100,
                weekly: ((userLimit.weeklyTransferLimit - userLimit.remainingWeeklyLimit) / userLimit.weeklyTransferLimit) * 100,
                monthly: ((userLimit.monthlyTransferLimit - userLimit.remainingMonthlyLimit) / userLimit.monthlyTransferLimit) * 100
            }
        };
    }
    async resetUserLimits(userId, resetType) {
        const userLimit = this.userLimits.get(userId);
        if (!userLimit) {
            throw new Error('USER_LIMITS_NOT_FOUND');
        }
        const now = new Date();
        if (resetType === 'daily' || resetType === 'all') {
            userLimit.remainingDailyLimit = userLimit.dailyTransferLimit;
        }
        if (resetType === 'weekly' || resetType === 'all') {
            userLimit.remainingWeeklyLimit = userLimit.weeklyTransferLimit;
        }
        if (resetType === 'monthly' || resetType === 'all') {
            userLimit.remainingMonthlyLimit = userLimit.monthlyTransferLimit;
        }
        userLimit.limitsLastUpdated = now;
        console.log(`LIMITS_RESET: User ${userId} ${resetType} limits reset at ${now.toISOString()}`);
        return {
            success: true,
            resetType,
            resetAt: now,
            newLimits: userLimit
        };
    }
    async checkAMLCompliance(complianceData) {
        // Simulate AML checks
        await new Promise(resolve => setTimeout(resolve, 100));
        // Mock AML rules
        const amlFlags = [];
        if (complianceData.amount > 5000000) { // 5 million NGN
            amlFlags.push({
                level: 'HIGH',
                rule: 'LARGE_TRANSACTION',
                description: 'Transaction exceeds large transaction reporting threshold',
                requiresReview: true
            });
        }
        if (complianceData.sourceOfFunds === 'unknown') {
            amlFlags.push({
                level: 'MEDIUM',
                rule: 'SOURCE_OF_FUNDS_UNVERIFIED',
                description: 'Source of funds not verified',
                requiresReview: true
            });
        }
        // Simulate random suspicious pattern (5% chance)
        if (Math.random() < 0.05) {
            amlFlags.push({
                level: 'HIGH',
                rule: 'SUSPICIOUS_PATTERN',
                description: 'Transaction matches known suspicious pattern',
                requiresReview: true,
                alert: 'AML_TEAM_REVIEW_REQUIRED'
            });
        }
        return {
            isCompliant: amlFlags.length === 0,
            amlFlags,
            riskScore: amlFlags.length * 25, // Simple risk scoring
            requiresManualReview: amlFlags.some(flag => flag.requiresReview),
            checkedAt: new Date(),
            approved: true
        };
    }
    getNextLimitReset() {
        const now = new Date();
        // Daily reset at midnight
        const dailyReset = new Date(now);
        dailyReset.setDate(dailyReset.getDate() + 1);
        dailyReset.setHours(0, 0, 0, 0);
        // Weekly reset on Sunday midnight
        const weeklyReset = new Date(now);
        weeklyReset.setDate(weeklyReset.getDate() + (7 - weeklyReset.getDay()));
        weeklyReset.setHours(0, 0, 0, 0);
        // Monthly reset on 1st of next month
        const monthlyReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            daily: dailyReset,
            weekly: weeklyReset,
            monthly: monthlyReset
        };
    }
    async getLimitUsageReport(userId, period) {
        const userLimit = await this.getUserLimits(userId);
        const reports = {
            day: {
                period: 'daily',
                limit: userLimit.dailyTransferLimit,
                used: userLimit.dailyTransferLimit - userLimit.remainingDailyLimit,
                remaining: userLimit.remainingDailyLimit,
                utilization: userLimit.utilization.daily
            },
            week: {
                period: 'weekly',
                limit: userLimit.weeklyTransferLimit,
                used: userLimit.weeklyTransferLimit - userLimit.remainingWeeklyLimit,
                remaining: userLimit.remainingWeeklyLimit,
                utilization: userLimit.utilization.weekly
            },
            month: {
                period: 'monthly',
                limit: userLimit.monthlyTransferLimit,
                used: userLimit.monthlyTransferLimit - userLimit.remainingMonthlyLimit,
                remaining: userLimit.remainingMonthlyLimit,
                utilization: userLimit.utilization.monthly
            }
        };
        return reports[period];
    }
}
export const limitServiceInstance = new LimitServiceMock();
