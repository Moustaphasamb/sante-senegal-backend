import { z } from 'zod';
import { UrgencyLevel, HomeVisitStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// CRÉER DEMANDE DE VISITE (POST /home-visits)
// ═══════════════════════════════════════════════════════════════════

export const createHomeVisitSchema = z.object({
  urgencyLevel: z.nativeEnum(UrgencyLevel).optional().default(UrgencyLevel.NON_URGENT),
  motif: z.string().min(5, 'Motif trop court (5 min)').max(1000, 'Motif trop long'),
  patientLatitude: z.number().min(-90, 'Latitude invalide').max(90, 'Latitude invalide'),
  patientLongitude: z.number().min(-180, 'Longitude invalide').max(180, 'Longitude invalide'),
  patientAddress: z.string().min(5, 'Adresse trop courte').max(500, 'Adresse trop longue'),
  patientPhoneNumber: z.string().min(9, 'Numéro trop court').max(20, 'Numéro trop long'),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE MES VISITES (GET /home-visits/me)
// ═══════════════════════════════════════════════════════════════════

export const listHomeVisitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(HomeVisitStatus).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// ANNULATION (PATCH /home-visits/:id/cancel)
// ═══════════════════════════════════════════════════════════════════

export const cancelHomeVisitSchema = z.object({
  reason: z.string().min(5, 'Raison trop courte').max(500, 'Raison trop longue'),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreateHomeVisitInput = z.infer<typeof createHomeVisitSchema>;
export type ListHomeVisitsQuery = z.infer<typeof listHomeVisitsSchema>;
export type CancelHomeVisitInput = z.infer<typeof cancelHomeVisitSchema>;
