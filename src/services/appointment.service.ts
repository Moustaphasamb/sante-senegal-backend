import {
  UserRole,
  AppointmentStatus,
  PaymentStatus,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import type {
  ListAppointmentsQuery,
  CreateAppointmentInput,
  CancelAppointmentInput,
  RescheduleAppointmentInput,
} from '../validators/appointment.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes métier
// ═══════════════════════════════════════════════════════════════════

const CONSULTATION_FEE_PERCENT = 5; // Commission plateforme 5% (règle R10)
const NO_SHOW_BLOCK_DAYS = 30;
const CONSECUTIVE_NO_SHOW_LIMIT = 3;

// Statuts qui "occupent" un créneau (ni annulé, ni terminé)
const OCCUPYING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.EN_ATTENTE,
  AppointmentStatus.CONFIRME,
  AppointmentStatus.EN_COURS,
  AppointmentStatus.REPROGRAMME,
];

// ═══════════════════════════════════════════════════════════════════
// Helpers internes
// ═══════════════════════════════════════════════════════════════════

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

/** Calcule le pourcentage de frais d'annulation selon le délai (règle R7) */
function cancellationFeePercent(scheduledAt: Date): number {
  const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil >= 24) return 0;
  if (hoursUntil >= 2) return 50;
  return 100;
}

/** Vérifie que le patient n'est pas bloqué pour no-shows consécutifs (règle R7) */
async function checkPatientNotBlocked(patientProfileId: string) {
  const lastThree = await prisma.appointment.findMany({
    where: {
      patientId: patientProfileId,
      status: {
        in: [
          AppointmentStatus.TERMINE,
          AppointmentStatus.NO_SHOW,
          AppointmentStatus.ANNULE_PATIENT,
          AppointmentStatus.ANNULE_PRATICIEN,
        ],
      },
    },
    orderBy: { scheduledAt: 'desc' },
    take: CONSECUTIVE_NO_SHOW_LIMIT,
    select: { status: true, scheduledAt: true },
  });

  if (
    lastThree.length === CONSECUTIVE_NO_SHOW_LIMIT &&
    lastThree.every((a) => a.status === AppointmentStatus.NO_SHOW)
  ) {
    const blockedUntil = new Date(
      lastThree[0].scheduledAt.getTime() + NO_SHOW_BLOCK_DAYS * 24 * 60 * 60 * 1000
    );
    if (blockedUntil > new Date()) {
      throw new ForbiddenError(
        `Votre compte est bloqué jusqu'au ${blockedUntil.toLocaleDateString('fr-FR')} suite à ${CONSECUTIVE_NO_SHOW_LIMIT} absences consécutives.`
      );
    }
  }
}

/** Génère les créneaux théoriques pour une journée à partir d'un DoctorSchedule */
function generateSlots(dateStr: string, startTime: string, endTime: string, slotMinutes: number) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const slots: { start: Date; end: Date; startTime: string; endTime: string }[] = [];
  const base = new Date(`${dateStr}T00:00:00.000Z`);

  let current = new Date(base);
  current.setUTCHours(startH, startM, 0, 0);

  const dayEnd = new Date(base);
  dayEnd.setUTCHours(endH, endM, 0, 0);

  while (current < dayEnd) {
    const slotEnd = new Date(current.getTime() + slotMinutes * 60000);
    if (slotEnd <= dayEnd) {
      slots.push({
        start: new Date(current),
        end: slotEnd,
        startTime: current.toISOString().slice(11, 16),
        endTime: slotEnd.toISOString().slice(11, 16),
      });
    }
    current = slotEnd;
  }
  return slots;
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class AppointmentService {
  // ─── LISTE MES RDV ────────────────────────────────────────────

  async list(userId: string, userRole: UserRole, query: ListAppointmentsQuery) {
    const { page, limit, status, from, to } = query;
    const skip = (page - 1) * limit;

    // Déterminer le filtre selon le rôle
    let profileFilter: { patientId: string } | { medecinId: string };
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      profileFilter = { patientId: p.id };
    } else {
      const m = await getMedecinProfile(userId);
      profileFilter = { medecinId: m.id };
    }

    const where = {
      ...profileFilter,
      ...(status && { status }),
      ...(from && { scheduledAt: { gte: new Date(`${from}T00:00:00Z`) } }),
      ...(to && { scheduledAt: { lte: new Date(`${to}T23:59:59Z`) } }),
    };

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          medecin: {
            select: { user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } }, specialties: true },
          },
          establishment: { select: { id: true, name: true, city: true } },
          payment: { select: { status: true, amount: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return { appointments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── MES RDV À VENIR ─────────────────────────────────────────

  async getUpcoming(userId: string, userRole: UserRole) {
    let profileFilter: { patientId: string } | { medecinId: string };
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      profileFilter = { patientId: p.id };
    } else {
      const m = await getMedecinProfile(userId);
      profileFilter = { medecinId: m.id };
    }

    return prisma.appointment.findMany({
      where: {
        ...profileFilter,
        scheduledAt: { gt: new Date() },
        status: { in: [AppointmentStatus.EN_ATTENTE, AppointmentStatus.CONFIRME] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      include: {
        medecin: {
          select: { user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } }, specialties: true },
        },
        establishment: { select: { id: true, name: true, city: true } },
      },
    });
  }

  // ─── CRÉER RDV ────────────────────────────────────────────────

  async create(patientUserId: string, data: CreateAppointmentInput, ipAddress?: string, userAgent?: string) {
    const patientProfile = await getPatientProfile(patientUserId);

    // Vérifier blocage no-show (règle R7)
    await checkPatientNotBlocked(patientProfile.id);

    // Vérifier que le médecin existe, est actif, et récupérer le tarif autoritatif
    const medecin = await prisma.medecinProfile.findUnique({
      where: { id: data.medecinId },
      select: {
        id: true,
        userId: true,
        consultationPriceMin: true,
        user: { select: { isActive: true, kycStatus: true } },
      },
    });
    if (!medecin || !medecin.user.isActive || medecin.user.kycStatus !== 'APPROVED') {
      throw new NotFoundError('Médecin');
    }
    if (medecin.consultationPriceMin === null || medecin.consultationPriceMin === undefined) {
      throw new BadRequestError(
        'Ce médecin n\'a pas encore configuré son tarif de consultation. Veuillez en choisir un autre.'
      );
    }
    // Prix autoritatif : issu du profil médecin, jamais du body client
    const price = medecin.consultationPriceMin;

    const scheduledAt = new Date(data.scheduledAt);

    // Vérifier que le créneau est dans le futur
    if (scheduledAt <= new Date()) {
      throw new BadRequestError('La date du rendez-vous doit être dans le futur');
    }

    // Vérifier qu'il n'y a pas déjà un RDV sur ce créneau pour ce médecin
    const slotEnd = new Date(scheduledAt.getTime() + (data.durationMinutes ?? 30) * 60000);
    const conflict = await prisma.appointment.findFirst({
      where: {
        medecinId: data.medecinId,
        status: { in: OCCUPYING_STATUSES },
        scheduledAt: { lt: slotEnd },
        // approximation : vérifier le chevauchement
      },
    });
    if (conflict) {
      const conflictEnd = new Date(conflict.scheduledAt.getTime() + conflict.durationMinutes * 60000);
      if (conflict.scheduledAt < slotEnd && conflictEnd > scheduledAt) {
        throw new ConflictError('Ce créneau est déjà occupé pour ce médecin');
      }
    }

    // Calcul commission 5% (règle R10) — sur le prix autoritatif du médecin
    const platformFee = Math.round(price * CONSULTATION_FEE_PERCENT / 100);
    const beneficiaryAmount = price - platformFee;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          payerId: patientUserId,
          beneficiaryId: medecin.userId,
          amount: price,
          platformFee,
          beneficiaryAmount,
          transactionType: TransactionType.CONSULTATION,
          method: PaymentMethod.WALLET_INTERNE,
          status: PaymentStatus.EN_ATTENTE,
          description: `Consultation — ${data.motif.substring(0, 100)}`,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          patientId: patientProfile.id,
          medecinId: data.medecinId,
          establishmentId: data.establishmentId,
          scheduledAt,
          durationMinutes: data.durationMinutes ?? 30,
          mode: data.mode,
          motif: data.motif,
          notes: data.notes,
          price,
          paymentId: payment.id,
        },
        include: {
          medecin: { select: { user: { select: { firstName: true, lastName: true } } } },
          payment: { select: { status: true, amount: true } },
        },
      });

      return { appointment, payment };
    });

    void createAuditLog({
      userId: patientUserId,
      action: 'CREATE_APPOINTMENT',
      resourceType: 'APPOINTMENT',
      resourceId: result.appointment.id,
      metadata: { medecinId: data.medecinId, scheduledAt: data.scheduledAt, price },
      ipAddress,
      userAgent,
    });

    logger.info('RDV créé', { appointmentId: result.appointment.id, patientUserId });
    return result;
  }

  // ─── DÉTAIL RDV ───────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        medecin: {
          select: { id: true, user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } }, specialties: true },
        },
        establishment: true,
        payment: { select: { status: true, amount: true, method: true } },
      },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');

    // Vérifier que l'utilisateur est impliqué
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      if (appointment.patientId !== p.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");
    } else {
      const m = await getMedecinProfile(userId);
      if (appointment.medecinId !== m.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");
    }

    return appointment;
  }

  // ─── ANNULER RDV ──────────────────────────────────────────────

  async cancel(
    id: string,
    userId: string,
    userRole: UserRole,
    data: CancelAppointmentInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, medecinId: true, status: true, scheduledAt: true, price: true, paymentId: true },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');

    const annulableStatuses: AppointmentStatus[] = [AppointmentStatus.EN_ATTENTE, AppointmentStatus.CONFIRME];
    if (!annulableStatuses.includes(appointment.status)) {
      throw new BadRequestError(`Impossible d'annuler un rendez-vous avec le statut "${appointment.status}"`);
    }

    let newStatus: AppointmentStatus;
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      if (appointment.patientId !== p.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");
      newStatus = AppointmentStatus.ANNULE_PATIENT;
    } else {
      const m = await getMedecinProfile(userId);
      if (appointment.medecinId !== m.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");
      newStatus = AppointmentStatus.ANNULE_PRATICIEN;
    }

    // Calcul frais d'annulation (règle R7)
    const feePercent = cancellationFeePercent(appointment.scheduledAt);
    const cancellationFee = Math.round(appointment.price * feePercent / 100);

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: { status: newStatus, cancellationReason: data.reason },
      });

      // Marquer le paiement comme remboursé (partiellement si frais) ou annulé
      if (appointment.paymentId) {
        if (feePercent === 0) {
          await tx.payment.update({
            where: { id: appointment.paymentId },
            data: { status: PaymentStatus.REMBOURSE },
          });
        } else if (feePercent < 100) {
          await tx.payment.update({
            where: { id: appointment.paymentId },
            data: { status: PaymentStatus.PARTIELLEMENT_REMBOURSE, refundAmount: appointment.price - cancellationFee },
          });
        }
        // Si 100% : le paiement reste EN_ATTENTE (frais conservés)
      }
    });

    void createAuditLog({
      userId,
      action: 'CANCEL_APPOINTMENT',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      metadata: { reason: data.reason, cancellationFee, feePercent, newStatus },
      ipAddress,
      userAgent,
    });

    logger.info('RDV annulé', { appointmentId: id, userId, feePercent });
    return { cancellationFee, feePercent };
  }

  // ─── REPROGRAMMER RDV ─────────────────────────────────────────

  async reschedule(
    id: string,
    patientUserId: string,
    data: RescheduleAppointmentInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const p = await getPatientProfile(patientUserId);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, medecinId: true, status: true, durationMinutes: true },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');
    if (appointment.patientId !== p.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");

    const reprogrammableStatuses: AppointmentStatus[] = [AppointmentStatus.EN_ATTENTE, AppointmentStatus.CONFIRME];
    if (!reprogrammableStatuses.includes(appointment.status)) {
      throw new BadRequestError(`Impossible de reprogrammer un rendez-vous avec le statut "${appointment.status}"`);
    }

    const newDate = new Date(data.scheduledAt);
    if (newDate <= new Date()) throw new BadRequestError('La nouvelle date doit être dans le futur');

    // Vérifier disponibilité du nouveau créneau
    const slotEnd = new Date(newDate.getTime() + appointment.durationMinutes * 60000);
    const conflict = await prisma.appointment.findFirst({
      where: {
        medecinId: appointment.medecinId,
        id: { not: id },
        status: { in: OCCUPYING_STATUSES },
        scheduledAt: { lt: slotEnd, gt: new Date(newDate.getTime() - appointment.durationMinutes * 60000) },
      },
    });
    if (conflict) throw new ConflictError('Ce nouveau créneau est déjà occupé pour ce médecin');

    const updated = await prisma.appointment.update({
      where: { id },
      data: { scheduledAt: newDate, status: AppointmentStatus.EN_ATTENTE },
    });

    void createAuditLog({
      userId: patientUserId,
      action: 'RESCHEDULE_APPOINTMENT',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      newValue: { scheduledAt: data.scheduledAt },
      ipAddress,
      userAgent,
    });

    logger.info('RDV reprogrammé', { appointmentId: id, patientUserId });
    return updated;
  }

  // ─── CHECK-IN ─────────────────────────────────────────────────

  async checkIn(id: string, patientUserId: string) {
    const p = await getPatientProfile(patientUserId);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, status: true, scheduledAt: true },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');
    if (appointment.patientId !== p.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");

    if (appointment.status !== AppointmentStatus.CONFIRME) {
      throw new BadRequestError("Le check-in n'est possible que sur un rendez-vous confirmé");
    }

    return prisma.appointment.update({
      where: { id },
      data: { checkedInAt: new Date() },
    });
  }

  // ─── DÉMARRER CONSULTATION ────────────────────────────────────

  async startConsultation(id: string, medecinUserId: string) {
    const m = await getMedecinProfile(medecinUserId);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, medecinId: true, status: true },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');
    if (appointment.medecinId !== m.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");

    const startableStatuses: AppointmentStatus[] = [AppointmentStatus.CONFIRME, AppointmentStatus.EN_ATTENTE];
    if (!startableStatuses.includes(appointment.status)) {
      throw new BadRequestError(`Impossible de démarrer un rendez-vous avec le statut "${appointment.status}"`);
    }

    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.EN_COURS, startedAt: new Date() },
    });
  }

  // ─── TERMINER CONSULTATION ────────────────────────────────────

  async endConsultation(id: string, medecinUserId: string) {
    const m = await getMedecinProfile(medecinUserId);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, medecinId: true, status: true, paymentId: true },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');
    if (appointment.medecinId !== m.id) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");

    if (appointment.status !== AppointmentStatus.EN_COURS) {
      throw new BadRequestError("Impossible de terminer un rendez-vous qui n'est pas en cours");
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.TERMINE, endedAt: new Date() },
      });
      // Marquer le paiement comme réussi
      if (appointment.paymentId) {
        await tx.payment.update({
          where: { id: appointment.paymentId },
          data: { status: PaymentStatus.REUSSI, paidAt: new Date() },
        });
      }
    });

    logger.info('Consultation terminée', { appointmentId: id, medecinUserId });
  }

  // ─── DISPONIBILITÉS MÉDECIN ───────────────────────────────────

  async getAvailability(medecinProfileId: string, dateStr: string) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { id: medecinProfileId },
      select: { id: true },
    });
    if (!medecin) throw new NotFoundError('Médecin');

    const date = new Date(`${dateStr}T00:00:00Z`);
    // 0=dim, 1=lun, ..., 6=sam (UTC)
    const dayOfWeek = date.getUTCDay();

    const schedule = await prisma.doctorSchedule.findUnique({
      where: { medecinId_dayOfWeek: { medecinId: medecinProfileId, dayOfWeek } },
    });
    if (!schedule || !schedule.isActive) return { date: dateStr, slots: [] };

    const allSlots = generateSlots(dateStr, schedule.startTime, schedule.endTime, schedule.slotDuration);

    const dayStart = new Date(`${dateStr}T00:00:00Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59Z`);

    // Créneaux bloqués par AvailabilitySlot
    const blocked = await prisma.availabilitySlot.findMany({
      where: {
        medecinId: medecinProfileId,
        isBlocked: true,
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
    });

    // RDV existants occupant des créneaux
    const existing = await prisma.appointment.findMany({
      where: {
        medecinId: medecinProfileId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: OCCUPYING_STATUSES },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });

    const freeSlots = allSlots.filter((slot) => {
      // Vérifier que le passé n'est pas inclus
      if (slot.start <= new Date()) return false;

      // Bloqué par exception ?
      const isBlocked = blocked.some(
        (b) => b.startTime <= slot.start && b.endTime >= slot.end
      );
      if (isBlocked) return false;

      // Occupé par un RDV ?
      const isOccupied = existing.some((appt) => {
        const apptEnd = new Date(appt.scheduledAt.getTime() + appt.durationMinutes * 60000);
        return appt.scheduledAt < slot.end && apptEnd > slot.start;
      });
      return !isOccupied;
    });

    return {
      date: dateStr,
      dayOfWeek,
      slotDurationMinutes: schedule.slotDuration,
      slots: freeSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, start: s.start, end: s.end })),
    };
  }
}

export const appointmentService = new AppointmentService();
