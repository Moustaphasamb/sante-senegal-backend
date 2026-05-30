import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { pharmacyController } from '../controllers/pharmacy.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  listPharmaciesSchema,
  nearbyPharmaciesSchema,
  pharmacyStockQuerySchema,
  updateStockSchema,
} from '../validators/pharmacy.validators';

const router = Router();

/**
 * GET /pharmacies
 * Liste paginée + filtres (ville, région, livraison)
 */
router.get('/', validateQuery(listPharmaciesSchema), pharmacyController.list);

/**
 * GET /pharmacies/nearby?lat=&lng=&radius=
 * Recherche géolocalisée (Haversine)
 * ⚠ AVANT /:id
 */
router.get('/nearby', validateQuery(nearbyPharmaciesSchema), pharmacyController.nearby);

/**
 * GET /pharmacies/on-duty
 * Pharmacies de garde actuellement
 * ⚠ AVANT /:id
 */
router.get('/on-duty', pharmacyController.onDuty);

/**
 * POST /pharmacies/me/stock
 * Mettre à jour le stock de sa pharmacie (pharmacien)
 * ⚠ AVANT /:id
 */
router.post(
  '/me/stock',
  authenticate,
  authorize(UserRole.PHARMACIEN),
  validateBody(updateStockSchema),
  pharmacyController.updateStock
);

/**
 * GET /pharmacies/:id
 * Détail d'une pharmacie
 */
router.get('/:id', pharmacyController.getById);

/**
 * GET /pharmacies/:id/stock
 * Stock complet d'une pharmacie (paginé + recherche)
 */
router.get(
  '/:id/stock',
  validateQuery(pharmacyStockQuerySchema),
  pharmacyController.getStock
);

export { router as pharmacyRoutes };
