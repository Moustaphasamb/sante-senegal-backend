import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// LIVRAISONS DISPONIBLES (GET /deliveries/available)
// ═══════════════════════════════════════════════════════════════════

export const availableDeliveriesSchema = z.object({
  // Géoloc optionnelle : si fournie, tri par proximité du point de retrait
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════
// LIVRER (POST /deliveries/:id/delivered)
// ═══════════════════════════════════════════════════════════════════

export const deliveredSchema = z.object({
  deliveryPhotoUrl: z.string().url('URL photo invalide').optional(),
  signatureUrl: z.string().url('URL signature invalide').optional(),
});

// ═══════════════════════════════════════════════════════════════════
// ÉCHEC (POST /deliveries/:id/failed)
// ═══════════════════════════════════════════════════════════════════

export const failedSchema = z.object({
  reason: z.string().min(3, 'Raison requise').max(500),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type AvailableDeliveriesQuery = z.infer<typeof availableDeliveriesSchema>;
export type DeliveredInput = z.infer<typeof deliveredSchema>;
export type FailedInput = z.infer<typeof failedSchema>;
