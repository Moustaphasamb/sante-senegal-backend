import { KycStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { uploadService } from './upload.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  ListMedecinsQuery,
  NearbyMedecinsQuery,
  UpdateMedecinProfileInput,
  UpdateLocationInput,
  SetScheduleInput,
  RejectKycInput,
} from '../validators/medecin.validators';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Champs publics exposés dans la liste
const LIST_SELECT = {
  id: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
      kycStatus: true,
    },
  },
  specialties: true,
  languages: true,
  yearsOfExperience: true,
  bio: true,
  consultationPriceMin: true,
  consultationPriceMax: true,
  averageRating: true,
  totalReviews: true,
  totalConsultations: true,
  isVerified: true,
  isMobileAvailable: true,
  mobileRadiusKm: true,
  mobileConsultationPrice: true,
  mobileTravelFee: true,
  establishment: {
    select: { id: true, name: true, city: true, type: true },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class MedecinService {
  // ─── LISTE PAGINÉE + FILTRES ──────────────────────────────────

  async list(query: ListMedecinsQuery) {
    const { page, limit, specialty, city, region, language, isMobileAvailable, priceMax, search } =
      query;
    const skip = (page - 1) * limit;

    const where = {
      user: {
        isActive: true,
        deletedAt: null,
        kycStatus: KycStatus.APPROVED,
        ...(city && {
          patientProfile: undefined,
        }),
      },
      ...(specialty && { specialties: { has: specialty } }),
      ...(language && { languages: { has: language } }),
      ...(isMobileAvailable !== undefined && { isMobileAvailable }),
      ...(priceMax !== undefined && {
        OR: [
          { consultationPriceMax: { lte: priceMax } },
          { consultationPriceMax: null },
        ],
      }),
      ...(search && {
        user: {
          isActive: true,
          deletedAt: null,
          kycStatus: KycStatus.APPROVED,
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    // Filtre ville/région : passe par l'établissement ou le profil patient
    const whereWithLocation = {
      ...where,
      ...(city && {
        establishment: { city: { contains: city, mode: 'insensitive' as const } },
      }),
      ...(region && {
        establishment: { region: { contains: region, mode: 'insensitive' as const } },
      }),
    };

    const [medecins, total] = await prisma.$transaction([
      prisma.medecinProfile.findMany({
        where: whereWithLocation,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { totalConsultations: 'desc' }],
        select: LIST_SELECT,
      }),
      prisma.medecinProfile.count({ where: whereWithLocation }),
    ]);

    return {
      medecins,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── LISTE PAR STATUT KYC (SUPER_ADMIN) ───────────────────────

  async listByKyc(status: KycStatus) {
    return prisma.medecinProfile.findMany({
      where: { user: { kycStatus: status, deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        licenseNumber: true,
        specialties: true,
        languages: true,
        yearsOfExperience: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            kycStatus: true,
            kycRejectionReason: true,
            createdAt: true,
          },
        },
        establishment: { select: { id: true, name: true, city: true, type: true } },
      },
    });
  }

  // ─── NEARBY (médecins libéraux mobiles disponibles) ───────────

  async nearby(query: NearbyMedecinsQuery) {
    const { lat, lng, radius, specialty } = query;

    const latDelta = radius / 111.32;
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));

    const candidates = await prisma.medecinProfile.findMany({
      where: {
        isMobileAvailable: true,
        user: { role: UserRole.MEDECIN_LIBERAL_MOBILE, isActive: true, deletedAt: null, kycStatus: KycStatus.APPROVED },
        currentLatitude: { gte: lat - latDelta, lte: lat + latDelta },
        currentLongitude: { gte: lng - lngDelta, lte: lng + lngDelta },
        ...(specialty && { specialties: { has: specialty } }),
      },
      select: {
        ...LIST_SELECT,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationUpdate: true,
        averageResponseTime: true,
      },
    });

    return candidates
      .filter((m) => m.currentLatitude !== null && m.currentLongitude !== null)
      .map((m) => ({
        ...m,
        distance: Math.round(
          haversineDistance(lat, lng, m.currentLatitude!, m.currentLongitude!) * 10
        ) / 10,
      }))
      .filter((m) => {
        const maxRadius = m.mobileRadiusKm ?? 10;
        return m.distance <= Math.min(radius, maxRadius);
      })
      .sort((a, b) => a.distance - b.distance);
  }

  // ─── PROFIL PUBLIC ────────────────────────────────────────────

  async getPublicProfile(medecinId: string) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { id: medecinId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            kycStatus: true,
            createdAt: true,
          },
        },
        establishment: {
          select: { id: true, name: true, city: true, type: true },
        },
        schedules: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
          select: { dayOfWeek: true, startTime: true, endTime: true, slotDuration: true },
        },
      },
    });

    if (!medecin || !medecin.user) throw new NotFoundError('Médecin');

    // Masquer les documents KYC dans le profil public
    const { diplomaUrl, cniScanUrl, orderCardUrl, ...publicProfile } = medecin;
    return publicProfile;
  }

  // ─── PROFIL COMPLET (médecin connecté) ───────────────────────

  async getMyProfile(userId: string) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            kycStatus: true,
            kycVerifiedAt: true,
            kycRejectionReason: true,
          },
        },
        establishment: {
          select: { id: true, name: true, city: true, type: true },
        },
        schedules: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');
    return medecin;
  }

  // ─── MISE À JOUR PROFIL ───────────────────────────────────────

  async updateProfile(userId: string, data: UpdateMedecinProfileInput) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true } } },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');

    // Vérifier cohérence prix
    if (
      data.consultationPriceMin !== undefined &&
      data.consultationPriceMax !== undefined &&
      data.consultationPriceMin !== null &&
      data.consultationPriceMax !== null &&
      data.consultationPriceMin > data.consultationPriceMax
    ) {
      throw new BadRequestError('Le prix minimum ne peut pas dépasser le prix maximum');
    }

    const updated = await prisma.medecinProfile.update({
      where: { userId },
      data: {
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.specialties !== undefined && { specialties: data.specialties }),
        ...(data.languages !== undefined && { languages: data.languages }),
        ...(data.yearsOfExperience !== undefined && { yearsOfExperience: data.yearsOfExperience }),
        ...(data.consultationPriceMin !== undefined && {
          consultationPriceMin: data.consultationPriceMin,
        }),
        ...(data.consultationPriceMax !== undefined && {
          consultationPriceMax: data.consultationPriceMax,
        }),
        ...(data.mobileRadiusKm !== undefined && { mobileRadiusKm: data.mobileRadiusKm }),
        ...(data.mobileConsultationPrice !== undefined && {
          mobileConsultationPrice: data.mobileConsultationPrice,
        }),
        ...(data.mobileTravelFee !== undefined && { mobileTravelFee: data.mobileTravelFee }),
      },
    });

    logger.info('Profil médecin mis à jour', { userId });
    return updated;
  }

  // ─── UPLOAD DOCUMENT KYC ─────────────────────────────────────

  async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    documentType: 'diploma' | 'cni' | 'orderCard'
  ): Promise<string> {
    const medecin = await prisma.medecinProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!medecin) throw new NotFoundError('Profil médecin');

    const url = await uploadService.uploadDocument(fileBuffer, mimeType, userId, documentType);

    const fieldMap = {
      diploma: 'diplomaUrl',
      cni: 'cniScanUrl',
      orderCard: 'orderCardUrl',
    } as const;

    await prisma.medecinProfile.update({
      where: { userId },
      data: { [fieldMap[documentType]]: url },
    });

    logger.info('Document KYC uploadé', { userId, documentType });
    return url;
  }

  // ─── TOGGLE DISPONIBILITÉ MOBILE ─────────────────────────────

  async toggleMobileAvailability(userId: string): Promise<boolean> {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { isMobileAvailable: true, user: { select: { role: true, kycStatus: true } } },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');

    if (medecin.user.role !== UserRole.MEDECIN_LIBERAL_MOBILE) {
      throw new ForbiddenError('Seuls les médecins libéraux mobiles peuvent activer ce mode');
    }
    if (medecin.user.kycStatus !== KycStatus.APPROVED) {
      throw new ForbiddenError('KYC non validé — contactez le support');
    }

    const newValue = !medecin.isMobileAvailable;

    await prisma.medecinProfile.update({
      where: { userId },
      data: { isMobileAvailable: newValue },
    });

    logger.info('Disponibilité mobile mise à jour', { userId, isMobileAvailable: newValue });
    return newValue;
  }

  // ─── MISE À JOUR POSITION GPS ─────────────────────────────────

  async updateLocation(userId: string, data: UpdateLocationInput): Promise<void> {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true } } },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');

    if (medecin.user.role !== UserRole.MEDECIN_LIBERAL_MOBILE) {
      throw new ForbiddenError('Seuls les médecins libéraux mobiles peuvent partager leur position');
    }

    await prisma.medecinProfile.update({
      where: { userId },
      data: {
        currentLatitude: data.latitude,
        currentLongitude: data.longitude,
        lastLocationUpdate: new Date(),
      },
    });
  }

  // ─── PLANNING HEBDOMADAIRE (lecture) ─────────────────────────

  async getSchedule(userId: string) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');

    return prisma.doctorSchedule.findMany({
      where: { medecinId: medecin.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ─── PLANNING HEBDOMADAIRE (écriture — upsert) ───────────────

  async setSchedule(userId: string, data: SetScheduleInput) {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!medecin) throw new NotFoundError('Profil médecin');

    // Valider que startTime < endTime pour chaque jour
    for (const item of data.schedule) {
      if (item.startTime >= item.endTime) {
        throw new BadRequestError(
          `Jour ${item.dayOfWeek} : l'heure de début doit être avant l'heure de fin`
        );
      }
    }

    // Upsert de chaque jour en transaction
    const schedules = await prisma.$transaction(
      data.schedule.map((item) =>
        prisma.doctorSchedule.upsert({
          where: { medecinId_dayOfWeek: { medecinId: medecin.id, dayOfWeek: item.dayOfWeek } },
          create: {
            medecinId: medecin.id,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
            slotDuration: item.slotDuration ?? 30,
            isActive: item.isActive ?? true,
          },
          update: {
            startTime: item.startTime,
            endTime: item.endTime,
            slotDuration: item.slotDuration ?? 30,
            isActive: item.isActive ?? true,
          },
        })
      )
    );

    logger.info('Planning mis à jour', { userId, days: data.schedule.length });
    return schedules;
  }

  // ─── APPROVE KYC (super-admin) ────────────────────────────────

  async approveKyc(medecinUserId: string, adminUserId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: medecinUserId },
      select: { id: true, kycStatus: true, medecinProfile: { select: { id: true } } },
    });
    if (!user || !user.medecinProfile) throw new NotFoundError('Médecin');

    if (user.kycStatus === KycStatus.APPROVED) {
      throw new BadRequestError('Ce médecin est déjà validé');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: medecinUserId },
        data: { kycStatus: KycStatus.APPROVED, kycVerifiedAt: new Date(), kycRejectionReason: null },
      }),
      prisma.medecinProfile.update({
        where: { userId: medecinUserId },
        data: { isVerified: true, verifiedAt: new Date() },
      }),
    ]);

    logger.info('KYC médecin approuvé', { medecinUserId, adminUserId });
  }

  // ─── REJECT KYC (super-admin) ─────────────────────────────────

  async rejectKyc(medecinUserId: string, adminUserId: string, data: RejectKycInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: medecinUserId },
      select: { id: true, kycStatus: true, medecinProfile: { select: { id: true } } },
    });
    if (!user || !user.medecinProfile) throw new NotFoundError('Médecin');

    if (user.kycStatus === KycStatus.REJECTED) {
      throw new BadRequestError('Ce médecin est déjà rejeté');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: medecinUserId },
        data: { kycStatus: KycStatus.REJECTED, kycRejectionReason: data.reason },
      }),
      prisma.medecinProfile.update({
        where: { userId: medecinUserId },
        data: { isVerified: false, verifiedAt: null },
      }),
    ]);

    logger.info('KYC médecin rejeté', { medecinUserId, adminUserId, reason: data.reason });
  }
}

export const medecinService = new MedecinService();
