"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferRoutes = void 0;
const express_1 = require("express");
const transfer_controller_1 = require("../controller/transfer-controller");
/**
 * Transfer Routes
 * Define all HTTP endpoints for transfer operations
 * Include proper middleware and validation
 */
class TransferRoutes {
    constructor() {
        this.router = (0, express_1.Router)();
        this.initializeRoutes();
    }
    initializeRoutes() {
        //Health check
        this.router.get('/health', transfer_controller_1.transferController.healthCheck);
        //single transfer operations
        this.router.post('/', transfer_controller_1.transferController.createTransfer);
        this.router.get('/:id', transfer_controller_1.transferController.getTransfer);
        this.router.get('/:id/status', transfer_controller_1.transferController.getTransferStatus);
        this.router.post('/:id/cancel', transfer_controller_1.transferController.cancelTransfer);
        //Bulk transfer operations
        this.router.post('/bulk', transfer_controller_1.transferController.createBulkTransfer);
        //Recurring transfer operations
        this.router.post('/recurring', transfer_controller_1.transferController.createRecurringTransfer);
    }
    /**
     * Get the router instance
     */
    getRouter() {
        return this.router;
    }
}
exports.transferRoutes = new TransferRoutes();
