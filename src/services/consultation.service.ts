import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import type {
  CreateConsultationInput,
  UpdateConsultationInput,
  ListConsultationsQuery,
} from '../validators/consultation.validators';

// ═══════════════════════════════════════════════════════════════════
// Constante
// ═══════════════════════════════════════════════════════════════════

const EDIT_WINDOW_HOURS = 24;

// ═══════════════════════════════════════════════════════════════════
// Helpers internes
// ═══════════════════════════════════════════════════════════════════

async function getMedecinProfile(userId: string) {
  const m = await prisma.medecinProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!m) throw new NotFoundError('Profil médecin');
  return m;
}

async function getPatientProfile(userId: string) {
  const p = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!p) throw new NotFoundError('Profil patient');
  return p;
}

/** Résout le MedicalRecord depuis un appointmentId ou homeVisitId */
async function resolveContext(
  medecinProfileId: string,
  appointmentId?: string,
  homeVisitId?: string
): Promise<{ medicalRecordId: string; patientUserId: string }> {
  if (appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        medecinId: true,
        patient: {
          select: {
            id: true,
            userId: true,
            medicalRecord: { select: { id: true } },
          },
        },
      },
    });
    if (!appt) throw new NotFoundError('Rendez-vous');
    if (appt.medecinId !== medecinProfileId) throw new ForbiddenError("Ce rendez-vous ne vous appartient pas");
    if (!appt.patient.medicalRecord) throw new BadRequestError("Ce patient n'a pas encore de dossier médical");

    // Vérifier qu'il n'y a pas déjà une consultation pour ce RDV
    const existing = await prisma.consultation.findUnique({ where: { appointmentId } });
    if (existing) throw new ConflictError('Une consultation existe déjà pour ce rendez-vous');

    return { medicalRecordId: appt.patient.medicalRecord.id, patientUserId: appt.patient.userId };
  }

  if (homeVisitId) {
    const visit = await prisma.homeVisit.findUnique({
      where: { id: homeVisitId },
      select: {
        medecinId: true,
        patient: {
          select: {
            id: true,
            userId: true,
            medicalRecord: { select: { id: true } },
          },
        },
      },
    });
    if (!visit) throw new NotFoundError('Visite à domicile');
    if (visit.medecinId !== medecinProfileId) throw new ForbiddenError("Cette visite ne vous appartient pas");
    if (!visit.patient.medicalRecord) throw new BadRequestError("Ce patient n'a pas encore de dossier médical");

    const existing = await prisma.consultation.findUnique({ where: { homeVisitId } });
    if (existing) throw new ConflictError('Une consultation existe déjà pour cette visite');

    return { medicalRecordId: visit.patient.medicalRecord.id, patientUserId: visit.patient.userId };
  }

  throw new BadRequestError('appointmentId ou homeVisitId requis');
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class ConsultationService {
  // ─── CRÉER CONSULTATION ───────────────────────────────────────

  async create(
    medecinUserId: string,
    data: CreateConsultationInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const medecinProfile = await getMedecinProfile(medecinUserId);

    const { medicalRecordId, patientUserId } = await resolveContext(
      medecinProfile.id,
      data.appointmentId,
      data.homeVisitId
    );

    const consultation = await prisma.consultation.create({
      data: {
        medicalRecordId,
        medecinId: medecinProfile.id,
        appointmentId: data.appointmentId,
        homeVisitId: data.homeVisitId,
        consultationDate: new Date(data.consultationDate),
        motif: data.motif,
        symptoms: data.symptoms,
        examination: data.examination,
        diagnosis: data.diagnosis,
        icd10Codes: data.icd10Codes ?? [],
        treatment: data.treatment,
        recommendations: data.recommendations,
        followUpNeeded: data.followUpNeeded ?? false,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        bloodPressure: data.bloodPressure,
        heartRate: data.heartRate,
        temperature: data.temperature,
        oxygenSaturation: data.oxygenSaturation,
        weight: data.weight,
        height: data.height,
      },
      include: {
        medecin: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    void createAuditLog({
      userId: medecinUserId,
      action: 'CREATE_CONSULTATION',
      resourceType: 'DME',
      resourceId: medicalRecordId,
      metadata: {
        consultationId: consultation.id,
        patientUserId,
        diagnosis: data.diagnosis.substring(0, 100),
      },
      ipAddress,
      userAgent,
    });

    logger.info('Consultation créée', { consultationId: consultation.id, medecinUserId });
    return consultation;
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        medecin: {
          select: { user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } } },
        },
        medicalRecord: {
          select: { patient: { select: { userId: true } } },
        },
      },
    });
    if (!consultation) throw new NotFoundError('Consultation');

    const patientUserId = consultation.medicalRecord.patient.userId;

    if (userRole === UserRole.PATIENT) {
      if (patientUserId !== userId) throw new ForbiddenError("Cette consultation ne vous appartient pas");
    } else {
      // Médecin : doit être celui qui a fait la consultation OU avoir un token DME valide
      const medecinProfile = await getMedecinProfile(userId);
      if (consultation.medecinId !== medecinProfile.id) {
        // Vérifier token DME
        const patientProfile = await prisma.patientProfile.findUnique({
          where: { userId: patientUserId },
          select: { id: true },
        });
        const validToken = patientProfile
          ? await prisma.documentAccessToken.findFirst({
              where: {
                patientId: patientProfile.id,
                grantedToMedecinId: medecinProfile.id,
                expiresAt: { gt: new Date() },
                revokedAt: null,
              },
            })
          : null;
        if (!validToken) throw new ForbiddenError("Vous n'avez pas accès à cette consultation");
      }
    }

    return consultation;
  }

  // ─── MODIFIER CONSULTATION (24h max) ─────────────────────────

  async update(
    id: string,
    medecinUserId: string,
    data: UpdateConsultationInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      select: { id: true, medecinId: true, createdAt: true, medicalRecordId: true },
    });
    if (!consultation) throw new NotFoundError('Consultation');
    if (consultation.medecinId !== medecinProfile.id) throw new ForbiddenError("Cette consultation ne vous appartient pas");

    // Règle : modification possible uniquement dans les 24h
    const hoursSinceCreation = (Date.now() - consultation.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > EDIT_WINDOW_HOURS) {
      throw new ForbiddenError(
        `Une consultation ne peut être modifiée que dans les ${EDIT_WINDOW_HOURS}h suivant sa création`
      );
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        ...(data.motif !== undefined && { motif: data.motif }),
        ...(data.symptoms !== undefined && { symptoms: data.symptoms }),
        ...(data.examination !== undefined && { examination: data.examination }),
        ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis }),
        ...(data.icd10Codes !== undefined && { icd10Codes: data.icd10Codes }),
        ...(data.treatment !== undefined && { treatment: data.treatment }),
        ...(data.recommendations !== undefined && { recommendations: data.recommendations }),
        ...(data.followUpNeeded !== undefined && { followUpNeeded: data.followUpNeeded }),
        ...(data.followUpDate !== undefined && {
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        }),
        ...(data.bloodPressure !== undefined && { bloodPressure: data.bloodPressure }),
        ...(data.heartRate !== undefined && { heartRate: data.heartRate }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.oxygenSaturation !== undefined && { oxygenSaturation: data.oxygenSaturation }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.height !== undefined && { height: data.height }),
      },
    });

    void createAuditLog({
      userId: medecinUserId,
      action: 'UPDATE_CONSULTATION',
      resourceType: 'DME',
      resourceId: consultation.medicalRecordId,
      metadata: { consultationId: id },
      ipAddress,
      userAgent,
    });

    logger.info('Consultation mise à jour', { consultationId: id, medecinUserId });
    return updated;
  }

  // ─── HISTORIQUE CONSULTATIONS D'UN PATIENT ────────────────────

  async getPatientHistory(
    patientUserId: string,
    requestUserId: string,
    requestUserRole: UserRole,
    query: ListConsultationsQuery
  ) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    if (requestUserRole === UserRole.PATIENT) {
      // Le patient ne peut voir que ses propres consultations
      if (requestUserId !== patientUserId) throw new ForbiddenError("Accès refusé");
    } else {
      // Médecin : vérifier token DME valide
      const medecinProfile = await getMedecinProfile(requestUserId);
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: { id: true },
      });
      if (!patientProfile) throw new NotFoundError('Patient');

      const validToken = await prisma.documentAccessToken.findFirst({
        where: {
          patientId: patientProfile.id,
          grantedToMedecinId: medecinProfile.id,
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
      });
      if (!validToken) throw new ForbiddenError("Vous n'avez pas de token d'accès valide pour ce patient");
    }

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: patientUserId },
      select: { medicalRecord: { select: { id: true } } },
    });
    if (!patientProfile?.medicalRecord) {
      return { consultations: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const where = { medicalRecordId: patientProfile.medicalRecord.id };
    const [consultations, total] = await prisma.$transaction([
      prisma.consultation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { consultationDate: 'desc' },
        include: {
          medecin: {
            select: { user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } } },
          },
        },
      }),
      prisma.consultation.count({ where }),
    ]);

    void createAuditLog({
      userId: requestUserId,
      action: 'VIEW_PATIENT_CONSULTATIONS',
      resourceType: 'DME',
      resourceId: patientProfile.medicalRecord.id,
      metadata: { patientUserId },
    });

    return { consultations, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const consultationService = new ConsultationService();
