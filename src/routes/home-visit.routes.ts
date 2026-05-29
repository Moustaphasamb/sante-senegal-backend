import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { homeVisitController } from '../controllers/home-visit.controller';
import { authenticate, authorize, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createHomeVisitSchema,
  listHomeVisitsSchema,
  cancelHomeVisitSchema,
} from '../validators/home-visit.validators';

const router = Router();

// ─── Routes communes (patient + médecin) ─────────────────────────
// ⚠️ /me avant /:id

/**
 * GET /home-visits/me
 * Lister mes visites à domicile (patient ou médecin libéral)
 */
router.get(
  '/me',
  authenticate,
  validateQuery(listHomeVisitsSchema),
  homeVisitController.list
);

// ─── Routes patient ───────────────────────────────────────────────

/**
 * POST /home-visits
 * Demander un médecin à domicile (PATIENT)
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(createHomeVisitSchema),
  homeVisitController.create
);

// ─── Routes médecin libéral ───────────────────────────────────────

/**
 * POST /home-visits/:id/accept
 * Accepter la mission (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/:id/accept',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  homeVisitController.accept
);

/**
 * POST /home-visits/:id/reject
 * Refuser la mission (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  homeVisitController.reject
);

/**
 * POST /home-visits/:id/start-trip
 * Signaler qu'on est en route (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/:id/start-trip',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  homeVisitController.startTrip
);

/**
 * POST /home-visits/:id/arrived
 * Signaler son arrivée sur place (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/:id/arrived',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  homeVisitController.arrived
);

/**
 * POST /home-visits/:id/complete
 * Terminer la visite (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/:id/complete',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  homeVisitController.complete
);

// ─── Annulation (patient ou médecin) ─────────────────────────────

/**
 * PATCH /home-visits/:id/cancel
 * Annuler la visite (patient ou médecin libéral)
 */
router.patch(
  '/:id/cancel',
  authenticate,
  validateBody(cancelHomeVisitSchema),
  homeVisitController.cancel
);

// ─── Détail (en dernier) ──────────────────────────────────────────

/**
 * GET /home-visits/:id
 * Détail d'une visite (patient ou médecin impliqué)
 */
router.get('/:id', authenticate, homeVisitController.getById);

export { router as homeVisitRoutes };
