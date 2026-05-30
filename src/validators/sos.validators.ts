import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// DÉCLENCHER UNE ALERTE (POST /sos/alert)
// ═══════════════════════════════════════════════════════════════════

export const createSosAlertSchema = z.object({
  latitude: z.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  longitude: z.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
  address: z.string().max(500).optional(),
  message: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE (GET /sos/me)
// ═══════════════════════════════════════════════════════════════════

export const listSosAlertsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreateSosAlertInput = z.infer<typeof createSosAlertSchema>;
export type ListSosAlertsQuery = z.infer<typeof listSosAlertsSchema>;
