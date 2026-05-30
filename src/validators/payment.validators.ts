import { z } from 'zod';
import { PaymentStatus, TransactionType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════
// INITIER UN PAIEMENT (POST /payments/initiate)
// ═══════════════════════════════════════════════════════════════════

export const initiatePaymentSchema = z.object({
  paymentId: z.string().min(1, 'ID paiement requis'),
  method: z.enum(['WAVE', 'ORANGE_MONEY', 'WALLET_INTERNE'], {
    errorMap: () => ({ message: 'Méthode invalide (WAVE, ORANGE_MONEY ou WALLET_INTERNE)' }),
  }),
});

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK PROVIDER (POST /payments/wave|orange-money/webhook)
// ═══════════════════════════════════════════════════════════════════

export const paymentWebhookSchema = z.object({
  externalReference: z.string().min(1, 'Référence externe requise'),
  status: z.enum(['success', 'failed']),
  providerTransactionId: z.string().optional(),
  amount: z.number().optional(),
  failureReason: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// REMBOURSEMENT (POST /payments/:id/refund)
// ═══════════════════════════════════════════════════════════════════

export const refundSchema = z.object({
  amount: z.number().int().min(1).optional(), // si absent : remboursement total
  reason: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// LISTE (GET /payments/me)
// ═══════════════════════════════════════════════════════════════════

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(PaymentStatus).optional(),
  transactionType: z.nativeEnum(TransactionType).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>;
