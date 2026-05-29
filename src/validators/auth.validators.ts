import { z } from 'zod';
import { Gender, Language } from '@prisma/client';
import { isValidSenegalPhoneNumber } from '../utils/otp';

// ═══════════════════════════════════════════════════════════════════
// VALIDATEURS COMMUNS
// ═══════════════════════════════════════════════════════════════════

const phoneNumberSchema = z
  .string()
  .min(9, 'Numéro de téléphone trop court')
  .refine(isValidSenegalPhoneNumber, {
    message: 'Numéro de téléphone sénégalais invalide. Format attendu : +221XXXXXXXXX',
  });

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(100, 'Mot de passe trop long')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

const otpCodeSchema = z
  .string()
  .length(6, 'Le code OTP doit contenir 6 chiffres')
  .regex(/^[0-9]{6}$/, 'Le code OTP doit contenir uniquement des chiffres');

const nameSchema = z
  .string()
  .min(2, 'Trop court (2 caractères minimum)')
  .max(50, 'Trop long (50 caractères maximum)')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères invalides dans le nom');

// ═══════════════════════════════════════════════════════════════════
// SCHÉMAS DES ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// ─── OTP ─────────────────────────────────────────────────────────
export const sendOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'RESET_PASSWORD']),
});

export const verifyOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  code: otpCodeSchema,
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'RESET_PASSWORD']),
});

// ─── INSCRIPTION PATIENT ─────────────────────────────────────────
export const registerPatientSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().email('Email invalide').optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional(),
  gender: z.nativeEnum(Gender).optional(),
  preferredLanguage: z.nativeEnum(Language).default(Language.FR),
  otpCode: otpCodeSchema,
});

// ─── INSCRIPTION MÉDECIN/PRO ─────────────────────────────────────
export const registerMedecinSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().email('Email invalide').optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional(),
  gender: z.nativeEnum(Gender).optional(),
  preferredLanguage: z.nativeEnum(Language).default(Language.FR),
  otpCode: otpCodeSchema,
  role: z.enum([
    'MEDECIN_SALARIE',
    'MEDECIN_LIBERAL_MOBILE',
    'SPECIALISTE_CABINET',
    'INFIRMIER_DOMICILE',
  ]),
  licenseNumber: z
    .string()
    .min(3, 'Numéro de licence trop court')
    .max(50, 'Numéro de licence trop long'),
});

// ─── LOGIN ───────────────────────────────────────────────────────
export const loginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: z.string().min(1, 'Mot de passe requis'),
});

// ─── REFRESH TOKEN ───────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

// ─── LOGOUT ──────────────────────────────────────────────────────
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

// ─── CHANGEMENT MOT DE PASSE ─────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: passwordSchema,
});

// ─── RESET MOT DE PASSE ──────────────────────────────────────────
export const resetPasswordSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otpCode: otpCodeSchema,
  newPassword: passwordSchema,
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT DES TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type RegisterMedecinInput = z.infer<typeof registerMedecinSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
