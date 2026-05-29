import { z } from 'zod';
import { MedicalSpecialty, Language } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// HELPERS LOCAUX
// ═══════════════════════════════════════════════════════════════════

const boolParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

// ═══════════════════════════════════════════════════════════════════
// LISTE MÉDECINS (GET /medecins)
// ═══════════════════════════════════════════════════════════════════

export const listMedecinsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  specialty: z.nativeEnum(MedicalSpecialty).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  language: z.nativeEnum(Language).optional(),
  isMobileAvailable: boolParam,
  priceMax: z.coerce.number().int().min(0).optional(),
  search: z.string().max(100).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// NEARBY MÉDECINS LIBÉRAUX (GET /medecins/nearby)
// ═══════════════════════════════════════════════════════════════════

export const nearbyMedecinsSchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  lng: z.coerce.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
  radius: z.coerce.number().min(1).max(100).default(10),
  specialty: z.nativeEnum(MedicalSpecialty).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR PROFIL MÉDECIN (PATCH /medecins/me)
// ═══════════════════════════════════════════════════════════════════

export const updateMedecinProfileSchema = z.object({
  bio: z.string().max(2000, 'Biographie trop longue').optional().nullable(),
  specialties: z.array(z.nativeEnum(MedicalSpecialty)).max(10).optional(),
  languages: z.array(z.nativeEnum(Language)).optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional().nullable(),
  consultationPriceMin: z.number().int().min(0).optional().nullable(),
  consultationPriceMax: z.number().int().min(0).optional().nullable(),
  // Médecin libéral mobile
  mobileRadiusKm: z.number().int().min(1).max(100).optional(),
  mobileConsultationPrice: z.number().int().min(0).optional().nullable(),
  mobileTravelFee: z.number().int().min(0).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════════
// UPLOAD DOCUMENT KYC (POST /medecins/me/documents)
// ═══════════════════════════════════════════════════════════════════

export const uploadDocumentSchema = z.object({
  documentType: z.enum(['diploma', 'cni', 'orderCard'], {
    errorMap: () => ({ message: "Type de document invalide. Valeurs : diploma, cni, orderCard" }),
  }),
});

// ═══════════════════════════════════════════════════════════════════
// POSITION GPS (POST /medecins/me/location)
// ═══════════════════════════════════════════════════════════════════

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  longitude: z.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
});

// ═══════════════════════════════════════════════════════════════════
// PLANNING HEBDOMADAIRE (POST /medecins/me/schedule)
// ═══════════════════════════════════════════════════════════════════

const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0, 'Jour invalide (0=dim, 6=sam)').max(6, 'Jour invalide (0=dim, 6=sam)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  slotDuration: z.number().int().min(10).max(120).optional().default(30),
  isActive: z.boolean().optional().default(true),
});

export const setScheduleSchema = z.object({
  schedule: z
    .array(scheduleItemSchema)
    .min(1, 'Au moins un jour requis')
    .max(7, 'Maximum 7 jours'),
});

// ═══════════════════════════════════════════════════════════════════
// APPROVE / REJECT KYC (admin)
// ═══════════════════════════════════════════════════════════════════

export const rejectKycSchema = z.object({
  reason: z.string().min(10, 'Raison trop courte (10 min)').max(500, 'Raison trop longue'),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListMedecinsQuery = z.infer<typeof listMedecinsSchema>;
export type NearbyMedecinsQuery = z.infer<typeof nearbyMedecinsSchema>;
export type UpdateMedecinProfileInput = z.infer<typeof updateMedecinProfileSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type SetScheduleInput = z.infer<typeof setScheduleSchema>;
export type RejectKycInput = z.infer<typeof rejectKycSchema>;
