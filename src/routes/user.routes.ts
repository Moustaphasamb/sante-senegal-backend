import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { uploadPhotoMiddleware } from '../middleware/upload.middleware';
import {
  updateUserProfileSchema,
  createEmergencyContactSchema,
  updateEmergencyContactSchema,
} from '../validators/user.validators';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// PROFIL UTILISATEUR CONNECTÉ
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/users/me
 * Auth requise
 * Retourne le profil complet de l'utilisateur connecté (avec profil rôle-spécifique)
 */
router.get('/me', authenticate, userController.getMe);

/**
 * PATCH /api/v1/users/me
 * Auth requise
 * Body: champs User + champs PatientProfile (pour patients)
 */
router.patch(
  '/me',
  authenticate,
  validateBody(updateUserProfileSchema),
  userController.updateProfile
);

/**
 * POST /api/v1/users/me/photo
 * Auth requise
 * Body: multipart/form-data — champ "photo" (JPEG, PNG, WebP — max 5 Mo)
 */
router.post(
  '/me/photo',
  authenticate,
  uploadPhotoMiddleware,
  userController.uploadPhoto
);

/**
 * DELETE /api/v1/users/me/photo
 * Auth requise
 * Supprime la photo de profil
 */
router.delete('/me/photo', authenticate, userController.deletePhoto);

/**
 * DELETE /api/v1/users/me
 * Auth requise
 * Soft-delete du compte (désactivation + révocation des tokens)
 */
router.delete('/me', authenticate, userController.deleteAccount);

// ═══════════════════════════════════════════════════════════════════
// PROFIL PUBLIC
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/users/:id
 * Public
 * Retourne le profil public d'un utilisateur (infos limitées, sans données sensibles)
 */
router.get('/:id', userController.getPublicProfile);

// ═══════════════════════════════════════════════════════════════════
// CONTACTS D'URGENCE
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/users/me/emergency-contacts
 * Auth requise
 */
router.get('/me/emergency-contacts', authenticate, userController.getEmergencyContacts);

/**
 * POST /api/v1/users/me/emergency-contacts
 * Auth requise
 * Body: { name, phoneNumber, relationship, isPrimary?, notifyOnEmergency? }
 * Max 5 contacts par utilisateur
 */
router.post(
  '/me/emergency-contacts',
  authenticate,
  validateBody(createEmergencyContactSchema),
  userController.addEmergencyContact
);

/**
 * PATCH /api/v1/users/me/emergency-contacts/:id
 * Auth requise
 */
router.patch(
  '/me/emergency-contacts/:id',
  authenticate,
  validateBody(updateEmergencyContactSchema),
  userController.updateEmergencyContact
);

/**
 * DELETE /api/v1/users/me/emergency-contacts/:id
 * Auth requise
 */
router.delete(
  '/me/emergency-contacts/:id',
  authenticate,
  userController.deleteEmergencyContact
);

export { router as userRoutes };
