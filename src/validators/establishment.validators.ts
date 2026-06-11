import { z } from 'zod';
import { EstablishmentType, MedicalSpecialty } from '@prisma/client';
import { isValidSenegalPhoneNumber } from '../utils/otp';

// ═══════════════════════════════════════════════════════════════════
// HELPERS LOCAUX
// ═══════════════════════════════════════════════════════════════════

// Convertit les strings "true"/"false" des query params en boolean
const boolParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

// Schéma pour un créneau horaire journalier
const dayScheduleSchema = z.union([
  z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
    close: z.string().regex(/^\d{2}:\d{2}$/, 'Format attendu : HH:MM'),
  }),
  z.object({ closed: z.literal(true) }),
]);

const openingHoursSchema = z
  .object({
    mon: dayScheduleSchema.optional(),
    tue: dayScheduleSchema.optional(),
    wed: dayScheduleSchema.optional(),
    thu: dayScheduleSchema.optional(),
    fri: dayScheduleSchema.optional(),
    sat: dayScheduleSchema.optional(),
    sun: dayScheduleSchema.optional(),
  })
  .optional();

// ═══════════════════════════════════════════════════════════════════
// LISTE PAGINÉE (GET /establishments)
// ═══════════════════════════════════════════════════════════════════

export const listEstablishmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.nativeEnum(EstablishmentType).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  specialty: z.nativeEnum(MedicalSpecialty).optional(),
  hasEmergency: boolParam,
  isOpen24_7: boolParam,
  search: z.string().max(100).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// RECHERCHE GÉOLOCALISÉE (GET /establishments/nearby)
// ═══════════════════════════════════════════════════════════════════

export const nearbyEstablishmentsSchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, 'Latitude invalide (min -90)')
    .max(90, 'Latitude invalide (max 90)'),
  lng: z.coerce
    .number()
    .min(-180, 'Longitude invalide (min -180)')
    .max(180, 'Longitude invalide (max 180)'),
  radius: z.coerce.number().min(1, 'Rayon minimum 1 km').max(100, 'Rayon maximum 100 km').default(10),
  type: z.nativeEnum(EstablishmentType).optional(),
  specialty: z.nativeEnum(MedicalSpecialty).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// CRÉATION (POST /establishments)
// ═══════════════════════════════════════════════════════════════════

export const createEstablishmentSchema = z.object({
  name: z.string().min(2, 'Nom trop court (2 min)').max(200, 'Nom trop long (200 max)'),
  type: z.nativeEnum(EstablishmentType, {
    errorMap: () => ({ message: "Type d'établissement invalide" }),
  }),
  address: z.string().min(5, 'Adresse trop courte').max(500, 'Adresse trop longue'),
  city: z.string().min(2, 'Ville trop courte').max(100, 'Ville trop longue'),
  region: z.string().min(2, 'Région trop courte').max(100, 'Région trop longue'),
  latitude: z.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  longitude: z.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
  phoneNumber: z.string().min(9, 'Numéro trop court').max(20, 'Numéro trop long'),
  email: z.string().email('Email invalide').optional(),
  website: z.string().url('URL invalide').optional(),
  description: z.string().max(2000, 'Description trop longue').optional(),
  registrationNumber: z.string().max(100, 'Numéro trop long').optional(),
  photoUrl: z.string().url('URL photo invalide').optional(),
  coverPhotoUrl: z.string().url('URL photo couverture invalide').optional(),
  openingHours: openingHoursSchema,
  consultationPriceMin: z.number().int().min(0, 'Prix minimum invalide').optional(),
  consultationPriceMax: z.number().int().min(0, 'Prix maximum invalide').optional(),
  services: z.array(z.string().max(100)).max(50, 'Trop de services (50 max)').optional(),
  specialties: z
    .array(z.nativeEnum(MedicalSpecialty))
    .max(20, 'Trop de spécialités (20 max)')
    .optional(),
  isOpen24_7: z.boolean().optional().default(false),
  hasEmergency: z.boolean().optional().default(false),
  hasParking: z.boolean().optional().default(false),
  hasLaboratory: z.boolean().optional().default(false),
  hasImaging: z.boolean().optional().default(false),
});

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR (PATCH /establishments/:id)
// ═══════════════════════════════════════════════════════════════════

export const updateEstablishmentSchema = createEstablishmentSchema.partial().extend({
  isActive: z.boolean().optional(),
  // isVerified est accepté ici mais filtré côté service (SUPER_ADMIN seulement)
  isVerified: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════
// RATTACHEMENT D'UN MÉDECIN (POST /establishments/me/medecins)
// ═══════════════════════════════════════════════════════════════════

export const attachMedecinSchema = z.object({
  phoneNumber: z
    .string()
    .min(9, 'Numéro de téléphone trop court')
    .refine(isValidSenegalPhoneNumber, {
      message: 'Numéro de téléphone sénégalais invalide. Format attendu : +221XXXXXXXXX',
    }),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListEstablishmentsQuery = z.infer<typeof listEstablishmentsSchema>;
export type NearbyEstablishmentsQuery = z.infer<typeof nearbyEstablishmentsSchema>;
export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>;
export type UpdateEstablishmentInput = z.infer<typeof updateEstablishmentSchema>;
export type AttachMedecinInput = z.infer<typeof attachMedecinSchema>;
