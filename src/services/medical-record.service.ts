import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { uploadService } from './upload.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import type {
  UpdateMedicalRecordInput,
  AddAllergyInput,
  AddChronicConditionInput,
  UploadMedicalDocInput,
  CreateShareTokenInput,
} from '../validators/medical-record.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Filtre les champs du DME selon le niveau d'accès du token :
 * - LECTURE_SEULE : infos médicales critiques uniquement (urgence)
 * - LECTURE_ECRITURE : DME complet sans les documents fichiers
 * - COMPLET : tout
 */
function filterDmeByAccessLevel(
  medicalRecord: Record<string, unknown>,
  accessLevel: string,
  patientExtras: { bloodGroup: unknown; height: unknown; weight: unknown }
) {
  const emergency = {
    id: medicalRecord['id'],
    patientId: medicalRecord['patientId'],
    allergies: medicalRecord['allergies'],
    chronicConditions: medicalRecord['chronicConditions'],
    isSmoker: medicalRecord['isSmoker'],
    medicalHistory: medicalRecord['medicalHistory'],
    bloodGroup: patientExtras.bloodGroup,
    height: patientExtras.height,
    weight: patientExtras.weight,
  };

  if (accessLevel === 'LECTURE_SEULE') return emergency;

  const full = {
    ...emergency,
    surgicalHistory: medicalRecord['surgicalHistory'],
    familyHistory: medicalRecord['familyHistory'],
    alcoholConsumption: medicalRecord['alcoholConsumption'],
    exerciseLevel: medicalRecord['exerciseLevel'],
    updatedAt: medicalRecord['updatedAt'],
    createdAt: medicalRecord['createdAt'],
  };

  if (accessLevel === 'LECTURE_ECRITURE') return { ...full, medicalDocuments: [] };

  // COMPLET
  return { ...full, medicalDocuments: medicalRecord['medicalDocuments'] };
}

const DURATION_MS: Record<string, number> = {
  '1h': 1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  'unlimited': 100 * 365 * 24 * 60 * 60 * 1000,
};

// ═══════════════════════════════════════════════════════════════════
// Helpers internes
// ═══════════════════════════════════════════════════════════════════

async function getPatientProfile(userId: string) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true, bloodGroup: true, height: true, weight: true },
  });
  if (!profile) throw new NotFoundError('Profil patient');
  return profile;
}

async function getMedecinProfile(userId: string) {
  const profile = await prisma.medecinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new NotFoundError('Profil médecin');
  return profile;
}

async function getOrCreateMedicalRecord(patientProfileId: string) {
  const existing = await prisma.medicalRecord.findUnique({
    where: { patientId: patientProfileId },
    include: {
      allergies: { orderBy: { createdAt: 'desc' } },
      chronicConditions: { orderBy: { createdAt: 'desc' } },
      medicalDocuments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (existing) return existing;

  // Auto-provisioning : créer un DME vide à la première consultation
  return prisma.medicalRecord.create({
    data: { patientId: patientProfileId },
    include: {
      allergies: true,
      chronicConditions: true,
      medicalDocuments: true,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class MedicalRecordService {
  // ─── MON DME (patient connecté) ──────────────────────────────

  async getMyDme(userId: string, ipAddress?: string, userAgent?: string) {
    const patientProfile = await getPatientProfile(userId);
    const medicalRecord = await getOrCreateMedicalRecord(patientProfile.id);

    void createAuditLog({
      userId,
      action: 'VIEW_DME',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      ipAddress,
      userAgent,
    });

    return {
      ...medicalRecord,
      bloodGroup: patientProfile.bloodGroup,
      height: patientProfile.height,
      weight: patientProfile.weight,
    };
  }

  // ─── DME D'UN PATIENT (médecin avec token valide) ─────────────

  async getDmeByPatient(
    patientUserId: string,
    medecinUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const targetUser = await prisma.user.findUnique({
      where: { id: patientUserId, isActive: true, deletedAt: null },
      select: {
        patientProfile: {
          select: { id: true, bloodGroup: true, height: true, weight: true },
        },
      },
    });

    if (!targetUser?.patientProfile) throw new NotFoundError('Patient');

    const medecinProfile = await getMedecinProfile(medecinUserId);

    // Vérifier qu'il existe un token valide liant ce médecin à ce patient
    const validToken = await prisma.documentAccessToken.findFirst({
      where: {
        patientId: targetUser.patientProfile.id,
        grantedToMedecinId: medecinProfile.id,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });

    if (!validToken) {
      throw new ForbiddenError(
        "Vous n'avez pas de token d'accès valide pour ce patient. Demandez au patient de partager son QR code."
      );
    }

    const medicalRecord = await getOrCreateMedicalRecord(targetUser.patientProfile.id);

    void createAuditLog({
      userId: medecinUserId,
      action: 'MEDECIN_VIEW_DME',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      metadata: { tokenId: validToken.id, patientUserId },
      ipAddress,
      userAgent,
    });

    // Appliquer la projection selon le niveau d'accès du token (Fix #1)
    return filterDmeByAccessLevel(
      medicalRecord as unknown as Record<string, unknown>,
      validToken.accessLevel,
      {
        bloodGroup: targetUser.patientProfile.bloodGroup,
        height: targetUser.patientProfile.height,
        weight: targetUser.patientProfile.weight,
      }
    );
  }

  // ─── MISE À JOUR DME ──────────────────────────────────────────

  async updateMyDme(
    userId: string,
    data: UpdateMedicalRecordInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const patientProfile = await getPatientProfile(userId);
    const { bloodGroup, ...recordFields } = data;

    const hasRecordFields = Object.values(recordFields).some((v) => v !== undefined);
    const hasBlobGroup = bloodGroup !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      let updatedRecord = await tx.medicalRecord.findUnique({
        where: { patientId: patientProfile.id },
      });

      // Auto-provisioning si nécessaire
      if (!updatedRecord) {
        updatedRecord = await tx.medicalRecord.create({
          data: { patientId: patientProfile.id },
        });
      }

      if (hasRecordFields) {
        updatedRecord = await tx.medicalRecord.update({
          where: { patientId: patientProfile.id },
          data: {
            ...(data.medicalHistory !== undefined && { medicalHistory: data.medicalHistory }),
            ...(data.surgicalHistory !== undefined && { surgicalHistory: data.surgicalHistory }),
            ...(data.familyHistory !== undefined && { familyHistory: data.familyHistory }),
            ...(data.isSmoker !== undefined && { isSmoker: data.isSmoker }),
            ...(data.alcoholConsumption !== undefined && {
              alcoholConsumption: data.alcoholConsumption,
            }),
            ...(data.exerciseLevel !== undefined && { exerciseLevel: data.exerciseLevel }),
          },
        });
      }

      if (hasBlobGroup) {
        await tx.patientProfile.update({
          where: { id: patientProfile.id },
          data: { bloodGroup },
        });
      }

      return updatedRecord;
    });

    void createAuditLog({
      userId,
      action: 'UPDATE_DME',
      resourceType: 'DME',
      resourceId: updated.id,
      newValue: data as object,
      ipAddress,
      userAgent,
    });

    logger.info('DME mis à jour', { userId });
    return updated;
  }

  // ─── AJOUT ALLERGIE ───────────────────────────────────────────

  async addAllergy(userId: string, data: AddAllergyInput, ipAddress?: string, userAgent?: string) {
    const patientProfile = await getPatientProfile(userId);
    const medicalRecord = await getOrCreateMedicalRecord(patientProfile.id);

    const allergy = await prisma.allergy.create({
      data: {
        medicalRecordId: medicalRecord.id,
        name: data.name,
        severity: data.severity,
        reaction: data.reaction,
        diagnosedAt: data.diagnosedAt ? new Date(data.diagnosedAt) : null,
        notes: data.notes,
      },
    });

    void createAuditLog({
      userId,
      action: 'ADD_ALLERGY',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      newValue: allergy as object,
      ipAddress,
      userAgent,
    });

    logger.info('Allergie ajoutée', { userId, allergyId: allergy.id });
    return allergy;
  }

  // ─── AJOUT MALADIE CHRONIQUE ──────────────────────────────────

  async addChronicCondition(
    userId: string,
    data: AddChronicConditionInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const patientProfile = await getPatientProfile(userId);
    const medicalRecord = await getOrCreateMedicalRecord(patientProfile.id);

    const condition = await prisma.chronicCondition.create({
      data: {
        medicalRecordId: medicalRecord.id,
        name: data.name,
        icd10Code: data.icd10Code,
        diagnosedAt: data.diagnosedAt ? new Date(data.diagnosedAt) : null,
        currentTreatment: data.currentTreatment,
        notes: data.notes,
      },
    });

    void createAuditLog({
      userId,
      action: 'ADD_CHRONIC_CONDITION',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      newValue: condition as object,
      ipAddress,
      userAgent,
    });

    logger.info('Maladie chronique ajoutée', { userId, conditionId: condition.id });
    return condition;
  }

  // ─── UPLOAD DOCUMENT MÉDICAL ──────────────────────────────────

  async uploadMedicalDocument(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileSize: number,
    data: UploadMedicalDocInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const patientProfile = await getPatientProfile(userId);
    const medicalRecord = await getOrCreateMedicalRecord(patientProfile.id);

    const fileUrl = await uploadService.uploadDocument(
      fileBuffer,
      mimeType,
      userId,
      `medical-doc-${Date.now()}`
    );

    const document = await prisma.medicalDocument.create({
      data: {
        medicalRecordId: medicalRecord.id,
        title: data.title,
        category: data.category,
        fileUrl,
        fileSize,
        mimeType,
        uploadedBy: userId,
        notes: data.notes,
      },
    });

    void createAuditLog({
      userId,
      action: 'UPLOAD_MEDICAL_DOC',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      newValue: { documentId: document.id, category: data.category, title: data.title },
      ipAddress,
      userAgent,
    });

    logger.info('Document médical uploadé', { userId, documentId: document.id });
    return document;
  }

  // ─── CRÉER TOKEN DE PARTAGE QR ────────────────────────────────

  async createShareToken(
    userId: string,
    data: CreateShareTokenInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const patientProfile = await getPatientProfile(userId);

    // Vérifier que le medecinId cible existe si fourni
    if (data.grantedToMedecinId) {
      const medecin = await prisma.medecinProfile.findUnique({
        where: { id: data.grantedToMedecinId },
        select: { id: true },
      });
      if (!medecin) throw new NotFoundError('Médecin');
    }

    // Générer un token fort — stocker le hash SHA-256 en DB, retourner le plaintext une seule fois
    const plaintextToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(plaintextToken);
    const expiresAt = new Date(Date.now() + DURATION_MS[data.duration]);

    const shareToken = await prisma.documentAccessToken.create({
      data: {
        patientId: patientProfile.id,
        grantedToMedecinId: data.grantedToMedecinId ?? null,
        token: tokenHash,
        accessLevel: data.accessLevel,
        expiresAt,
      },
    });

    void createAuditLog({
      userId,
      action: 'CREATE_SHARE_TOKEN',
      resourceType: 'SHARE_TOKEN',
      resourceId: shareToken.id,
      metadata: {
        duration: data.duration,
        grantedToMedecinId: data.grantedToMedecinId,
        accessLevel: data.accessLevel,
      },
      ipAddress,
      userAgent,
    });

    logger.info('Token de partage créé', { userId, tokenId: shareToken.id, duration: data.duration });
    // Retourner le plaintext UNE SEULE FOIS pour affichage QR — jamais stocké
    return { ...shareToken, token: plaintextToken };
  }

  // ─── ACCÈS VIA TOKEN QR ───────────────────────────────────────

  async accessByToken(
    plaintextToken: string,
    medecinUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Lookup par hash — le plaintext n'est jamais stocké en DB
    const tokenHash = hashToken(plaintextToken);
    const tokenRecord = await prisma.documentAccessToken.findUnique({
      where: { token: tokenHash },
      include: {
        patient: {
          select: { id: true, userId: true, bloodGroup: true, height: true, weight: true },
        },
      },
    });

    if (!tokenRecord) throw new NotFoundError('Token de partage');
    if (tokenRecord.revokedAt) throw new ForbiddenError('Ce token a été révoqué');
    if (tokenRecord.expiresAt < new Date()) throw new ForbiddenError('Ce token a expiré');

    const medecinProfile = await getMedecinProfile(medecinUserId);

    // Token lié à un médecin spécifique : vérifier que c'est bien lui
    if (tokenRecord.grantedToMedecinId && tokenRecord.grantedToMedecinId !== medecinProfile.id) {
      throw new ForbiddenError("Ce token est réservé à un autre médecin");
    }

    // Liaison atomique si token ouvert (évite la race condition TOCTOU)
    if (!tokenRecord.grantedToMedecinId) {
      const bound = await prisma.documentAccessToken.updateMany({
        where: { id: tokenRecord.id, grantedToMedecinId: null },
        data: { grantedToMedecinId: medecinProfile.id, usedAt: new Date() },
      });
      if (bound.count === 0) {
        // Un autre médecin a lié le token entre la lecture et l'update
        const current = await prisma.documentAccessToken.findUnique({
          where: { id: tokenRecord.id },
          select: { grantedToMedecinId: true },
        });
        if (current?.grantedToMedecinId !== medecinProfile.id) {
          throw new ForbiddenError("Ce token vient d'être utilisé par un autre médecin");
        }
      }
    } else if (!tokenRecord.usedAt) {
      await prisma.documentAccessToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
    }

    const medicalRecord = await getOrCreateMedicalRecord(tokenRecord.patient.id);

    void createAuditLog({
      userId: medecinUserId,
      action: 'TOKEN_ACCESS_DME',
      resourceType: 'DME',
      resourceId: medicalRecord.id,
      metadata: { tokenId: tokenRecord.id, accessLevel: tokenRecord.accessLevel, patientUserId: tokenRecord.patient.userId },
      ipAddress,
      userAgent,
    });

    // Appliquer la projection selon le niveau d'accès (Fix #1)
    const filteredDme = filterDmeByAccessLevel(
      medicalRecord as unknown as Record<string, unknown>,
      tokenRecord.accessLevel,
      {
        bloodGroup: tokenRecord.patient.bloodGroup,
        height: tokenRecord.patient.height,
        weight: tokenRecord.patient.weight,
      }
    );

    return { accessLevel: tokenRecord.accessLevel, expiresAt: tokenRecord.expiresAt, medicalRecord: filteredDme };
  }

  // ─── RÉVOQUER TOKEN ───────────────────────────────────────────

  async revokeShareToken(
    userId: string,
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const patientProfile = await getPatientProfile(userId);

    const tokenRecord = await prisma.documentAccessToken.findUnique({
      where: { id: tokenId },
      select: { id: true, patientId: true, revokedAt: true },
    });

    if (!tokenRecord) throw new NotFoundError('Token de partage');
    if (tokenRecord.patientId !== patientProfile.id) {
      throw new ForbiddenError("Ce token ne vous appartient pas");
    }
    if (tokenRecord.revokedAt) {
      throw new BadRequestError('Ce token est déjà révoqué');
    }

    await prisma.documentAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    void createAuditLog({
      userId,
      action: 'REVOKE_SHARE_TOKEN',
      resourceType: 'SHARE_TOKEN',
      resourceId: tokenId,
      ipAddress,
      userAgent,
    });

    logger.info('Token de partage révoqué', { userId, tokenId });
  }
}

export const medicalRecordService = new MedicalRecordService();
