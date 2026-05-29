import { z } from 'zod';
import { BloodGroup, AccessLevel } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR DME (PATCH /medical-records/me)
// ═══════════════════════════════════════════════════════════════════

export const updateMedicalRecordSchema = z.object({
  // Champs MedicalRecord
  medicalHistory: z.string().max(5000, 'Trop long (5000 max)').optional().nullable(),
  surgicalHistory: z.string().max(5000, 'Trop long (5000 max)').optional().nullable(),
  familyHistory: z.string().max(5000, 'Trop long (5000 max)').optional().nullable(),
  isSmoker: z.boolean().optional().nullable(),
  alcoholConsumption: z.string().max(100).optional().nullable(),
  exerciseLevel: z.string().max(100).optional().nullable(),
  // Champ PatientProfile (mis à jour en transaction)
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// ALLERGIE (POST /medical-records/me/allergies)
// ═══════════════════════════════════════════════════════════════════

export const addAllergySchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(200, 'Nom trop long'),
  severity: z.enum(['LEGERE', 'MODEREE', 'SEVERE', 'CRITIQUE'], {
    errorMap: () => ({ message: 'Sévérité invalide. Valeurs : LEGERE, MODEREE, SEVERE, CRITIQUE' }),
  }),
  reaction: z.string().max(500, 'Description trop longue').optional(),
  diagnosedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional()
    .nullable(),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// MALADIE CHRONIQUE (POST /medical-records/me/chronic-conditions)
// ═══════════════════════════════════════════════════════════════════

export const addChronicConditionSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(200, 'Nom trop long'),
  icd10Code: z.string().max(20, 'Code CIM-10 trop long').optional(),
  diagnosedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional()
    .nullable(),
  currentTreatment: z.string().max(2000, 'Traitement trop long').optional(),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// DOCUMENT MÉDICAL (POST /medical-records/me/documents)
// ═══════════════════════════════════════════════════════════════════

export const uploadMedicalDocSchema = z.object({
  title: z.string().min(2, 'Titre trop court').max(200, 'Titre trop long'),
  category: z.enum(
    ['ORDONNANCE_ANCIENNE', 'CERTIFICAT', 'RESULTAT_ANALYSE', 'RADIOGRAPHIE', 'AUTRE'],
    {
      errorMap: () => ({
        message:
          'Catégorie invalide. Valeurs : ORDONNANCE_ANCIENNE, CERTIFICAT, RESULTAT_ANALYSE, RADIOGRAPHIE, AUTRE',
      }),
    }
  ),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// TOKEN DE PARTAGE QR (POST /medical-records/me/share-token)
// ═══════════════════════════════════════════════════════════════════

export const createShareTokenSchema = z.object({
  duration: z.enum(['1h', '24h', '7d', 'unlimited'], {
    errorMap: () => ({ message: 'Durée invalide. Valeurs : 1h, 24h, 7d, unlimited' }),
  }),
  grantedToMedecinId: z.string().optional(), // ID du MedecinProfile (optionnel = token ouvert)
  accessLevel: z.nativeEnum(AccessLevel).optional().default(AccessLevel.LECTURE_SEULE),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>;
export type AddAllergyInput = z.infer<typeof addAllergySchema>;
export type AddChronicConditionInput = z.infer<typeof addChronicConditionSchema>;
export type UploadMedicalDocInput = z.infer<typeof uploadMedicalDocSchema>;
export type CreateShareTokenInput = z.infer<typeof createShareTokenSchema>;
