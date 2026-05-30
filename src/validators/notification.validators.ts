import { z } from 'zod';
import { NotificationType } from '@prisma/client';

const boolParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM

// ═══════════════════════════════════════════════════════════════════
// LISTE (GET /notifications/me)
// ═══════════════════════════════════════════════════════════════════

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: boolParam,
  type: z.nativeEnum(NotificationType).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// PRÉFÉRENCES (PATCH /notifications/me/settings)
// ═══════════════════════════════════════════════════════════════════

export const updateNotificationSettingsSchema = z
  .object({
    smsEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    rdvReminders: z.boolean().optional(),
    prescriptionAlerts: z.boolean().optional(),
    paymentAlerts: z.boolean().optional(),
    promotionalMessages: z.boolean().optional(),
    quietHoursStart: z.string().regex(timeRegex, 'Format attendu : HH:MM').nullable().optional(),
    quietHoursEnd: z.string().regex(timeRegex, 'Format attendu : HH:MM').nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
