export class NotificationServiceMock {
    async sendTransferNotification(notificationData) {
        // Simulate notification processing
        await new Promise(resolve => setTimeout(resolve, 80));
        const notificationId = `notif-${Date.now()}`;
        const templates = {
            transfer_sent: {
                title: 'Transfer Sent Successfully',
                message: `You successfully sent ${notificationData.currency} ${notificationData.amount} to ${notificationData.recipientName}. Reference: ${notificationData.transferReference}`
            },
            transfer_received: {
                title: 'Funds Received',
                message: `You received ${notificationData.currency} ${notificationData.amount} from ${notificationData.senderName}. Reference: ${notificationData.transferReference}`
            },
            transfer_failed: {
                title: 'Transfer Failed',
                message: `Your transfer of ${notificationData.currency} ${notificationData.amount} failed. Reason: ${notificationData.failureReason}. Reference: ${notificationData.transferReference}`
            },
            transfer_pending: {
                title: 'Transfer Processing',
                message: `Your transfer of ${notificationData.currency} ${notificationData.amount} is being processed. Reference: ${notificationData.transferReference}`
            }
        };
        const template = templates[notificationData.type];
        const notification = {
            id: notificationId,
            userId: notificationData.userId,
            type: notificationData.type,
            title: template.title,
            message: template.message,
            channels: ['email', 'sms', 'push'], // Multiple channels as per banking standards
            status: 'delivered',
            data: notificationData,
            createdAt: new Date()
        };
        // Log for monitoring (as per documentation requirements)
        console.log(`NOTIFICATION: ${notificationData.type} sent to user ${notificationData.userId}`);
        // Simulate actual notification delivery
        console.log(`📧 Email: ${template.title} - ${template.message}`);
        console.log(`📱 SMS: ${template.message}`);
        console.log(`🔔 Push: ${template.title}`);
        return notification;
    }
    async sendBulkTransferNotification(bulkTransferData) {
        const notification = {
            id: `bulk-notif-${Date.now()}`,
            title: 'Bulk Transfer Completed',
            message: `Your bulk transfer batch ${bulkTransferData.batchId} has been processed. Successful: ${bulkTransferData.successfulTransfers}, Failed: ${bulkTransferData.failedTransfers}, Total Amount: ${bulkTransferData.currency} ${bulkTransferData.totalAmount}`,
            type: 'bulk_transfer_completed',
            channels: ['email'],
            status: 'delivered',
            data: bulkTransferData,
            createdAt: new Date()
        };
        console.log(`BULK_NOTIFICATION: Batch ${bulkTransferData.batchId} completed`);
        return notification;
    }
}
export const notificationServicInstancee = new NotificationServiceMock();
