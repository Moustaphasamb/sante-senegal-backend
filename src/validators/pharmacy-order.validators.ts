import { z } from 'zod';
import { PharmacyOrderStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// LIGNE DE COMMANDE
// ═══════════════════════════════════════════════════════════════════

const orderItemSchema = z.object({
  medicationId: z.string().min(1, 'ID médicament requis'),
  quantity: z.number().int().min(1, 'Quantité minimum 1').max(100),
});

// ═══════════════════════════════════════════════════════════════════
// CRÉER COMMANDE (POST /pharmacy-orders)
// ═══════════════════════════════════════════════════════════════════

export const createPharmacyOrderSchema = z
  .object({
    pharmacyId: z.string().min(1, 'ID pharmacie requis'),
    prescriptionId: z.string().optional(),
    deliveryMode: z.enum(['RETRAIT', 'LIVRAISON'], {
      errorMap: () => ({ message: 'Mode invalide (RETRAIT ou LIVRAISON)' }),
    }),
    deliveryAddress: z.string().max(500).optional(),
    deliveryLatitude: z.number().min(-90).max(90).optional(),
    deliveryLongitude: z.number().min(-180).max(180).optional(),
    deliveryNotes: z.string().max(1000).optional(),
    items: z
      .array(orderItemSchema)
      .min(1, 'Au moins un médicament requis')
      .max(50, 'Maximum 50 médicaments par commande'),
  })
  .refine(
    (d) =>
      d.deliveryMode !== 'LIVRAISON' ||
      (!!d.deliveryAddress && d.deliveryLatitude !== undefined && d.deliveryLongitude !== undefined),
    {
      message: 'Adresse et coordonnées GPS requises pour une livraison',
      path: ['deliveryAddress'],
    }
  );

// ═══════════════════════════════════════════════════════════════════
// LISTE (GET /pharmacy-orders/me)
// ═══════════════════════════════════════════════════════════════════

export const listPharmacyOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(PharmacyOrderStatus).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// REFUS / ANNULATION (raison optionnelle)
// ═══════════════════════════════════════════════════════════════════

export const orderReasonSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreatePharmacyOrderInput = z.infer<typeof createPharmacyOrderSchema>;
export type ListPharmacyOrdersQuery = z.infer<typeof listPharmacyOrdersSchema>;
export type OrderReasonInput = z.infer<typeof orderReasonSchema>;
