import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  initiatePaymentSchema,
  paymentWebhookSchema,
  refundSchema,
  listPaymentsSchema,
} from '../validators/payment.validators';

const router = Router();

/**
 * POST /payments/initiate
 * Initier le paiement d'un paiement en attente (payeur)
 */
router.post(
  '/initiate',
  authenticate,
  validateBody(initiatePaymentSchema),
  paymentController.initiate
);

/**
 * POST /payments/wave/webhook
 * Webhook Wave (PUBLIC — vérifié par signature, pas d'auth JWT)
 */
router.post('/wave/webhook', validateBody(paymentWebhookSchema), paymentController.waveWebhook);

/**
 * POST /payments/orange-money/webhook
 * Webhook Orange Money (PUBLIC — vérifié par signature)
 */
router.post(
  '/orange-money/webhook',
  validateBody(paymentWebhookSchema),
  paymentController.orangeMoneyWebhook
);

/**
 * GET /payments/me
 * Mes paiements (en tant que payeur ou bénéficiaire)
 */
router.get('/me', authenticate, validateQuery(listPaymentsSchema), paymentController.list);

/**
 * GET /payments/:id
 * Détail d'un paiement (payeur, bénéficiaire ou admin)
 */
router.get('/:id', authenticate, paymentController.getById);

/**
 * POST /payments/:id/refund
 * Rembourser un paiement (SUPER_ADMIN)
 */
router.post(
  '/:id/refund',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(refundSchema),
  paymentController.refund
);

export { router as paymentRoutes };
