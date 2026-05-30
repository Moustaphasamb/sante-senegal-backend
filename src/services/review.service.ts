import {
  UserRole,
  AppointmentStatus,
  HomeVisitStatus,
  PharmacyOrderStatus,
  DeliveryStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  CreateReviewInput,
  RespondReviewInput,
  ModerateReviewInput,
  ListReviewsQuery,
} from '../validators/review.validators';

const REVIEW_INCLUDE = {
  giver: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service Avis & Notation
// ═══════════════════════════════════════════════════════════════════

class ReviewService {
  // ─── CRÉER ────────────────────────────────────────────────────

  async create(giverId: string, data: CreateReviewInput) {
    const { targetId, targetEntityId } = await this.resolveTarget(data);

    if (targetId === giverId) {
      throw new BadRequestError('Vous ne pouvez pas vous évaluer vous-même');
    }

    // Vérifier que l'avis repose sur une interaction réelle et terminée
    await this.verifyEligibility(giverId, targetId, targetEntityId, data);

    // Empêcher plusieurs avis pour un même contexte (RDV, visite, commande, livraison)
    await this.assertNotDuplicated(giverId, data);

    const review = await prisma.review.create({
      data: {
        giverId,
        targetId,
        targetType: data.targetType,
        targetEntityId,
        rating: data.rating,
        comment: data.comment,
        appointmentId: data.appointmentId,
        homeVisitId: data.homeVisitId,
        orderId: data.orderId,
        deliveryId: data.deliveryId,
      },
      include: REVIEW_INCLUDE,
    });

    await this.recomputeRating(data.targetType, targetId, targetEntityId);

    logger.info('Avis créé', { reviewId: review.id, targetType: data.targetType, rating: data.rating });
    return review;
  }

  // ─── AVIS SUR UN UTILISATEUR (public, approuvés) ──────────────

  async listForTarget(targetUserId: string, query: ListReviewsQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const where = { targetId: targetUserId, isApproved: true };

    const [reviews, total, agg] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: REVIEW_INCLUDE,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);

    return {
      reviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        averageRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      },
    };
  }

  // ─── MES AVIS REÇUS (toutes catégories de statut) ─────────────

  async myReceived(userId: string, query: ListReviewsQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const where = { targetId: userId };

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: REVIEW_INCLUDE,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── RÉPONDRE (cible de l'avis) ───────────────────────────────

  async respond(id: string, userId: string, data: RespondReviewInput) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, targetId: true, response: true },
    });
    if (!review) throw new NotFoundError('Avis');
    if (review.targetId !== userId) {
      throw new ForbiddenError('Vous ne pouvez répondre qu\'aux avis vous concernant');
    }
    if (review.response) throw new BadRequestError('Vous avez déjà répondu à cet avis');

    const updated = await prisma.review.update({
      where: { id },
      data: { response: data.response, respondedAt: new Date() },
      include: REVIEW_INCLUDE,
    });
    logger.info('Réponse à un avis', { reviewId: id, userId });
    return updated;
  }

  // ─── MODÉRER (admin) ──────────────────────────────────────────

  async moderate(id: string, adminUserId: string, data: ModerateReviewInput) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, targetType: true, targetId: true, targetEntityId: true },
    });
    if (!review) throw new NotFoundError('Avis');

    const updated = await prisma.review.update({
      where: { id },
      data: {
        isModerated: true,
        isApproved: data.isApproved,
        ...(data.isFlagged !== undefined && { isFlagged: data.isFlagged }),
        ...(data.moderationNotes !== undefined && { moderationNotes: data.moderationNotes }),
      },
      include: REVIEW_INCLUDE,
    });

    // L'approbation impacte la note moyenne → recalcul
    // (targetType est stocké en String : on le restreint à notre union)
    await this.recomputeRating(
      review.targetType as CreateReviewInput['targetType'],
      review.targetId,
      review.targetEntityId
    );

    logger.info('Avis modéré', { reviewId: id, isApproved: data.isApproved, adminUserId });
    return updated;
  }

  // ─── Internes ─────────────────────────────────────────────────

  /** Résout l'utilisateur cible (et l'entité) selon le type d'avis */
  private async resolveTarget(data: CreateReviewInput): Promise<{ targetId: string; targetEntityId: string | null }> {
    switch (data.targetType) {
      case 'MEDECIN': {
        const m = await prisma.medecinProfile.findUnique({
          where: { userId: data.targetUserId! },
          select: { userId: true },
        });
        if (!m) throw new NotFoundError('Médecin');
        return { targetId: m.userId, targetEntityId: null };
      }
      case 'LIVREUR': {
        const l = await prisma.livreurProfile.findUnique({
          where: { userId: data.targetUserId! },
          select: { userId: true },
        });
        if (!l) throw new NotFoundError('Livreur');
        return { targetId: l.userId, targetEntityId: null };
      }
      case 'PHARMACY': {
        const p = await prisma.pharmacy.findUnique({
          where: { id: data.targetEntityId! },
          select: { id: true, pharmacien: { select: { userId: true } } },
        });
        if (!p) throw new NotFoundError('Pharmacie');
        if (!p.pharmacien?.userId) {
          throw new BadRequestError("Cette pharmacie n'a pas de gérant enregistré, avis impossible");
        }
        return { targetId: p.pharmacien.userId, targetEntityId: p.id };
      }
      case 'ESTABLISHMENT': {
        const e = await prisma.establishment.findUnique({
          where: { id: data.targetEntityId! },
          select: { id: true },
        });
        if (!e) throw new NotFoundError('Établissement');
        const admin = await prisma.adminProfile.findFirst({
          where: { establishmentId: e.id },
          select: { userId: true },
        });
        if (!admin) {
          throw new BadRequestError("Cet établissement n'a pas d'administrateur enregistré, avis impossible");
        }
        return { targetId: admin.userId, targetEntityId: e.id };
      }
    }
  }

  /**
   * Vérifie que l'auteur a réellement bénéficié d'une prestation TERMINÉE
   * avec la cible. Empêche les faux avis et la manipulation de notes.
   */
  private async verifyEligibility(
    giverId: string,
    targetId: string,
    targetEntityId: string | null,
    data: CreateReviewInput
  ): Promise<void> {
    switch (data.targetType) {
      case 'MEDECIN': {
        // Un RDV terminé OU une visite à domicile terminée avec ce médecin
        if (data.appointmentId) {
          const appt = await prisma.appointment.findUnique({
            where: { id: data.appointmentId },
            select: {
              status: true,
              patient: { select: { userId: true } },
              medecin: { select: { userId: true } },
            },
          });
          if (!appt || appt.patient.userId !== giverId || appt.medecin.userId !== targetId) {
            throw new ForbiddenError('Aucun rendez-vous correspondant trouvé pour cet avis');
          }
          if (appt.status !== AppointmentStatus.TERMINE) {
            throw new BadRequestError('Vous ne pouvez noter qu\'après un rendez-vous terminé');
          }
          return;
        }
        if (data.homeVisitId) {
          const visit = await prisma.homeVisit.findUnique({
            where: { id: data.homeVisitId },
            select: {
              status: true,
              patient: { select: { userId: true } },
              medecin: { select: { userId: true } },
            },
          });
          if (!visit || visit.patient.userId !== giverId || visit.medecin?.userId !== targetId) {
            throw new ForbiddenError('Aucune visite correspondante trouvée pour cet avis');
          }
          if (visit.status !== HomeVisitStatus.TERMINEE) {
            throw new BadRequestError('Vous ne pouvez noter qu\'après une visite terminée');
          }
          return;
        }
        throw new BadRequestError('Un rendez-vous ou une visite terminée est requis pour noter un médecin');
      }

      case 'LIVREUR': {
        if (!data.deliveryId) {
          throw new BadRequestError('Une livraison terminée est requise pour noter un livreur');
        }
        const delivery = await prisma.delivery.findUnique({
          where: { id: data.deliveryId },
          select: {
            status: true,
            livreur: { select: { userId: true } },
            order: { select: { patient: { select: { userId: true } } } },
          },
        });
        if (!delivery || delivery.order.patient.userId !== giverId || delivery.livreur?.userId !== targetId) {
          throw new ForbiddenError('Aucune livraison correspondante trouvée pour cet avis');
        }
        if (delivery.status !== DeliveryStatus.LIVREE) {
          throw new BadRequestError('Vous ne pouvez noter qu\'après une livraison effectuée');
        }
        return;
      }

      case 'PHARMACY': {
        if (!data.orderId) {
          throw new BadRequestError('Une commande terminée est requise pour noter une pharmacie');
        }
        const order = await prisma.pharmacyOrder.findUnique({
          where: { id: data.orderId },
          select: { status: true, pharmacyId: true, patient: { select: { userId: true } } },
        });
        if (!order || order.patient.userId !== giverId || order.pharmacyId !== targetEntityId) {
          throw new ForbiddenError('Aucune commande correspondante trouvée pour cet avis');
        }
        if (order.status !== PharmacyOrderStatus.RETIREE && order.status !== PharmacyOrderStatus.LIVREE) {
          throw new BadRequestError('Vous ne pouvez noter qu\'après une commande livrée ou retirée');
        }
        return;
      }

      case 'ESTABLISHMENT': {
        if (!data.appointmentId) {
          throw new BadRequestError('Un rendez-vous terminé dans cet établissement est requis');
        }
        const appt = await prisma.appointment.findUnique({
          where: { id: data.appointmentId },
          select: { status: true, establishmentId: true, patient: { select: { userId: true } } },
        });
        if (!appt || appt.patient.userId !== giverId || appt.establishmentId !== targetEntityId) {
          throw new ForbiddenError('Aucun rendez-vous correspondant trouvé pour cet établissement');
        }
        if (appt.status !== AppointmentStatus.TERMINE) {
          throw new BadRequestError('Vous ne pouvez noter qu\'après un rendez-vous terminé');
        }
        return;
      }
    }
  }

  /** Empêche un second avis sur le même contexte (RDV, visite, commande, livraison) */
  private async assertNotDuplicated(giverId: string, data: CreateReviewInput): Promise<void> {
    const contexts: { field: 'appointmentId' | 'homeVisitId' | 'orderId' | 'deliveryId'; value?: string }[] = [
      { field: 'appointmentId', value: data.appointmentId },
      { field: 'homeVisitId', value: data.homeVisitId },
      { field: 'orderId', value: data.orderId },
      { field: 'deliveryId', value: data.deliveryId },
    ];
    for (const ctx of contexts) {
      if (!ctx.value) continue;
      const existing = await prisma.review.findFirst({
        where: { giverId, [ctx.field]: ctx.value },
        select: { id: true },
      });
      if (existing) throw new ConflictError('Vous avez déjà laissé un avis pour cette prestation');
    }
  }

  /** Recalcule la note moyenne et le total d'avis approuvés de la cible */
  private async recomputeRating(
    targetType: CreateReviewInput['targetType'],
    targetId: string,
    targetEntityId: string | null
  ): Promise<void> {
    if (targetType === 'MEDECIN' || targetType === 'LIVREUR') {
      const where = { targetType, targetId, isApproved: true };
      const agg = await prisma.review.aggregate({ where, _avg: { rating: true }, _count: true });
      const averageRating = Math.round((agg._avg.rating ?? 0) * 10) / 10;

      if (targetType === 'MEDECIN') {
        await prisma.medecinProfile.update({
          where: { userId: targetId },
          data: { averageRating, totalReviews: agg._count },
        });
      } else {
        // LivreurProfile : pas de champ totalReviews
        await prisma.livreurProfile.update({
          where: { userId: targetId },
          data: { averageRating },
        });
      }
      return;
    }

    if (!targetEntityId) return;
    const where = { targetType, targetEntityId, isApproved: true };
    const agg = await prisma.review.aggregate({ where, _avg: { rating: true }, _count: true });
    const averageRating = Math.round((agg._avg.rating ?? 0) * 10) / 10;

    if (targetType === 'PHARMACY') {
      await prisma.pharmacy.update({
        where: { id: targetEntityId },
        data: { averageRating, totalReviews: agg._count },
      });
    } else {
      await prisma.establishment.update({
        where: { id: targetEntityId },
        data: { averageRating, totalReviews: agg._count },
      });
    }
  }
}

export const reviewService = new ReviewService();
