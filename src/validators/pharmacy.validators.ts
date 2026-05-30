import { z } from 'zod';

// Convertit "true"/"false" des query params en boolean
const boolParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

// ═══════════════════════════════════════════════════════════════════
// LISTE PAGINÉE (GET /pharmacies)
// ═══════════════════════════════════════════════════════════════════

export const listPharmaciesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  hasDelivery: boolParam,
  isOpen24_7: boolParam,
  search: z.string().max(100).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// RECHERCHE GÉOLOCALISÉE (GET /pharmacies/nearby)
// ═══════════════════════════════════════════════════════════════════

export const nearbyPharmaciesSchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  lng: z.coerce.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
  radius: z.coerce.number().min(1, 'Rayon minimum 1 km').max(100, 'Rayon maximum 100 km').default(10),
  onDuty: boolParam,
  hasDelivery: boolParam,
});

// ═══════════════════════════════════════════════════════════════════
// STOCK D'UNE PHARMACIE (GET /pharmacies/:id/stock)
// ═══════════════════════════════════════════════════════════════════

export const pharmacyStockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(100).optional(),
  inStockOnly: boolParam,
});

// ═══════════════════════════════════════════════════════════════════
// MISE À JOUR STOCK (POST /pharmacies/me/stock)
// ═══════════════════════════════════════════════════════════════════

const stockItemSchema = z.object({
  medicationId: z.string().min(1, 'ID médicament requis'),
  quantity: z.number().int().min(0, 'Quantité invalide').max(100000),
  price: z.number().int().min(0, 'Prix invalide'),
  lowStockThreshold: z.number().int().min(0).max(10000).optional(),
});

export const updateStockSchema = z.object({
  items: z
    .array(stockItemSchema)
    .min(1, 'Au moins un médicament requis')
    .max(100, 'Maximum 100 médicaments par requête'),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListPharmaciesQuery = z.infer<typeof listPharmaciesSchema>;
export type NearbyPharmaciesQuery = z.infer<typeof nearbyPharmaciesSchema>;
export type PharmacyStockQuery = z.infer<typeof pharmacyStockQuerySchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
