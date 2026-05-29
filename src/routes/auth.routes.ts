import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { authRateLimiter, otpRateLimiter } from '../middleware/rateLimiter';
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerPatientSchema,
  registerMedecinSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// OTP
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/otp/send
 * Body: { phoneNumber, purpose: REGISTRATION | LOGIN | RESET_PASSWORD }
 * Envoie un code OTP par SMS
 */
router.post(
  '/otp/send',
  otpRateLimiter,
  validateBody(sendOtpSchema),
  authController.sendOtp
);

/**
 * POST /api/v1/auth/otp/verify
 * Body: { phoneNumber, code, purpose }
 * Vérifie un code OTP (sans inscrire ni connecter)
 */
router.post(
  '/otp/verify',
  validateBody(verifyOtpSchema),
  authController.verifyOtp
);

// ═══════════════════════════════════════════════════════════════════
// INSCRIPTION
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/register/patient
 * Body: { phoneNumber, password, firstName, lastName, otpCode, ... }
 * Inscription d'un patient
 */
router.post(
  '/register/patient',
  validateBody(registerPatientSchema),
  authController.registerPatient
);

/**
 * POST /api/v1/auth/register/medecin
 * Body: { phoneNumber, password, firstName, lastName, role, licenseNumber, otpCode, ... }
 * Inscription d'un professionnel de santé (médecin, infirmier, spécialiste)
 * → Compte en attente de validation KYC
 */
router.post(
  '/register/medecin',
  validateBody(registerMedecinSchema),
  authController.registerMedecin
);

// ═══════════════════════════════════════════════════════════════════
// CONNEXION
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/login
 * Body: { phoneNumber, password }
 * Connexion → retourne access + refresh tokens
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  authController.login
);

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 * Génère un nouvel access token + nouveau refresh token (rotation)
 */
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  authController.refresh
);

/**
 * POST /api/v1/auth/logout
 * Body: { refreshToken }
 * Révoque le refresh token
 */
router.post(
  '/logout',
  validateBody(logoutSchema),
  authController.logout
);

/**
 * POST /api/v1/auth/logout-all
 * Auth requise
 * Déconnecte de tous les appareils
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

// ═══════════════════════════════════════════════════════════════════
// PROFIL & MOT DE PASSE
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/auth/me
 * Auth requise
 * Retourne les infos de l'utilisateur connecté
 */
router.get('/me', authenticate, authController.me);

/**
 * POST /api/v1/auth/change-password
 * Auth requise
 * Body: { currentPassword, newPassword }
 */
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword
);

/**
 * POST /api/v1/auth/reset-password
 * Public
 * Body: { phoneNumber, otpCode, newPassword }
 * Réinitialisation via OTP (mot de passe oublié)
 */
router.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

export { router as authRoutes };
