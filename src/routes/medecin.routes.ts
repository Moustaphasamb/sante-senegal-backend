import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { medecinController } from '../controllers/medecin.controller';
import { authenticate, authorize, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { uploadDocumentMiddleware } from '../middleware/upload.middleware';
import {
  listMedecinsSchema,
  nearbyMedecinsSchema,
  updateMedecinProfileSchema,
  uploadDocumentSchema,
  updateLocationSchema,
  setScheduleSchema,
  rejectKycSchema,
} from '../validators/medecin.validators';

const router = Router();

// ─── Routes publiques ────────────────────────────────────────────

/**
 * GET /medecins
 * Liste paginée avec filtres (public)
 */
router.get('/', validateQuery(listMedecinsSchema), medecinController.list);

/**
 * GET /medecins/nearby?lat=X&lng=Y&radius=10
 * Médecins libéraux mobiles disponibles dans un rayon (public)
 * ⚠️ Avant /:id pour éviter le conflit de paramètre
 */
router.get('/nearby', validateQuery(nearbyMedecinsSchema), medecinController.nearby);

// ─── Routes médecin connecté (toujours avant /:id) ───────────────

/**
 * GET /medecins/me
 * Profil complet du médecin connecté (avec docs KYC)
 */
router.get('/me', authenticate, authorizeAnyMedecin, medecinController.getMyProfile);

/**
 * PATCH /medecins/me
 * Modifier son profil médecin
 */
router.patch(
  '/me',
  authenticate,
  authorizeAnyMedecin,
  validateBody(updateMedecinProfileSchema),
  medecinController.updateProfile
);

/**
 * POST /medecins/me/documents
 * Uploader un document KYC (multipart/form-data)
 * Champs : document (fichier) + documentType (diploma|cni|orderCard)
 */
router.post(
  '/me/documents',
  authenticate,
  authorizeAnyMedecin,
  uploadDocumentMiddleware,
  validateBody(uploadDocumentSchema),
  medecinController.uploadDocument
);

/**
 * POST /medecins/me/mobile/toggle
 * Activer/désactiver la disponibilité libérale mobile (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/me/mobile/toggle',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  medecinController.toggleMobile
);

/**
 * POST /medecins/me/location
 * Mettre à jour sa position GPS (MEDECIN_LIBERAL_MOBILE)
 */
router.post(
  '/me/location',
  authenticate,
  authorize(UserRole.MEDECIN_LIBERAL_MOBILE),
  validateBody(updateLocationSchema),
  medecinController.updateLocation
);

/**
 * GET /medecins/me/schedule
 * Consulter son planning hebdomadaire
 */
router.get('/me/schedule', authenticate, authorizeAnyMedecin, medecinController.getSchedule);

/**
 * POST /medecins/me/schedule
 * Définir/mettre à jour son planning (tableau de jours, upsert)
 */
router.post(
  '/me/schedule',
  authenticate,
  authorizeAnyMedecin,
  validateBody(setScheduleSchema),
  medecinController.setSchedule
);

// ─── Routes admin ─────────────────────────────────────────────────

/**
 * POST /medecins/admin/:id/approve-kyc
 * Approuver le KYC d'un médecin (SUPER_ADMIN)
 */
router.post(
  '/admin/:id/approve-kyc',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  medecinController.approveKyc
);

/**
 * POST /medecins/admin/:id/reject-kyc
 * Rejeter le KYC d'un médecin avec raison (SUPER_ADMIN)
 */
router.post(
  '/admin/:id/reject-kyc',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(rejectKycSchema),
  medecinController.rejectKyc
);

// ─── Route publique par ID (toujours en dernier) ─────────────────

/**
 * GET /medecins/:id
 * Profil public d'un médecin
 */
router.get('/:id', medecinController.getPublicProfile);

export { router as medecinRoutes };
