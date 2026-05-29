import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { uploadService } from './upload.service';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  UpdateUserProfileInput,
  CreateEmergencyContactInput,
  UpdateEmergencyContactInput,
} from '../validators/user.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes métier
// ═══════════════════════════════════════════════════════════════════

const MAX_EMERGENCY_CONTACTS = 5;

// Champs User exposables dans le profil public selon le rôle observateur
const PUBLIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  profilePhotoUrl: true,
  createdAt: true,
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class UserService {
  // ─── PROFIL COMPLET (utilisateur connecté) ────────────────────────

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: {
          include: {
            medicalRecord: { select: { id: true } },
          },
        },
        medecinProfile: {
          include: {
            establishment: { select: { id: true, name: true, type: true, city: true } },
          },
        },
        pharmacienProfile: {
          include: {
            pharmacy: { select: { id: true, name: true, city: true } },
          },
        },
        livreurProfile: true,
        adminProfile: true,
        wallet: { select: { balance: true, pendingBalance: true } },
        emergencyContacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!user) throw new NotFoundError('Utilisateur');

    const { passwordHash, twoFactorSecret, ...userSafe } = user;
    return userSafe;
  }

  // ─── MISE À JOUR PROFIL ───────────────────────────────────────────

  async updateProfile(userId: string, data: UpdateUserProfileInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });
    if (!user) throw new NotFoundError('Utilisateur');

    // Vérifier unicité email si modifié
    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ConflictError('Cet email est déjà utilisé');
    }

    // Champs du modèle User
    const {
      address,
      city,
      region,
      bloodGroup,
      height,
      weight,
      cniNumber,
      insuranceNumber,
      insuranceProvider,
      ...userFields
    } = data;

    // Mise à jour en transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Toujours mettre à jour les champs User de base
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          ...(userFields.firstName !== undefined && { firstName: userFields.firstName }),
          ...(userFields.lastName !== undefined && { lastName: userFields.lastName }),
          ...(userFields.email !== undefined && { email: userFields.email }),
          ...(userFields.dateOfBirth !== undefined && {
            dateOfBirth: userFields.dateOfBirth ? new Date(userFields.dateOfBirth) : null,
          }),
          ...(userFields.gender !== undefined && { gender: userFields.gender }),
          ...(userFields.preferredLanguage !== undefined && {
            preferredLanguage: userFields.preferredLanguage,
          }),
        },
        include: {
          patientProfile: true,
          medecinProfile: {
            include: { establishment: { select: { id: true, name: true, city: true } } },
          },
          wallet: { select: { balance: true, pendingBalance: true } },
        },
      });

      // Mise à jour PatientProfile si patient et champs concernés présents
      const hasPatientFields =
        address !== undefined ||
        city !== undefined ||
        region !== undefined ||
        bloodGroup !== undefined ||
        height !== undefined ||
        weight !== undefined ||
        cniNumber !== undefined ||
        insuranceNumber !== undefined ||
        insuranceProvider !== undefined;

      if (user.role === UserRole.PATIENT && hasPatientFields) {
        await tx.patientProfile.update({
          where: { userId },
          data: {
            ...(address !== undefined && { address }),
            ...(city !== undefined && { city }),
            ...(region !== undefined && { region }),
            ...(bloodGroup !== undefined && { bloodGroup }),
            ...(height !== undefined && { height }),
            ...(weight !== undefined && { weight }),
            ...(cniNumber !== undefined && { cniNumber }),
            ...(insuranceNumber !== undefined && { insuranceNumber }),
            ...(insuranceProvider !== undefined && { insuranceProvider }),
          },
        });
      }

      return updatedUser;
    });

    logger.info('Profil mis à jour', { userId });

    const { passwordHash, twoFactorSecret, ...safe } = updated;
    return safe;
  }

  // ─── UPLOAD PHOTO DE PROFIL ───────────────────────────────────────

  async uploadProfilePhoto(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const photoUrl = await uploadService.uploadProfilePhoto(fileBuffer, mimeType, userId);

    await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: photoUrl },
    });

    logger.info('Photo de profil mise à jour', { userId });
    return photoUrl;
  }

  // ─── SUPPRESSION PHOTO DE PROFIL ─────────────────────────────────

  async deleteProfilePhoto(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoUrl: true },
    });
    if (!user) throw new NotFoundError('Utilisateur');

    if (!user.profilePhotoUrl) {
      throw new BadRequestError('Aucune photo de profil à supprimer');
    }

    await uploadService.deleteProfilePhoto(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: null },
    });

    logger.info('Photo de profil supprimée', { userId });
  }

  // ─── PROFIL PUBLIC ────────────────────────────────────────────────

  async getPublicProfile(targetId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetId, isActive: true, deletedAt: null },
      select: {
        ...PUBLIC_USER_SELECT,
        medecinProfile: {
          select: {
            specialties: true,
            yearsOfExperience: true,
            languages: true,
            bio: true,
            consultationPriceMin: true,
            consultationPriceMax: true,
            averageRating: true,
            totalReviews: true,
            totalConsultations: true,
            isVerified: true,
            isMobileAvailable: true,
            establishment: { select: { id: true, name: true, city: true, type: true } },
          },
        },
        pharmacienProfile: {
          select: {
            isVerified: true,
            pharmacy: { select: { id: true, name: true, city: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundError('Utilisateur');

    return user;
  }

  // ─── SOFT DELETE (désactivation compte) ──────────────────────────

  async softDeleteAccount(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundError('Utilisateur');

    // Les super-admins ne peuvent pas se supprimer eux-mêmes
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Un super-administrateur ne peut pas supprimer son propre compte');
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Révoquer tous les refresh tokens actifs
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    logger.info('Compte désactivé (soft delete)', { userId });
  }

  // ─── CONTACTS D'URGENCE ───────────────────────────────────────────

  async getEmergencyContacts(userId: string) {
    return prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addEmergencyContact(userId: string, data: CreateEmergencyContactInput) {
    // Vérifier la limite max
    const count = await prisma.emergencyContact.count({ where: { userId } });
    if (count >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestError(
        `Vous ne pouvez pas avoir plus de ${MAX_EMERGENCY_CONTACTS} contacts d'urgence`
      );
    }

    return prisma.$transaction(async (tx) => {
      // Si isPrimary, retirer le statut des autres
      if (data.isPrimary) {
        await tx.emergencyContact.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.emergencyContact.create({
        data: {
          userId,
          name: data.name,
          phoneNumber: data.phoneNumber,
          relationship: data.relationship,
          isPrimary: data.isPrimary ?? false,
          notifyOnEmergency: data.notifyOnEmergency ?? true,
        },
      });
    });
  }

  async updateEmergencyContact(
    userId: string,
    contactId: string,
    data: UpdateEmergencyContactInput
  ) {
    // Vérifier que le contact appartient bien à cet utilisateur
    const contact = await prisma.emergencyContact.findUnique({
      where: { id: contactId },
    });

    if (!contact) throw new NotFoundError('Contact d\'urgence');
    if (contact.userId !== userId) throw new ForbiddenError('Ce contact ne vous appartient pas');

    return prisma.$transaction(async (tx) => {
      // Si on passe isPrimary à true, retirer le statut des autres
      if (data.isPrimary === true) {
        await tx.emergencyContact.updateMany({
          where: { userId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }

      return tx.emergencyContact.update({
        where: { id: contactId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
          ...(data.relationship !== undefined && { relationship: data.relationship }),
          ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
          ...(data.notifyOnEmergency !== undefined && {
            notifyOnEmergency: data.notifyOnEmergency,
          }),
        },
      });
    });
  }

  async deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
    const contact = await prisma.emergencyContact.findUnique({
      where: { id: contactId },
    });

    if (!contact) throw new NotFoundError('Contact d\'urgence');
    if (contact.userId !== userId) throw new ForbiddenError('Ce contact ne vous appartient pas');

    await prisma.emergencyContact.delete({ where: { id: contactId } });

    logger.info('Contact d\'urgence supprimé', { userId, contactId });
  }
}

export const userService = new UserService();
