import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// CRÉER CONSULTATION (POST /consultations)
// ═══════════════════════════════════════════════════════════════════

export const createConsultationSchema = z
  .object({
    // L'un des deux requis — résolution automatique du MedicalRecord
    appointmentId: z.string().optional(),
    homeVisitId: z.string().optional(),

    consultationDate: z.string().datetime({ message: 'Date invalide (format ISO 8601)' }),
    motif: z.string().min(5, 'Motif trop court').max(1000),
    symptoms: z.string().max(2000).optional(),
    examination: z.string().max(2000).optional(),
    diagnosis: z.string().min(5, 'Diagnostic trop court').max(2000),
    icd10Codes: z.array(z.string().max(20)).max(20).optional().default([]),
    treatment: z.string().max(3000).optional(),
    recommendations: z.string().max(2000).optional(),
    followUpNeeded: z.boolean().optional().default(false),
    followUpDate: z
      .string()
      .datetime({ message: 'Date de suivi invalide' })
      .optional()
      .nullable(),

    // Signes vitaux
    bloodPressure: z
      .string()
      .regex(/^\d{2,3}\/\d{2,3}$/, 'Format attendu : "120/80"')
      .optional(),
    heartRate: z.number().int().min(20).max(300).optional(),
    temperature: z.number().min(30).max(45).optional(),
    oxygenSaturation: z.number().int().min(50).max(100).optional(),
    weight: z.number().min(1).max(500).optional(),
    height: z.number().min(30).max(300).optional(),
  })
  .refine((d) => d.appointmentId || d.homeVisitId, {
    message: 'appointmentId ou homeVisitId est requis',
    path: ['appointmentId'],
  })
  .refine((d) => !(d.appointmentId && d.homeVisitId), {
    message: 'Fournir appointmentId OU homeVisitId, pas les deux',
    path: ['appointmentId'],
  });

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR (PATCH /consultations/:id) — dans les 24h
// ═══════════════════════════════════════════════════════════════════

export const updateConsultationSchema = z.object({
  motif: z.string().min(5).max(1000).optional(),
  symptoms: z.string().max(2000).optional().nullable(),
  examination: z.string().max(2000).optional().nullable(),
  diagnosis: z.string().min(5).max(2000).optional(),
  icd10Codes: z.array(z.string().max(20)).max(20).optional(),
  treatment: z.string().max(3000).optional().nullable(),
  recommendations: z.string().max(2000).optional().nullable(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/).optional().nullable(),
  heartRate: z.number().int().min(20).max(300).optional().nullable(),
  temperature: z.number().min(30).max(45).optional().nullable(),
  oxygenSaturation: z.number().int().min(50).max(100).optional().nullable(),
  weight: z.number().min(1).max(500).optional().nullable(),
  height: z.number().min(30).max(300).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE CONSULTATIONS PATIENT (GET /patients/:id/consultations)
// ═══════════════════════════════════════════════════════════════════

export const listConsultationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type ListConsultationsQuery = z.infer<typeof listConsultationsSchema>;
