import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { pharmacyOrderController } from '../controllers/pharmacy-order.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createPharmacyOrderSchema,
  listPharmacyOrdersSchema,
  orderReasonSchema,
} from '../validators/pharmacy-order.validators';

const router = Router();

/**
 * POST /pharmacy-orders
 * Créer une commande (patient)
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(createPharmacyOrderSchema),
  pharmacyOrderController.create
);

/**
 * GET /pharmacy-orders/me
 * Mes commandes (patient = passées, pharmacien = reçues)
 */
router.get(
  '/me',
  authenticate,
  validateQuery(listPharmacyOrdersSchema),
  pharmacyOrderController.list
);

/**
 * GET /pharmacy-orders/:id
 * Détail (patient concerné, pharmacien de la pharmacie, admin)
 */
router.get('/:id', authenticate, pharmacyOrderController.getById);

/**
 * POST /pharmacy-orders/:id/accept   (pharmacien)
 */
router.post('/:id/accept', authenticate, authorize(UserRole.PHARMACIEN), pharmacyOrderController.accept);

/**
 * POST /pharmacy-orders/:id/refuse   (pharmacien)
 */
router.post(
  '/:id/refuse',
  authenticate,
  authorize(UserRole.PHARMACIEN),
  validateBody(orderReasonSchema),
  pharmacyOrderController.refuse
);

/**
 * POST /pharmacy-orders/:id/ready    (pharmacien)
 */
router.post('/:id/ready', authenticate, authorize(UserRole.PHARMACIEN), pharmacyOrderController.ready);

/**
 * POST /pharmacy-orders/:id/complete (pharmacien)
 */
router.post('/:id/complete', authenticate, authorize(UserRole.PHARMACIEN), pharmacyOrderController.complete);

/**
 * PATCH /pharmacy-orders/:id/cancel  (patient ou pharmacien)
 */
router.patch(
  '/:id/cancel',
  authenticate,
  authorize(UserRole.PATIENT, UserRole.PHARMACIEN),
  validateBody(orderReasonSchema),
  pharmacyOrderController.cancel
);

export { router as pharmacyOrderRoutes };
