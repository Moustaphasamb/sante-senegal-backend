import { z } from 'zod';
import { AppointmentMode, AppointmentStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// LISTE RDV (GET /appointments/me)
// ═══════════════════════════════════════════════════════════════════

export const listAppointmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AppointmentStatus).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
});

// ═══════════════════════════════════════════════════════════════════
// CRÉER RDV (POST /appointments)
// ═══════════════════════════════════════════════════════════════════

export const createAppointmentSchema = z.object({
  medecinId: z.string().min(1, 'ID médecin requis'),
  establishmentId: z.string().optional(),
  scheduledAt: z.string().datetime({ message: 'Date/heure invalide (format ISO 8601)' }),
  durationMinutes: z.number().int().min(15).max(240).optional().default(30),
  mode: z.nativeEnum(AppointmentMode, {
    errorMap: () => ({ message: 'Mode invalide : PRESENTIEL, TELECONSULTATION ou DOMICILE' }),
  }),
  motif: z.string().min(5, 'Motif trop court (5 min)').max(1000, 'Motif trop long'),
  notes: z.string().max(2000).optional(),
  // Le prix est tiré du profil médecin côté serveur — jamais du body client
});

// ═══════════════════════════════════════════════════════════════════
// ANNULATION (PATCH /appointments/:id/cancel)
// ═══════════════════════════════════════════════════════════════════

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(5, 'Raison trop courte').max(500, 'Raison trop longue'),
});

// ═══════════════════════════════════════════════════════════════════
// REPROGRAMMATION (PATCH /appointments/:id/reschedule)
// ═══════════════════════════════════════════════════════════════════

export const rescheduleAppointmentSchema = z.object({
  scheduledAt: z.string().datetime({ message: 'Date/heure invalide (format ISO 8601)' }),
});

// ═══════════════════════════════════════════════════════════════════
// DISPONIBILITÉS (GET /medecins/:id/availability)
// ═══════════════════════════════════════════════════════════════════

export const getAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD'),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
// Prix résolu côté serveur depuis le profil médecin (non inclus dans l'input client)
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type GetAvailabilityQuery = z.infer<typeof getAvailabilitySchema>;
