import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { statsController } from '../controllers/stats.controller';
import { authenticate, authorize, authorizeAnyAdmin } from '../middleware/authenticate';

const router = Router();

/**
 * GET /stats/me
 * Statistiques personnelles (contenu selon le rôle)
 */
router.get('/me', authenticate, statsController.getMyStats);

/**
 * GET /stats/global
 * Statistiques globales de la plateforme (SUPER_ADMIN)
 * ⚠ AVANT /establishment/:id (chemins distincts mais on reste explicite)
 */
router.get('/global', authenticate, authorize(UserRole.SUPER_ADMIN), statsController.getGlobalStats);

/**
 * GET /stats/establishment/:id
 * Statistiques d'un établissement (ADMIN_ETABLISSEMENT de cet établissement, ou SUPER_ADMIN)
 */
router.get(
  '/establishment/:id',
  authenticate,
  authorizeAnyAdmin,
  statsController.getEstablishmentStats
);

export { router as statsRoutes };
