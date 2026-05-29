import { z } from 'zod';
import { Gender, Language, BloodGroup } from '@prisma/client';
import { isValidSenegalPhoneNumber } from '../utils/otp';

// ═══════════════════════════════════════════════════════════════════
// VALIDATEURS COMMUNS
// ═══════════════════════════════════════════════════════════════════

const nameSchema = z
  .string()
  .min(2, 'Trop court (2 caractères minimum)')
  .max(50, 'Trop long (50 caractères maximum)')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères invalides dans le nom');

const phoneNumberSchema = z
  .string()
  .min(9, 'Numéro de téléphone trop court')
  .refine(isValidSenegalPhoneNumber, {
    message: 'Numéro de téléphone sénégalais invalide. Format attendu : +221XXXXXXXXX',
  });

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR PROFIL UTILISATEUR
// ═══════════════════════════════════════════════════════════════════

export const updateUserProfileSchema = z.object({
  // Champs User de base
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: z.string().email('Email invalide').optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional()
    .nullable(),
  gender: z.nativeEnum(Gender).optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),

  // Champs PatientProfile (ignorés pour les autres rôles)
  address: z.string().max(255, 'Adresse trop longue').optional().nullable(),
  city: z.string().max(100, 'Ville trop longue').optional().nullable(),
  region: z.string().max(100, 'Région trop longue').optional().nullable(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  height: z
    .number()
    .min(50, 'Taille trop petite (min 50 cm)')
    .max(300, 'Taille trop grande (max 300 cm)')
    .optional()
    .nullable(),
  weight: z
    .number()
    .min(1, 'Poids trop faible (min 1 kg)')
    .max(500, 'Poids trop élevé (max 500 kg)')
    .optional()
    .nullable(),
  cniNumber: z.string().max(50, 'Numéro CNI trop long').optional().nullable(),
  insuranceNumber: z.string().max(100, 'Numéro assurance trop long').optional().nullable(),
  insuranceProvider: z.string().max(100, 'Nom assureur trop long').optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════════
// CONTACTS D'URGENCE
// ═══════════════════════════════════════════════════════════════════

export const createEmergencyContactSchema = z.object({
  name: z
    .string()
    .min(2, 'Nom trop court')
    .max(100, 'Nom trop long'),
  phoneNumber: phoneNumberSchema,
  relationship: z
    .string()
    .min(2, 'Relation trop courte')
    .max(50, 'Relation trop longue'),
  isPrimary: z.boolean().optional().default(false),
  notifyOnEmergency: z.boolean().optional().default(true),
});

export const updateEmergencyContactSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phoneNumber: phoneNumberSchema.optional(),
  relationship: z.string().min(2).max(50).optional(),
  isPrimary: z.boolean().optional(),
  notifyOnEmergency: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;
export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;
