import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// HISTORIQUE (GET /wallet/me/transactions)
// ═══════════════════════════════════════════════════════════════════

export const listWalletTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
});

// ═══════════════════════════════════════════════════════════════════
// RETRAIT (POST /wallet/me/withdraw)
// ═══════════════════════════════════════════════════════════════════

export const withdrawSchema = z.object({
  amount: z.number().int().min(1, 'Montant invalide'),
  method: z.enum(['WAVE', 'ORANGE_MONEY'], {
    errorMap: () => ({ message: 'Méthode de retrait invalide (WAVE ou ORANGE_MONEY)' }),
  }),
  phoneNumber: z
    .string()
    .regex(/^\+221[7][0-9]{8}$/, 'Numéro sénégalais invalide (format +221XXXXXXXXX)'),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListWalletTransactionsQuery = z.infer<typeof listWalletTransactionsSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
