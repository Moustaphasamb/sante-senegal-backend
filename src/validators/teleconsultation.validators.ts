import { z } from 'zod';

export const createTeleconsultationSchema = z.object({
  appointmentId: z.string().min(1, 'appointmentId requis'),
});

export const recordingConsentSchema = z.object({
  consent: z.boolean(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message vide').max(2000),
});

export const listTeleconsultationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTeleconsultationInput = z.infer<typeof createTeleconsultationSchema>;
export type RecordingConsentInput = z.infer<typeof recordingConsentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListTeleconsultationsQuery = z.infer<typeof listTeleconsultationsSchema>;
