import {
  UserRole,
  AppointmentMode,
  AppointmentStatus,
  TeleconsultationStatus,
  RecordingStatus,
  NotificationType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { createAuditLog } from '../utils/audit';
import { getIO } from '../sockets';
import { getVideoProvider } from './video/index';
import { notificationService } from './notification.service';
import type { ListTeleconsultationsQuery } from '../validators/teleconsultation.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════

const CREATABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.EN_ATTENTE,
  AppointmentStatus.CONFIRME,
  AppointmentStatus.EN_COURS,
];

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/** Émet un événement Socket.io vers la room d'une téléconsultation (best-effort). */
function emitToRoom(teleconsultationId: string, event: string, payload: unknown): void {
  try {
    getIO().to(`teleconsultation:${teleconsultationId}`).emit(event, payload);
  } catch (err) {
    logger.warn('Émission Socket.io téléconsultation échouée', { teleconsultationId, event, err });
  }
}

function loadWithAppointment(id: string) {
  return prisma.teleconsultation.findUnique({
    where: { id },
    include: {
      appointment: {
        select: {
          id: true,
          mode: true,
          status: true,
          patient: { select: { userId: true } },
          medecin: { select: { userId: true } },
        },
      },
    },
  });
}

type TeleWithAppointment = NonNullable<Awaited<ReturnType<typeof loadWithAppointment>>>;

type AccessResult = {
  tele: TeleWithAppointment;
  isPatient: boolean;
  isMedecin: boolean;
};

/** Retire les jetons d'accès avant exposition HTTP. */
function publicView<T extends { medecinToken: string | null; patientToken: string | null }>(t: T) {
  const { medecinToken: _m, patientToken: _p, ...rest } = t;
  return rest;
}

class TeleconsultationService {
  /** Charge + vérifie que l'utilisateur est patient ou médecin du RDV lié. */
  private async resolveAccess(teleconsultationId: string, userId: string): Promise<AccessResult> {
    const tele = await loadWithAppointment(teleconsultationId);
    if (!tele) throw new NotFoundError('Téléconsultation');

    const isPatient = tele.appointment.patient.userId === userId;
    const isMedecin = tele.appointment.medecin.userId === userId;
    if (!isPatient && !isMedecin) {
      throw new ForbiddenError('Cette téléconsultation ne vous concerne pas');
    }
    return { tele, isPatient, isMedecin };
  }

  // ─── CRÉER / RÉCUPÉRER (idempotent) ──────────────────────────────
  async create(userId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        mode: true,
        status: true,
        patient: { select: { userId: true } },
        medecin: { select: { userId: true } },
      },
    });
    if (!appointment) throw new NotFoundError('Rendez-vous');

    const isPatient = appointment.patient.userId === userId;
    const isMedecin = appointment.medecin.userId === userId;
    if (!isPatient && !isMedecin) {
      throw new ForbiddenError('Ce rendez-vous ne vous concerne pas');
    }

    if (appointment.mode !== AppointmentMode.TELECONSULTATION) {
      throw new BadRequestError("Ce rendez-vous n'est pas une téléconsultation");
    }
    if (!CREATABLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      throw new BadRequestError(
        'Le statut du rendez-vous ne permet pas de démarrer une téléconsultation'
      );
    }

    // Idempotence : renvoyer l'existante
    const existing = await prisma.teleconsultation.findUnique({ where: { appointmentId } });
    if (existing) return publicView(existing);

    // Provisionner la room + 2 jetons
    const provider = getVideoProvider();
    const room = await provider.createRoom({ appointmentId });
    const [medecinToken, patientToken] = await Promise.all([
      provider.createAccessToken({
        roomUrl: room.roomUrl,
        providerRoomId: room.providerRoomId,
        userName: 'Médecin',
        role: 'medecin',
        isOwner: true,
      }),
      provider.createAccessToken({
        roomUrl: room.roomUrl,
        providerRoomId: room.providerRoomId,
        userName: 'Patient',
        role: 'patient',
        isOwner: false,
      }),
    ]);

    const tele = await prisma.teleconsultation.create({
      data: {
        appointmentId,
        provider: provider.name,
        providerRoomId: room.providerRoomId,
        roomUrl: room.roomUrl,
        medecinToken,
        patientToken,
        status: TeleconsultationStatus.EN_ATTENTE,
      },
    });

    logger.info('Téléconsultation créée', { id: tele.id, appointmentId, provider: provider.name });
    return publicView(tele);
  }

  // ─── LISTE (mes téléconsultations) ───────────────────────────────
  async listMine(userId: string, query: ListTeleconsultationsQuery) {
    const where = {
      appointment: {
        OR: [{ patient: { userId } }, { medecin: { userId } }],
      },
    };
    const [items, total] = await Promise.all([
      prisma.teleconsultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.teleconsultation.count({ where }),
    ]);
    return {
      items: items.map(publicView),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  // ─── DÉTAIL ──────────────────────────────────────────────────────
  async getById(teleconsultationId: string, userId: string, role: UserRole) {
    if (role === UserRole.SUPER_ADMIN) {
      const tele = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
      if (!tele) throw new NotFoundError('Téléconsultation');
      return publicView(tele);
    }
    const { tele } = await this.resolveAccess(teleconsultationId, userId);
    return publicView(tele);
  }

  // ─── REJOINDRE (renvoie MON jeton) ───────────────────────────────
  async join(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);

    if (
      tele.status === TeleconsultationStatus.TERMINEE ||
      tele.status === TeleconsultationStatus.ANNULEE
    ) {
      throw new BadRequestError('Cette téléconsultation est terminée');
    }

    // Recharger les jetons (loadWithAppointment ne les sélectionne pas)
    const full = await prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
      select: { roomUrl: true, medecinToken: true, patientToken: true, status: true, provider: true },
    });
    if (!full) throw new NotFoundError('Téléconsultation');

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_JOIN',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return {
      roomUrl: full.roomUrl,
      token: isMedecin ? full.medecinToken : full.patientToken,
      status: full.status,
      provider: full.provider,
    };
  }

  // ─── DÉMARRER (médecin) ──────────────────────────────────────────
  async start(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut démarrer la téléconsultation');
    if (tele.status !== TeleconsultationStatus.EN_ATTENTE) {
      throw new BadRequestError('La téléconsultation a déjà démarré ou est terminée');
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.teleconsultation.update({
        where: { id: teleconsultationId },
        data: { status: TeleconsultationStatus.EN_COURS, startedAt: now },
      });
      await tx.appointment.update({
        where: { id: tele.appointment.id },
        data: { status: AppointmentStatus.EN_COURS, startedAt: now },
      });
      return t;
    });

    // Notifier le patient (best-effort)
    void notificationService.notify(
      tele.appointment.patient.userId,
      NotificationType.SYSTEM,
      'Téléconsultation démarrée',
      "Votre médecin a démarré la téléconsultation. Rejoignez l'appel.",
      { actionUrl: `/teleconsultations/${teleconsultationId}` }
    );

    emitToRoom(teleconsultationId, 'teleconsultation:status', {
      status: TeleconsultationStatus.EN_COURS,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_START',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── TERMINER (médecin) ──────────────────────────────────────────
  async end(teleconsultationId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut terminer la téléconsultation');
    if (tele.status !== TeleconsultationStatus.EN_COURS) {
      throw new BadRequestError("La téléconsultation n'est pas en cours");
    }

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');

    const provider = getVideoProvider();

    // Arrêter l'enregistrement s'il est en cours (best-effort)
    if (full.recordingStatus === RecordingStatus.EN_COURS && full.providerRecordingId) {
      try {
        const { recordingUrl } = await provider.stopRecording(
          full.providerRoomId,
          full.providerRecordingId
        );
        await prisma.teleconsultation.update({
          where: { id: teleconsultationId },
          data: { recordingStatus: RecordingStatus.DISPONIBLE, recordingUrl },
        });
      } catch (err) {
        logger.warn('Arrêt enregistrement à la clôture échoué', { teleconsultationId, err });
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.teleconsultation.update({
        where: { id: teleconsultationId },
        data: { status: TeleconsultationStatus.TERMINEE, endedAt: now },
      });
      await tx.appointment.update({
        where: { id: tele.appointment.id },
        data: { status: AppointmentStatus.TERMINE, endedAt: now },
      });
      return t;
    });

    // Supprimer la room côté provider (best-effort)
    try {
      await provider.deleteRoom(full.providerRoomId);
    } catch (err) {
      logger.warn('Suppression room provider échouée', { teleconsultationId, err });
    }

    emitToRoom(teleconsultationId, 'teleconsultation:status', {
      status: TeleconsultationStatus.TERMINEE,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_END',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── CONSENTEMENT ENREGISTREMENT (patient) ───────────────────────
  async setRecordingConsent(teleconsultationId: string, userId: string, consent: boolean) {
    const { isPatient } = await this.resolveAccess(teleconsultationId, userId);
    if (!isPatient) throw new ForbiddenError('Seul le patient peut donner son consentement');

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: {
        recordingStatus: consent
          ? RecordingStatus.CONSENTEMENT_DONNE
          : RecordingStatus.CONSENTEMENT_REFUSE,
        recordingConsentAt: new Date(),
      },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: updated.recordingStatus,
    });

    return publicView(updated);
  }

  // ─── DÉMARRER ENREGISTREMENT (médecin, fail-closed) ──────────────
  async startRecording(
    teleconsultationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { tele, isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError('Seul le médecin peut enregistrer');
    if (tele.status !== TeleconsultationStatus.EN_COURS) {
      throw new BadRequestError("La téléconsultation n'est pas en cours");
    }

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');
    if (full.recordingStatus !== RecordingStatus.CONSENTEMENT_DONNE) {
      throw new ForbiddenError('Consentement du patient requis avant tout enregistrement');
    }

    const provider = getVideoProvider();
    const { providerRecordingId } = await provider.startRecording(full.providerRoomId);

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { recordingStatus: RecordingStatus.EN_COURS, providerRecordingId },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: RecordingStatus.EN_COURS,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_RECORDING_START',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── ARRÊTER ENREGISTREMENT (médecin) ────────────────────────────
  async stopRecording(
    teleconsultationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { isMedecin } = await this.resolveAccess(teleconsultationId, userId);
    if (!isMedecin) throw new ForbiddenError("Seul le médecin peut arrêter l'enregistrement");

    const full = await prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!full) throw new NotFoundError('Téléconsultation');
    if (full.recordingStatus !== RecordingStatus.EN_COURS || !full.providerRecordingId) {
      throw new BadRequestError('Aucun enregistrement en cours');
    }

    const provider = getVideoProvider();
    const { recordingUrl } = await provider.stopRecording(
      full.providerRoomId,
      full.providerRecordingId
    );

    const updated = await prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { recordingStatus: RecordingStatus.DISPONIBLE, recordingUrl },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:recording', {
      recordingStatus: RecordingStatus.DISPONIBLE,
    });

    await createAuditLog({
      userId,
      action: 'TELECONSULTATION_RECORDING_STOP',
      resourceType: 'Teleconsultation',
      resourceId: teleconsultationId,
      ipAddress,
      userAgent,
    });

    return publicView(updated);
  }

  // ─── CHAT : liste ────────────────────────────────────────────────
  async listMessages(teleconsultationId: string, userId: string) {
    await this.resolveAccess(teleconsultationId, userId);
    return prisma.teleconsultationMessage.findMany({
      where: { teleconsultationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── CHAT : envoyer ──────────────────────────────────────────────
  async sendMessage(teleconsultationId: string, userId: string, content: string) {
    await this.resolveAccess(teleconsultationId, userId);
    const message = await prisma.teleconsultationMessage.create({
      data: { teleconsultationId, senderId: userId, content },
    });

    emitToRoom(teleconsultationId, 'teleconsultation:message', {
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    });

    return message;
  }
}

export const teleconsultationService = new TeleconsultationService();
