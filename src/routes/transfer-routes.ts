import express from "express";
import {transferController} from '../controller/transfer-controller';

const router = express.Router();

router.get('/health', transferController.healthCheck);
router.post('/', transferController.createTransfer);
router.get('/:id', transferController.getTransfer);
router.get('/:id/status', transferController.getTransferStatus);
router.post('/:id/cancel', transferController.cancelTransfer);
router.post('/bulk', transferController.createBulkTransfer);
router.post('/recurring', transferController.createRecurringTransfer);

export default router;

