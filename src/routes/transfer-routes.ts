import {Router} from "express";
import {transferController} from '../controller/transfer-controller';

/**
 * Transfer Routes
 * Define all HTTP endpoints for transfer operations
 * Include proper middleware and validation
 */


class TransferRoutes {
    public router: Router;
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        //Health check
        this.router.get('/health', transferController.healthCheck);

        //single transfer operations
        this.router.post('/', transferController.createTransfer);
        this.router.get('/:id', transferController.getTransfer);
        this.router.get('/:id/status', transferController.getTransferStatus);
        this.router.post('/:id/cancel', transferController.cancelTransfer);

        //Bulk transfer operations
        this.router.post('/bulk', transferController.createBulkTransfer);

        //Recurring transfer operations
        this.router.post('/recurring', transferController.createRecurringTransfer);
    }

    /**
     * Get the router instance
     */
    public getRouter(): Router{
        return this.router;
    }

}

export const transferRoutes = new TransferRoutes()