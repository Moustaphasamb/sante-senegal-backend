import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { establishmentController } from '../controllers/establishment.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  listEstablishmentsSchema,
  nearbyEstablishmentsSchema,
  createEstablishmentSchema,
  updateEstablishmentSchema,
} from '../validators/establishment.validators';

const router = Router();

/**
 * GET /establishments
 * Liste paginée avec filtres optionnels (public)
 * Query: page, limit, type, city, region, specialty, hasEmergency, isOpen24_7, search
 */
router.get('/', validateQuery(listEstablishmentsSchema), establishmentController.list);

/**
 * GET /establishments/nearby?lat=X&lng=Y&radius=10
 * Établissements dans un rayon donné, triés par distance (public)
 * ⚠️ Déclaré avant /:id pour éviter le conflit de paramètre
 */
router.get(
  '/nearby',
  validateQuery(nearbyEstablishmentsSchema),
  establishmentController.nearby
);

/**
 * GET /establishments/:id
 * Détail complet d'un établissement (public)
 */
router.get('/:id', establishmentController.getById);

/**
 * POST /establishments
 * Créer un établissement (ADMIN_ÉTABLISSEMENT ou SUPER_ADMIN)
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN_ETABLISSEMENT, UserRole.SUPER_ADMIN),
  validateBody(createEstablishmentSchema),
  establishmentController.create
);

/**
 * PATCH /establishments/:id
 * Modifier un établissement (ADMIN = son établissement, SUPER_ADMIN = tous)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN_ETABLISSEMENT, UserRole.SUPER_ADMIN),
  validateBody(updateEstablishmentSchema),
  establishmentController.update
);

/**
 * DELETE /establishments/:id
 * Désactiver un établissement — soft delete via isActive=false (SUPER_ADMIN seulement)
 */
router.delete('/:id', authenticate, authorize(UserRole.SUPER_ADMIN), establishmentController.remove);

export { router as establishmentRoutes };
