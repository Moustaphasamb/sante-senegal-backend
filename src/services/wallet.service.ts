import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ListWalletTransactionsQuery, WithdrawInput } from '../validators/wallet.validators';

// Montant minimum de retrait (FCFA)
const MIN_WITHDRAWAL = 1000;

// ═══════════════════════════════════════════════════════════════════
// Helpers transactionnels (réutilisés par le service Paiements)
// ═══════════════════════════════════════════════════════════════════

type Tx = Prisma.TransactionClient;

interface MovementOptions {
  description: string;
  referenceType?: string; // "PAYMENT", "WITHDRAWAL", "REFUND", "ADJUSTMENT"
  referenceId?: string;
  pending?: boolean; // crédit en attente (pendingBalance) plutôt que solde disponible
}

async function ensureWallet(tx: Tx, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/** Crédite le portefeuille d'un utilisateur (solde disponible ou en attente) */
export async function creditWallet(
  tx: Tx,
  userId: string,
  amount: number,
  opts: MovementOptions
): Promise<void> {
  if (amount <= 0) return;
  const wallet = await ensureWallet(tx, userId);

  if (opts.pending) {
    // Crédit en attente : ne touche pas au solde disponible (R10 — règlement différé)
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { pendingBalance: { increment: amount }, totalEarned: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'CREDIT',
        amount,
        balanceAfter: wallet.balance, // solde disponible inchangé
        description: opts.description,
        referenceType: opts.referenceType,
        referenceId: opts.referenceId,
      },
    });
    return;
  }

  // Incrément atomique (évite les pertes de mise à jour concurrentes)
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId,
      type: 'CREDIT',
      amount,
      balanceAfter: updated.balance,
      description: opts.description,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
    },
  });
}

/** Débite le portefeuille d'un utilisateur (lève une erreur si solde insuffisant) */
export async function debitWallet(
  tx: Tx,
  userId: string,
  amount: number,
  opts: MovementOptions
): Promise<void> {
  if (amount <= 0) return;
  const wallet = await ensureWallet(tx, userId);

  // Débit atomique conditionnel : le décrément n'a lieu que si le solde est suffisant.
  // updateMany pose un verrou de ligne et garantit l'absence de double-dépense concurrente.
  const res = await tx.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: amount } },
    data: {
      balance: { decrement: amount },
      ...(opts.referenceType === 'WITHDRAWAL' && { totalWithdrawn: { increment: amount } }),
    },
  });
  if (res.count === 0) {
    throw new BadRequestError(
      `Solde insuffisant (disponible : ${wallet.balance} FCFA, requis : ${amount} FCFA)`
    );
  }

  // Relire le solde réel après décrément pour l'historique
  const after = await tx.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    select: { balance: true },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId,
      type: 'DEBIT',
      amount,
      balanceAfter: after.balance,
      description: opts.description,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
    },
  });
}

/** Réduit le solde en attente d'un bénéficiaire (annulation/remboursement) */
export async function reversePendingCredit(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const wallet = await tx.wallet.findUnique({ where: { userId }, select: { id: true, pendingBalance: true, totalEarned: true } });
  if (!wallet) return;
  const reversal = Math.min(amount, wallet.pendingBalance);
  if (reversal <= 0) return;
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      pendingBalance: { decrement: reversal },
      totalEarned: { decrement: Math.min(reversal, wallet.totalEarned) },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// Service Wallet (endpoints utilisateur)
// ═══════════════════════════════════════════════════════════════════

class WalletService {
  // ─── SOLDE ────────────────────────────────────────────────────

  async getMyWallet(userId: string) {
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        balance: true,
        pendingBalance: true,
        totalEarned: true,
        totalWithdrawn: true,
        updatedAt: true,
      },
    });
    return wallet;
  }

  // ─── HISTORIQUE TRANSACTIONS ──────────────────────────────────

  async listTransactions(userId: string, query: ListWalletTransactionsQuery) {
    const { page, limit, type } = query;
    const skip = (page - 1) * limit;

    const where = { userId, ...(type && { type }) };

    const [transactions, total] = await prisma.$transaction([
      prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── RETRAIT (médecin / pharmacien) ───────────────────────────

  async withdraw(userId: string, data: WithdrawInput) {
    if (data.amount < MIN_WITHDRAWAL) {
      throw new BadRequestError(`Montant minimum de retrait : ${MIN_WITHDRAWAL} FCFA`);
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
    if (!wallet) throw new NotFoundError('Portefeuille');
    if (wallet.balance < data.amount) {
      throw new BadRequestError(
        `Solde insuffisant (disponible : ${wallet.balance} FCFA, demandé : ${data.amount} FCFA)`
      );
    }

    await prisma.$transaction(async (tx) => {
      await debitWallet(tx, userId, data.amount, {
        description: `Retrait vers ${data.method} (${data.phoneNumber})`,
        referenceType: 'WITHDRAWAL',
      });
    });

    logger.info('Retrait wallet effectué', { userId, amount: data.amount, method: data.method });
    return { withdrawn: data.amount, method: data.method };
  }
}

export const walletService = new WalletService();
