import {
  UserRole,
  HomeVisitStatus,
  PaymentStatus,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import { getIO } from '../sockets';
import type {
  CreateHomeVisitInput,
  ListHomeVisitsQuery,
  CancelHomeVisitInput,
} from '../validators/home-visit.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════

const MATCH_TIMEOUT_MS = 60_000;        // 60 secondes par médecin (règle R8)
const MOBILE_PENALTY_DURATION_MS = 60 * 60_000; // 1h d'indispo (règle R8)
const CONSULTATION_FEE_PERCENT = 5;     // Commission plateforme (règle R10)

// Map des timeouts actifs en mémoire (homeVisitId → NodeJS.Timeout)
const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Score de matching — lower is better.
 * Critères R8 : distance (50%) + note (30%) + temps réponse (20%)
 */
function matchingScore(
  distance: number,
  maxRadius: number,
  rating: number,
  avgResponseTimeSec: number | null
): number {
  const distScore = distance / (maxRadius || 1);
  const ratingScore = 1 / (rating > 0 ? rating : 1);
  const responseScore = (avgResponseTimeSec ?? 999) / 60;
  return distScore * 0.5 + ratingScore * 0.3 + responseScore * 0.2;
}

async function getPatientProfile(userId: string) {
  const p = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!p) throw new NotFoundError('Profil patient');
  return p;
}

async function getMedecinProfile(userId: string) {
  const m = await prisma.medecinProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!m) throw new NotFoundError('Profil médecin');
  return m;
}

// ═══════════════════════════════════════════════════════════════════
// Matching engine
// ═══════════════════════════════════════════════════════════════════

interface MedecinCandidat {
  id: string;           // MedecinProfile.id
  userId: string;
  distance: number;
  score: number;
  mobileConsultationPrice: number;
  mobileTravelFee: number;
  mobileRadiusKm: number;
}

async function findBestCandidate(
  patientLat: number,
  patientLng: number,
  excludeIds: string[]
): Promise<MedecinCandidat | null> {
  const searchRadius = 50; // rayon de recherche initial (km)
  const latDelta = searchRadius / 111.32;
  const lngDelta = searchRadius / (111.32 * Math.cos((patientLat * Math.PI) / 180));

  const candidates = await prisma.medecinProfile.findMany({
    where: {
      isMobileAvailable: true,
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      currentLatitude: { gte: patientLat - latDelta, lte: patientLat + latDelta },
      currentLongitude: { gte: patientLng - lngDelta, lte: patientLng + lngDelta },
      user: { isActive: true, deletedAt: null, kycStatus: 'APPROVED', role: UserRole.MEDECIN_LIBERAL_MOBILE },
    },
    select: {
      id: true,
      userId: true,
      currentLatitude: true,
      currentLongitude: true,
      mobileRadiusKm: true,
      mobileConsultationPrice: true,
      mobileTravelFee: true,
      averageRating: true,
      averageResponseTime: true,
    },
  });

  const scored = candidates
    .filter((m) => m.currentLatitude !== null && m.currentLongitude !== null)
    .map((m) => {
      const distance = haversineKm(patientLat, patientLng, m.currentLatitude!, m.currentLongitude!);
      const radius = m.mobileRadiusKm ?? 10;
      return {
        ...m,
        distance,
        score: matchingScore(distance, radius, m.averageRating, m.averageResponseTime),
      };
    })
    .filter((m) => m.distance <= (m.mobileRadiusKm ?? 10))
    .sort((a, b) => a.score - b.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  return {
    id: best.id,
    userId: best.userId,
    distance: Math.round(best.distance * 10) / 10,
    score: best.score,
    mobileConsultationPrice: best.mobileConsultationPrice ?? 0,
    mobileTravelFee: best.mobileTravelFee ?? 0,
    mobileRadiusKm: best.mobileRadiusKm ?? 10,
  };
}

/**
 * Notifie le prochain médecin candidat et démarre le timeout 60s.
 * Appelé à la création ET après chaque refus/timeout.
 */
async function notifyNextMedecin(homeVisitId: string): Promise<void> {
  const visit = await prisma.homeVisit.findUnique({
    where: { id: homeVisitId },
    select: {
      id: true,
      status: true,
      patientLatitude: true,
      patientLongitude: true,
      urgencyLevel: true,
      motif: true,
      consultationPrice: true,
      travelFee: true,
      totalPrice: true,
      rejectedByMedecinIds: true,
      patient: { select: { userId: true } },
    },
  });

  if (!visit || visit.status !== HomeVisitStatus.RECHERCHE_MEDECIN) return;

  const candidate = await findBestCandidate(
    visit.patientLatitude,
    visit.patientLongitude,
    visit.rejectedByMedecinIds
  );

  if (!candidate) {
    // Aucun candidat → expirer la demande
    await prisma.homeVisit.update({
      where: { id: homeVisitId },
      data: { status: HomeVisitStatus.EXPIREE },
    });
    try {
      getIO()
        .to(`user:${visit.patient.userId}`)
        .emit('home-visit:status-change', {
          homeVisitId,
          status: HomeVisitStatus.EXPIREE,
          message: 'Aucun médecin disponible dans votre zone actuellement',
        });
    } catch {
      logger.warn('Socket.io indisponible pour notif expiration', { homeVisitId });
    }
    logger.info('HomeVisit expirée — aucun candidat', { homeVisitId });
    return;
  }

  // Mettre à jour expiresAt
  const expiresAt = new Date(Date.now() + MATCH_TIMEOUT_MS);
  await prisma.homeVisit.update({ where: { id: homeVisitId }, data: { expiresAt } });

  // Notifier le médecin via Socket.io
  try {
    getIO()
      .to(`user:${candidate.userId}`)
      .emit('home-visit:new-request', {
        homeVisitId,
        patientLatitude: visit.patientLatitude,
        patientLongitude: visit.patientLongitude,
        urgencyLevel: visit.urgencyLevel,
        motif: visit.motif,
        consultationPrice: visit.consultationPrice,
        travelFee: visit.travelFee,
        totalPrice: visit.totalPrice,
        distance: candidate.distance,
        expiresAt: expiresAt.toISOString(),
      });
  } catch {
    logger.warn('Socket.io indisponible pour notif médecin', { homeVisitId, medecinId: candidate.id });
  }

  logger.info('Médecin notifié pour home-visit', { homeVisitId, medecinId: candidate.id, distance: candidate.distance });

  // Timeout 60s — si le médecin ne répond pas, passer au suivant
  const timeoutKey = homeVisitId;
  if (activeTimeouts.has(timeoutKey)) clearTimeout(activeTimeouts.get(timeoutKey));

  const timeout = setTimeout(async () => {
    activeTimeouts.delete(timeoutKey);
    logger.info('Timeout 60s — médecin suivant', { homeVisitId, medecinId: candidate.id });
    try {
      await prisma.homeVisit.update({
        where: { id: homeVisitId },
        data: { rejectedByMedecinIds: { push: candidate.id } },
      });
      await notifyNextMedecin(homeVisitId);
    } catch (err) {
      logger.error('Erreur timeout home-visit', { homeVisitId, err });
    }
  }, MATCH_TIMEOUT_MS);

  activeTimeouts.set(timeoutKey, timeout);
}

/** Annule le timeout actif pour un homeVisit */
function clearMatchingTimeout(homeVisitId: string): void {
  const t = activeTimeouts.get(homeVisitId);
  if (t) {
    clearTimeout(t);
    activeTimeouts.delete(homeVisitId);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class HomeVisitService {
  // ─── CRÉER DEMANDE ────────────────────────────────────────────

  async create(
    patientUserId: string,
    data: CreateHomeVisitInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const patientProfile = await getPatientProfile(patientUserId);

    // Vérifier qu'il n'y a pas déjà une demande active pour ce patient
    const existing = await prisma.homeVisit.findFirst({
      where: {
        patientId: patientProfile.id,
        status: { in: [HomeVisitStatus.RECHERCHE_MEDECIN, HomeVisitStatus.ACCEPTEE, HomeVisitStatus.EN_ROUTE, HomeVisitStatus.ARRIVEE, HomeVisitStatus.EN_CONSULTATION] },
      },
    });
    if (existing) {
      throw new ConflictError('Vous avez déjà une visite à domicile en cours');
    }

    // Trouver le meilleur candidat disponible pour établir le tarif
    const firstCandidate = await findBestCandidate(
      data.patientLatitude,
      data.patientLongitude,
      []
    );
    if (!firstCandidate) {
      throw new ConflictError(
        'Aucun médecin libéral mobile disponible dans votre zone actuellement. Réessayez plus tard.'
      );
    }

    const consultationPrice = firstCandidate.mobileConsultationPrice;
    const travelFee = firstCandidate.mobileTravelFee;
    const totalPrice = consultationPrice + travelFee;
    const platformFee = Math.round(totalPrice * CONSULTATION_FEE_PERCENT / 100);
    const beneficiaryAmount = totalPrice - platformFee;

    const homeVisit = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          payerId: patientUserId,
          beneficiaryId: firstCandidate.userId,
          amount: totalPrice,
          platformFee,
          beneficiaryAmount,
          transactionType: TransactionType.CONSULTATION,
          method: PaymentMethod.WALLET_INTERNE,
          status: PaymentStatus.EN_ATTENTE,
          description: `Visite à domicile — ${data.motif.substring(0, 80)}`,
        },
      });

      return tx.homeVisit.create({
        data: {
          patientId: patientProfile.id,
          status: HomeVisitStatus.RECHERCHE_MEDECIN,
          urgencyLevel: data.urgencyLevel,
          motif: data.motif,
          patientLatitude: data.patientLatitude,
          patientLongitude: data.patientLongitude,
          patientAddress: data.patientAddress,
          patientPhoneNumber: data.patientPhoneNumber,
          consultationPrice,
          travelFee,
          totalPrice,
          paymentId: payment.id,
        },
      });
    });

    void createAuditLog({
      userId: patientUserId,
      action: 'CREATE_HOME_VISIT',
      resourceType: 'HOME_VISIT',
      resourceId: homeVisit.id,
      metadata: { lat: data.patientLatitude, lng: data.patientLongitude, urgencyLevel: data.urgencyLevel },
      ipAddress,
      userAgent,
    });

    logger.info('HomeVisit créée', { homeVisitId: homeVisit.id, patientUserId });

    // Démarrer le matching en arrière-plan
    void notifyNextMedecin(homeVisit.id);

    return homeVisit;
  }

  // ─── LISTE MES VISITES ────────────────────────────────────────

  async list(userId: string, userRole: UserRole, query: ListHomeVisitsQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    let profileFilter: { patientId: string } | { medecinId: string };
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      profileFilter = { patientId: p.id };
    } else {
      const m = await getMedecinProfile(userId);
      profileFilter = { medecinId: m.id };
    }

    const where = { ...profileFilter, ...(status && { status }) };
    const [visits, total] = await prisma.$transaction([
      prisma.homeVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          medecin: {
            select: {
              user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
              specialties: true,
              currentLatitude: true,
              currentLongitude: true,
            },
          },
          payment: { select: { status: true, amount: true } },
        },
      }),
      prisma.homeVisit.count({ where }),
    ]);

    return { visits, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const visit = await prisma.homeVisit.findUnique({
      where: { id },
      include: {
        medecin: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, profilePhotoUrl: true, phoneNumber: true } },
            specialties: true,
            currentLatitude: true,
            currentLongitude: true,
          },
        },
        payment: { select: { status: true, amount: true, method: true } },
      },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');

    // Vérifier que l'utilisateur est impliqué
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      if (visit.patientId !== p.id) throw new ForbiddenError("Cette visite ne vous appartient pas");
    } else {
      const m = await getMedecinProfile(userId);
      if (visit.medecinId !== m.id) throw new ForbiddenError("Cette visite ne vous appartient pas");
    }

    return visit;
  }

  // ─── ACCEPTER (médecin) ───────────────────────────────────────

  async accept(id: string, medecinUserId: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const visit = await prisma.homeVisit.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        patientId: true,
        rejectedByMedecinIds: true,
        patient: { select: { userId: true } },
      },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');

    if (visit.status !== HomeVisitStatus.RECHERCHE_MEDECIN) {
      throw new BadRequestError(`Impossible d'accepter une visite avec le statut "${visit.status}"`);
    }
    // Vérifier que la demande n'a pas expiré pour ce médecin
    if (visit.expiresAt && visit.expiresAt < new Date()) {
      throw new BadRequestError('Le délai d\'acceptation a expiré pour cette visite');
    }
    if (visit.rejectedByMedecinIds.includes(medecinProfile.id)) {
      throw new ForbiddenError('Vous avez déjà refusé cette visite');
    }

    clearMatchingTimeout(id);

    const updated = await prisma.homeVisit.update({
      where: { id },
      data: {
        medecinId: medecinProfile.id,
        status: HomeVisitStatus.ACCEPTEE,
        acceptedAt: new Date(),
      },
    });

    // Notifier le patient
    try {
      getIO()
        .to(`user:${visit.patient.userId}`)
        .emit('home-visit:accepted', {
          homeVisitId: id,
          medecinId: medecinProfile.id,
          status: HomeVisitStatus.ACCEPTEE,
        });
    } catch {}

    void createAuditLog({ userId: medecinUserId, action: 'ACCEPT_HOME_VISIT', resourceType: 'HOME_VISIT', resourceId: id });
    logger.info('HomeVisit acceptée', { homeVisitId: id, medecinUserId });
    return updated;
  }

  // ─── REFUSER (médecin) ────────────────────────────────────────

  async reject(id: string, medecinUserId: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const visit = await prisma.homeVisit.findUnique({
      where: { id },
      select: { id: true, status: true, rejectedByMedecinIds: true },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');

    if (visit.status !== HomeVisitStatus.RECHERCHE_MEDECIN) {
      throw new BadRequestError(`Impossible de refuser une visite avec le statut "${visit.status}"`);
    }

    clearMatchingTimeout(id);

    await prisma.homeVisit.update({
      where: { id },
      data: { rejectedByMedecinIds: { push: medecinProfile.id } },
    });

    void createAuditLog({ userId: medecinUserId, action: 'REJECT_HOME_VISIT', resourceType: 'HOME_VISIT', resourceId: id });
    logger.info('HomeVisit refusée', { homeVisitId: id, medecinUserId });

    // Chercher le médecin suivant
    void notifyNextMedecin(id);
  }

  // ─── EN ROUTE (médecin) ───────────────────────────────────────

  async startTrip(id: string, medecinUserId: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const visit = await this._getVisitForMedecin(id, medecinProfile.id);

    if (visit.status !== HomeVisitStatus.ACCEPTEE) {
      throw new BadRequestError("Le médecin doit d'abord accepter la visite");
    }

    const updated = await prisma.homeVisit.update({
      where: { id },
      data: { status: HomeVisitStatus.EN_ROUTE },
    });

    this._emitStatusChange(id, visit.patient.userId, HomeVisitStatus.EN_ROUTE);
    logger.info('HomeVisit en route', { homeVisitId: id, medecinUserId });
    return updated;
  }

  // ─── ARRIVÉ (médecin) ─────────────────────────────────────────

  async arrived(id: string, medecinUserId: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const visit = await this._getVisitForMedecin(id, medecinProfile.id);

    if (visit.status !== HomeVisitStatus.EN_ROUTE) {
      throw new BadRequestError("Le médecin doit être en route avant de signaler son arrivée");
    }

    const updated = await prisma.homeVisit.update({
      where: { id },
      data: { status: HomeVisitStatus.ARRIVEE, arrivedAt: new Date() },
    });

    this._emitStatusChange(id, visit.patient.userId, HomeVisitStatus.ARRIVEE);
    logger.info('HomeVisit arrivée', { homeVisitId: id, medecinUserId });
    return updated;
  }

  // ─── TERMINER (médecin) ───────────────────────────────────────

  async complete(id: string, medecinUserId: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const visit = await this._getVisitForMedecin(id, medecinProfile.id);

    const completableStatuses: HomeVisitStatus[] = [HomeVisitStatus.ARRIVEE, HomeVisitStatus.EN_CONSULTATION];
    if (!completableStatuses.includes(visit.status)) {
      throw new BadRequestError(`Impossible de terminer une visite avec le statut "${visit.status}"`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.homeVisit.update({
        where: { id },
        data: { status: HomeVisitStatus.TERMINEE, endedAt: new Date() },
      });
      if (visit.paymentId) {
        await tx.payment.update({
          where: { id: visit.paymentId },
          data: { status: PaymentStatus.REUSSI, paidAt: new Date() },
        });
      }
    });

    this._emitStatusChange(id, visit.patient.userId, HomeVisitStatus.TERMINEE);
    void createAuditLog({ userId: medecinUserId, action: 'COMPLETE_HOME_VISIT', resourceType: 'HOME_VISIT', resourceId: id });
    logger.info('HomeVisit terminée', { homeVisitId: id, medecinUserId });
  }

  // ─── ANNULER (patient ou médecin) ─────────────────────────────

  async cancel(
    id: string,
    userId: string,
    userRole: UserRole,
    data: CancelHomeVisitInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const visit = await prisma.homeVisit.findUnique({
      where: { id },
      select: {
        id: true, patientId: true, medecinId: true, status: true,
        totalPrice: true, paymentId: true, acceptedAt: true,
        patient: { select: { userId: true } },
        medecin: { select: { userId: true } },
      },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');

    const cancellableStatuses: HomeVisitStatus[] = [
      HomeVisitStatus.RECHERCHE_MEDECIN,
      HomeVisitStatus.ACCEPTEE,
      HomeVisitStatus.EN_ROUTE,
    ];
    if (!cancellableStatuses.includes(visit.status)) {
      throw new BadRequestError(`Impossible d'annuler une visite avec le statut "${visit.status}"`);
    }

    let newStatus: HomeVisitStatus;
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      if (visit.patientId !== p.id) throw new ForbiddenError("Cette visite ne vous appartient pas");
      newStatus = HomeVisitStatus.ANNULEE_PATIENT;
    } else {
      const m = await getMedecinProfile(userId);
      if (visit.medecinId !== m.id) throw new ForbiddenError("Cette visite ne vous appartient pas");
      newStatus = HomeVisitStatus.ANNULEE_MEDECIN;
    }

    clearMatchingTimeout(id);

    // Frais annulation patient après acceptation : 50% (règle R8)
    let cancellationFee = 0;
    if (newStatus === HomeVisitStatus.ANNULEE_PATIENT && visit.acceptedAt) {
      cancellationFee = Math.round(visit.totalPrice * 0.5);
    }

    await prisma.$transaction(async (tx) => {
      await tx.homeVisit.update({
        where: { id },
        data: { status: newStatus, cancellationReason: data.reason, cancelledByRole: userRole },
      });
      if (visit.paymentId) {
        const refundAmount = visit.totalPrice - cancellationFee;
        await tx.payment.update({
          where: { id: visit.paymentId },
          data: {
            status: cancellationFee > 0 ? PaymentStatus.PARTIELLEMENT_REMBOURSE : PaymentStatus.REMBOURSE,
            refundAmount: cancellationFee > 0 ? refundAmount : visit.totalPrice,
          },
        });
      }
    });

    // Pénalité médecin : désactiver mobile pendant 1h (règle R8)
    if (newStatus === HomeVisitStatus.ANNULEE_MEDECIN) {
      const m = await getMedecinProfile(userId);
      await prisma.medecinProfile.update({
        where: { id: m.id },
        data: { isMobileAvailable: false },
      });
      // Ré-activer après 1h (setTimeout en mémoire)
      setTimeout(async () => {
        try {
          await prisma.medecinProfile.update({
            where: { id: m.id },
            data: { isMobileAvailable: true },
          });
          logger.info('Disponibilité mobile restaurée après pénalité', { medecinId: m.id });
        } catch {}
      }, MOBILE_PENALTY_DURATION_MS);

      logger.info('Pénalité annulation médecin appliquée — indispo 1h', { medecinUserId: userId });
    }

    // Notifier le patient (si médecin annule) ou le médecin (si patient annule)
    const notifyUserId = newStatus === HomeVisitStatus.ANNULEE_MEDECIN
      ? visit.patient.userId
      : visit.medecin?.userId;
    if (notifyUserId) {
      try {
        getIO().to(`user:${notifyUserId}`).emit('home-visit:status-change', {
          homeVisitId: id,
          status: newStatus,
          cancellationFee,
        });
      } catch {}
    }

    void createAuditLog({
      userId,
      action: 'CANCEL_HOME_VISIT',
      resourceType: 'HOME_VISIT',
      resourceId: id,
      metadata: { reason: data.reason, cancellationFee, newStatus },
      ipAddress,
      userAgent,
    });

    logger.info('HomeVisit annulée', { homeVisitId: id, userId, cancellationFee });
    return { cancellationFee };
  }

  // ─── Helpers privés ───────────────────────────────────────────

  private async _getVisitForMedecin(id: string, medecinProfileId: string) {
    const visit = await prisma.homeVisit.findUnique({
      where: { id },
      select: {
        id: true, status: true, medecinId: true, paymentId: true,
        patient: { select: { userId: true } },
      },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');
    if (visit.medecinId !== medecinProfileId) throw new ForbiddenError("Cette visite ne vous appartient pas");
    return visit;
  }

  private _emitStatusChange(homeVisitId: string, patientUserId: string, status: HomeVisitStatus) {
    try {
      getIO().to(`home-visit:${homeVisitId}`).emit('home-visit:status-change', { homeVisitId, status });
      getIO().to(`user:${patientUserId}`).emit('home-visit:status-change', { homeVisitId, status });
    } catch {}
  }
}

export const homeVisitService = new HomeVisitService();
