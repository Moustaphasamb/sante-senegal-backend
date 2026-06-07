import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { deliveryController } from '../controllers/delivery.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  availableDeliveriesSchema,
  deliveredSchema,
  failedSchema,
} from '../validators/delivery.validators';

const router = Router();

/**
 * GET /deliveries/available
 * Livraisons en recherche de livreur (LIVREUR)
 * ⚠ AVANT /:id/...
 */
router.get(
  '/available',
  authenticate,
  authorize(UserRole.LIVREUR),
  validateQuery(availableDeliveriesSchema),
  deliveryController.available
);

/**
 * GET /deliveries/me
 * Mes courses (livreur) — actives + historique
 * ⚠ AVANT /:id/...
 */
router.get('/me', authenticate, authorize(UserRole.LIVREUR), deliveryController.mine);

/**
 * POST /deliveries/:id/accept      (livreur)
 */
router.post('/:id/accept', authenticate, authorize(UserRole.LIVREUR), deliveryController.accept);

/**
 * POST /deliveries/:id/picked-up   (livreur)
 */
router.post('/:id/picked-up', authenticate, authorize(UserRole.LIVREUR), deliveryController.pickedUp);

/**
 * POST /deliveries/:id/delivered   (livreur)
 */
router.post(
  '/:id/delivered',
  authenticate,
  authorize(UserRole.LIVREUR),
  validateBody(deliveredSchema),
  deliveryController.delivered
);

/**
 * POST /deliveries/:id/failed      (livreur)
 */
router.post(
  '/:id/failed',
  authenticate,
  authorize(UserRole.LIVREUR),
  validateBody(failedSchema),
  deliveryController.failed
);

/**
 * GET /deliveries/:id/tracking     (patient concerné ou livreur assigné)
 */
router.get('/:id/tracking', authenticate, deliveryController.getTracking);

export { router as deliveryRoutes };
