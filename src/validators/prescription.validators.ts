import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// ITEM D'ORDONNANCE
// ═══════════════════════════════════════════════════════════════════

const prescriptionItemSchema = z.object({
  medicationId: z.string().optional(),           // ID catalogue (optionnel)
  medicationName: z.string().min(2, 'Nom médicament requis').max(200),
  dci: z.string().max(200).optional(),           // Dénomination commune
  dosage: z.string().min(1, 'Dosage requis').max(50), // "500mg"
  form: z.string().max(50).optional(),           // "Comprimé", "Sirop"
  quantity: z.number().int().min(1, 'Quantité minimum 1').max(100),
  posology: z.string().min(5, 'Posologie requise').max(500),
  duration: z.string().min(2, 'Durée requise').max(100), // "7 jours"
  instructions: z.string().max(1000).optional(),
  allowGeneric: z.boolean().optional().default(true),
});

// ═══════════════════════════════════════════════════════════════════
// CRÉER ORDONNANCE (POST /prescriptions)
// ═══════════════════════════════════════════════════════════════════

export const createPrescriptionSchema = z.object({
  patientUserId: z.string().min(1, 'ID patient requis'),
  consultationId: z.string().optional(),
  validityDays: z.number().int().min(1).max(365).optional().default(90),
  isRenewable: z.boolean().optional().default(false),
  renewalsRemaining: z.number().int().min(0).max(12).optional().default(0),
  generalInstructions: z.string().max(2000).optional(),
  items: z
    .array(prescriptionItemSchema)
    .min(1, 'Au moins un médicament requis')
    .max(20, 'Maximum 20 médicaments par ordonnance'),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE ORDONNANCES (GET /prescriptions/me)
// ═══════════════════════════════════════════════════════════════════

export const listPrescriptionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsSchema>;
