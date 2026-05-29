import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { medicalRecordController } from '../controllers/medical-record.controller';
import { authenticate, authorize, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { uploadDocumentMiddleware } from '../middleware/upload.middleware';
import {
  updateMedicalRecordSchema,
  addAllergySchema,
  addChronicConditionSchema,
  uploadMedicalDocSchema,
  createShareTokenSchema,
  accessByTokenSchema,
} from '../validators/medical-record.validators';

const router = Router();

// ─── Routes patient ───────────────────────────────────────────────
// ⚠️ /me/* et /access/* doivent être déclarés AVANT /:patientId

/**
 * GET /medical-records/me
 * Consulter son propre DME (auto-créé si absent)
 */
router.get(
  '/me',
  authenticate,
  authorize(UserRole.PATIENT),
  medicalRecordController.getMyDme
);

/**
 * PATCH /medical-records/me
 * Mettre à jour infos générales du DME + bloodGroup (PatientProfile)
 */
router.patch(
  '/me',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(updateMedicalRecordSchema),
  medicalRecordController.updateMyDme
);

/**
 * POST /medical-records/me/allergies
 * Ajouter une allergie au DME
 */
router.post(
  '/me/allergies',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(addAllergySchema),
  medicalRecordController.addAllergy
);

/**
 * POST /medical-records/me/chronic-conditions
 * Ajouter une maladie chronique au DME
 */
router.post(
  '/me/chronic-conditions',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(addChronicConditionSchema),
  medicalRecordController.addChronicCondition
);

/**
 * POST /medical-records/me/documents
 * Uploader un document médical (multipart/form-data)
 * Champs : document (fichier) + title + category + notes?
 */
router.post(
  '/me/documents',
  authenticate,
  authorize(UserRole.PATIENT),
  uploadDocumentMiddleware,
  validateBody(uploadMedicalDocSchema),
  medicalRecordController.uploadDocument
);

/**
 * POST /medical-records/me/share-token
 * Générer un token QR de partage (durée : 1h, 24h, 7d, unlimited)
 */
router.post(
  '/me/share-token',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(createShareTokenSchema),
  medicalRecordController.createShareToken
);

/**
 * DELETE /medical-records/me/share-tokens/:id
 * Révoquer un token de partage
 */
router.delete(
  '/me/share-tokens/:id',
  authenticate,
  authorize(UserRole.PATIENT),
  medicalRecordController.revokeShareToken
);

// ─── Routes médecin ───────────────────────────────────────────────

/**
 * POST /medical-records/access
 * Accéder au DME d'un patient via son token QR (médecin)
 * Token passé dans le body (jamais dans l'URL pour éviter les logs)
 * Body: { token: string }
 */
router.post(
  '/access',
  authenticate,
  authorizeAnyMedecin,
  validateBody(accessByTokenSchema),
  medicalRecordController.accessByToken
);

/**
 * GET /medical-records/:patientId
 * Accéder au DME d'un patient (médecin avec token valide préexistant)
 */
router.get(
  '/:patientId',
  authenticate,
  authorizeAnyMedecin,
  medicalRecordController.getDmeByPatient
);

export { router as medicalRecordRoutes };
