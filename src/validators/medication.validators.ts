import { z } from 'zod';

// Convertit "true"/"false" des query params en boolean
const boolParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

// ═══════════════════════════════════════════════════════════════════
// CATALOGUE (GET /medications)
// ═══════════════════════════════════════════════════════════════════

export const listMedicationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),       // recherche nom commercial OU DCI
  category: z.string().max(100).optional(),
  form: z.string().max(50).optional(),
  requiresPrescription: boolParam,
});

// ═══════════════════════════════════════════════════════════════════
// DISPONIBILITÉ (GET /medications/search/availability)
// ═══════════════════════════════════════════════════════════════════

export const medicationAvailabilitySchema = z.object({
  medicationId: z.string().min(1, 'ID médicament requis'),
  // Géoloc optionnelle : si fournie, tri par distance + filtre rayon
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(100).default(10),
  inStockOnly: z.preprocess(
    (v) => (v === 'false' ? false : true),
    z.boolean()
  ),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListMedicationsQuery = z.infer<typeof listMedicationsSchema>;
export type MedicationAvailabilityQuery = z.infer<typeof medicationAvailabilitySchema>;
