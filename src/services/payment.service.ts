import crypto from 'crypto';
import { UserRole, PaymentStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { creditWallet, debitWallet, reversePendingCredit } from './wallet.service';
import type {
  InitiatePaymentInput,
  PaymentWebhookInput,
  RefundInput,
  ListPaymentsQuery,
} from '../validators/payment.validators';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

type Provider = 'WAVE' | 'ORANGE_MONEY';

/**
 * Vérifie la signature d'un webhook provider (HMAC-SHA256 du corps).
 * ⚠ Placeholder : en production, utiliser la vraie signature documentée par Wave/Orange Money.
 * En dev (secret non configuré) : la vérification est ignorée avec un avertissement.
 */
function verifyWebhookSignature(provider: Provider, body: unknown, signature?: string): boolean {
  const secret =
    provider === 'WAVE'
      ? config.payment.wave.webhookSecret
      : config.payment.orangeMoney.clientSecret;

  if (!secret) {
    // Fail-closed en production : jamais de webhook accepté sans secret configuré
    if (config.isProd) {
      logger.error('Webhook refusé : secret non configuré en production', { provider });
      return false;
    }
    logger.warn('Webhook : secret non configuré, vérification de signature ignorée (DEV uniquement)', { provider });
    return true;
  }
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  platformFee: true,
  beneficiaryAmount: true,
  currency: true,
  transactionType: true,
  method: true,
  status: true,
  description: true,
  externalReference: true,
  externalProvider: true,
  paidAt: true,
  refundedAt: true,
  refundAmount: true,
  failureReason: true,
  createdAt: true,
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class PaymentService {
  // ─── INITIER ──────────────────────────────────────────────────

  async initiate(userId: string, data: InitiatePaymentInput) {
    const payment = await prisma.payment.findUnique({
      where: { id: data.paymentId },
      select: {
        id: true,
        payerId: true,
        beneficiaryId: true,
        amount: true,
        beneficiaryAmount: true,
        status: true,
        transactionType: true,
      },
    });
    if (!payment) throw new NotFoundError('Paiement');
    if (payment.payerId !== userId) throw new ForbiddenError("Ce paiement ne vous appartient pas");
    if (payment.status !== PaymentStatus.EN_ATTENTE) {
      throw new BadRequestError(`Ce paiement est déjà au statut "${payment.status}"`);
    }

    // ─── Paiement par portefeuille interne : instantané ───────────
    if (data.method === 'WALLET_INTERNE') {
      const updated = await prisma.$transaction(async (tx) => {
        await debitWallet(tx, payment.payerId, payment.amount, {
          description: `Paiement ${payment.transactionType}`,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
        });

        // Crédit du bénéficiaire en attente (règlement différé R10)
        if (payment.beneficiaryId && payment.beneficiaryAmount > 0) {
          await creditWallet(tx, payment.beneficiaryId, payment.beneficiaryAmount, {
            description: `Encaissement ${payment.transactionType}`,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            pending: true,
          });
        }

        return tx.payment.update({
          where: { id: payment.id },
          data: {
            method: PaymentMethod.WALLET_INTERNE,
            status: PaymentStatus.REUSSI,
            paidAt: new Date(),
          },
          select: PAYMENT_SELECT,
        });
      });

      logger.info('Paiement wallet réussi', { paymentId: payment.id, userId });
      return { payment: updated, paid: true };
    }

    // ─── Paiement externe (Wave / Orange Money) : en attente du webhook ─
    const externalReference = `SS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const method = data.method === 'WAVE' ? PaymentMethod.WAVE : PaymentMethod.ORANGE_MONEY;

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { method, externalProvider: data.method, externalReference },
      select: PAYMENT_SELECT,
    });

    // En production : appeler l'API Wave/OM pour obtenir une vraie URL de paiement.
    // En dev : URL de simulation.
    const checkoutUrl = `https://checkout.dev/${data.method.toLowerCase()}/${externalReference}`;

    logger.info('Paiement externe initié', { paymentId: payment.id, provider: data.method, externalReference });
    return { payment: updated, paid: false, checkoutUrl, externalReference };
  }

  // ─── WEBHOOK ──────────────────────────────────────────────────

  async handleWebhook(provider: Provider, body: PaymentWebhookInput, signature?: string) {
    if (!verifyWebhookSignature(provider, body, signature)) {
      throw new ForbiddenError('Signature de webhook invalide');
    }

    const payment = await prisma.payment.findUnique({
      where: { externalReference: body.externalReference },
      select: { id: true, status: true, beneficiaryId: true, beneficiaryAmount: true, transactionType: true },
    });
    if (!payment) throw new NotFoundError('Paiement (référence externe)');

    // Idempotence : si déjà traité, ne rien refaire
    if (payment.status !== PaymentStatus.EN_ATTENTE) {
      logger.info('Webhook ignoré (déjà traité)', { paymentId: payment.id, status: payment.status });
      return { processed: false, status: payment.status };
    }

    if (body.status === 'failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.ECHEC,
          failureReason: body.failureReason ?? 'Paiement refusé par le provider',
          externalResponse: body as object,
        },
      });
      logger.info('Paiement échoué (webhook)', { paymentId: payment.id, provider });
      return { processed: true, status: PaymentStatus.ECHEC };
    }

    // Succès : marquer réussi + créditer le bénéficiaire en attente
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REUSSI, paidAt: new Date(), externalResponse: body as object },
      });
      if (payment.beneficiaryId && payment.beneficiaryAmount > 0) {
        await creditWallet(tx, payment.beneficiaryId, payment.beneficiaryAmount, {
          description: `Encaissement ${payment.transactionType}`,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          pending: true,
        });
      }
    });

    logger.info('Paiement confirmé (webhook)', { paymentId: payment.id, provider });
    return { processed: true, status: PaymentStatus.REUSSI };
  }

  // ─── LISTE ────────────────────────────────────────────────────

  async list(userId: string, query: ListPaymentsQuery) {
    const { page, limit, status, transactionType } = query;
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ payerId: userId }, { beneficiaryId: userId }],
      ...(status && { status }),
      ...(transactionType && { transactionType }),
    };

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: PAYMENT_SELECT,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { ...PAYMENT_SELECT, payerId: true, beneficiaryId: true },
    });
    if (!payment) throw new NotFoundError('Paiement');
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      payment.payerId !== userId &&
      payment.beneficiaryId !== userId
    ) {
      throw new ForbiddenError("Vous n'avez pas accès à ce paiement");
    }
    return payment;
  }

  // ─── REMBOURSEMENT (admin) ────────────────────────────────────

  async refund(id: string, adminUserId: string, data: RefundInput) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        payerId: true,
        beneficiaryId: true,
        amount: true,
        beneficiaryAmount: true,
        status: true,
        refundAmount: true,
        transactionType: true,
      },
    });
    if (!payment) throw new NotFoundError('Paiement');
    if (payment.status !== PaymentStatus.REUSSI && payment.status !== PaymentStatus.PARTIELLEMENT_REMBOURSE) {
      throw new BadRequestError(`Impossible de rembourser un paiement au statut "${payment.status}"`);
    }

    const alreadyRefunded = payment.refundAmount ?? 0;
    const refundable = payment.amount - alreadyRefunded;
    const refundAmount = data.amount ?? refundable;

    if (refundAmount <= 0 || refundAmount > refundable) {
      throw new BadRequestError(`Montant remboursable maximum : ${refundable} FCFA`);
    }

    const totalRefunded = alreadyRefunded + refundAmount;
    const newStatus =
      totalRefunded >= payment.amount
        ? PaymentStatus.REMBOURSE
        : PaymentStatus.PARTIELLEMENT_REMBOURSE;

    const updated = await prisma.$transaction(async (tx) => {
      // Rembourser le payeur sur son solde disponible
      await creditWallet(tx, payment.payerId, refundAmount, {
        description: `Remboursement ${payment.transactionType}${data.reason ? ` — ${data.reason}` : ''}`,
        referenceType: 'REFUND',
        referenceId: payment.id,
      });

      // Annuler proportionnellement le crédit en attente du bénéficiaire (remboursement total)
      if (newStatus === PaymentStatus.REMBOURSE && payment.beneficiaryId && payment.beneficiaryAmount > 0) {
        await reversePendingCredit(tx, payment.beneficiaryId, payment.beneficiaryAmount);
      }

      return tx.payment.update({
        where: { id: payment.id },
        data: { status: newStatus, refundedAt: new Date(), refundAmount: totalRefunded },
        select: PAYMENT_SELECT,
      });
    });

    logger.info('Paiement remboursé', { paymentId: id, refundAmount, newStatus, adminUserId });
    return updated;
  }
}

export const paymentService = new PaymentService();
