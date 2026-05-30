import { z } from 'zod';

export const REVIEW_TARGET_TYPES = ['MEDECIN', 'PHARMACY', 'LIVREUR', 'ESTABLISHMENT'] as const;

// ═══════════════════════════════════════════════════════════════════
// CRÉER UN AVIS (POST /reviews)
// ═══════════════════════════════════════════════════════════════════

export const createReviewSchema = z
  .object({
    targetType: z.enum(REVIEW_TARGET_TYPES, {
      errorMap: () => ({ message: 'Type de cible invalide' }),
    }),
    targetUserId: z.string().optional(), // requis pour MEDECIN / LIVREUR
    targetEntityId: z.string().optional(), // requis pour PHARMACY / ESTABLISHMENT
    rating: z.number().int().min(1, 'Note minimum 1').max(5, 'Note maximum 5'),
    comment: z.string().max(2000).optional(),
    // Contexte (un seul attendu en pratique)
    appointmentId: z.string().optional(),
    homeVisitId: z.string().optional(),
    orderId: z.string().optional(),
    deliveryId: z.string().optional(),
  })
  .refine(
    (d) =>
      d.targetType === 'MEDECIN' || d.targetType === 'LIVREUR'
        ? !!d.targetUserId
        : !!d.targetEntityId,
    {
      message:
        "targetUserId requis pour MEDECIN/LIVREUR, targetEntityId requis pour PHARMACY/ESTABLISHMENT",
      path: ['targetUserId'],
    }
  );

// ═══════════════════════════════════════════════════════════════════
// RÉPONDRE À UN AVIS (POST /reviews/:id/respond)
// ═══════════════════════════════════════════════════════════════════

export const respondReviewSchema = z.object({
  response: z.string().min(1, 'Réponse requise').max(2000),
});

// ═══════════════════════════════════════════════════════════════════
// MODÉRER (POST /admin/reviews/:id/moderate)
// ═══════════════════════════════════════════════════════════════════

export const moderateReviewSchema = z.object({
  isApproved: z.boolean(),
  isFlagged: z.boolean().optional(),
  moderationNotes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE (GET /reviews/target/:userId, /reviews/me/received)
// ═══════════════════════════════════════════════════════════════════

export const listReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type RespondReviewInput = z.infer<typeof respondReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsSchema>;
