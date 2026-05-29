import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  ListEstablishmentsQuery,
  NearbyEstablishmentsQuery,
  CreateEstablishmentInput,
  UpdateEstablishmentInput,
} from '../validators/establishment.validators';

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

// Sélection commune pour la liste et le nearby
const LIST_SELECT = {
  id: true,
  name: true,
  type: true,
  address: true,
  city: true,
  region: true,
  latitude: true,
  longitude: true,
  phoneNumber: true,
  email: true,
  photoUrl: true,
  isOpen24_7: true,
  hasEmergency: true,
  hasLaboratory: true,
  hasImaging: true,
  averageRating: true,
  totalReviews: true,
  isVerified: true,
  specialties: true,
  services: true,
  consultationPriceMin: true,
  consultationPriceMax: true,
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class EstablishmentService {
  // ─── LISTE PAGINÉE + FILTRES ──────────────────────────────────

  async list(query: ListEstablishmentsQuery) {
    const { page, limit, type, city, region, specialty, hasEmergency, isOpen24_7, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(type && { type }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(region && { region: { contains: region, mode: 'insensitive' as const } }),
      ...(specialty && { specialties: { has: specialty } }),
      ...(hasEmergency !== undefined && { hasEmergency }),
      ...(isOpen24_7 !== undefined && { isOpen24_7 }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [establishments, total] = await prisma.$transaction([
      prisma.establishment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { name: 'asc' }],
        select: LIST_SELECT,
      }),
      prisma.establishment.count({ where }),
    ]);

    return {
      establishments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── RECHERCHE GÉOLOCALISÉE (Haversine) ──────────────────────

  async nearby(query: NearbyEstablishmentsQuery) {
    const { lat, lng, radius, type, specialty } = query;

    // Bounding box pour pré-filtrer en DB avant Haversine
    const latDelta = radius / 111.32;
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));

    const candidates = await prisma.establishment.findMany({
      where: {
        isActive: true,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
        ...(type && { type }),
        ...(specialty && { specialties: { has: specialty } }),
      },
      select: LIST_SELECT,
    });

    // Filtrage précis par Haversine + tri par distance croissante
    return candidates
      .map((e) => ({
        ...e,
        distance: Math.round(haversineDistance(lat, lng, e.latitude, e.longitude) * 10) / 10,
      }))
      .filter((e) => e.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  // ─── DÉTAIL ──────────────────────────────────────────────────

  async getById(id: string) {
    const establishment = await prisma.establishment.findUnique({
      where: { id, isActive: true },
    });
    if (!establishment) throw new NotFoundError('Établissement');
    return establishment;
  }

  // ─── CRÉATION ────────────────────────────────────────────────

  async create(data: CreateEstablishmentInput, userId: string, userRole: UserRole) {
    if (data.registrationNumber) {
      const existing = await prisma.establishment.findUnique({
        where: { registrationNumber: data.registrationNumber },
      });
      if (existing) throw new ConflictError("Ce numéro d'enregistrement est déjà utilisé");
    }

    const establishmentData = {
      name: data.name,
      type: data.type,
      address: data.address,
      city: data.city,
      region: data.region,
      latitude: data.latitude,
      longitude: data.longitude,
      phoneNumber: data.phoneNumber,
      email: data.email,
      website: data.website,
      description: data.description,
      registrationNumber: data.registrationNumber,
      photoUrl: data.photoUrl,
      coverPhotoUrl: data.coverPhotoUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      openingHours: data.openingHours as any,
      consultationPriceMin: data.consultationPriceMin,
      consultationPriceMax: data.consultationPriceMax,
      services: data.services ?? [],
      specialties: data.specialties ?? [],
      isOpen24_7: data.isOpen24_7 ?? false,
      hasEmergency: data.hasEmergency ?? false,
      hasParking: data.hasParking ?? false,
      hasLaboratory: data.hasLaboratory ?? false,
      hasImaging: data.hasImaging ?? false,
      // ADMIN_ETABLISSEMENT : non vérifié par défaut, attend validation SUPER_ADMIN
      isVerified: false,
    };

    // ADMIN_ETABLISSEMENT : créer l'établissement et se lier à lui en transaction
    if (userRole === UserRole.ADMIN_ETABLISSEMENT) {
      const establishment = await prisma.$transaction(async (tx) => {
        const created = await tx.establishment.create({ data: establishmentData });
        await tx.adminProfile.update({
          where: { userId },
          data: { establishmentId: created.id },
        });
        return created;
      });
      logger.info('Établissement créé par admin', { id: establishment.id, userId });
      return establishment;
    }

    const establishment = await prisma.establishment.create({ data: establishmentData });
    logger.info('Établissement créé', { id: establishment.id, userId });
    return establishment;
  }

  // ─── MISE À JOUR ──────────────────────────────────────────────

  async update(id: string, data: UpdateEstablishmentInput, userId: string, userRole: UserRole) {
    const establishment = await prisma.establishment.findUnique({ where: { id } });
    if (!establishment) throw new NotFoundError('Établissement');

    // Interdire la modification d'un établissement désactivé aux non-super-admins
    if (!establishment.isActive && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Cet établissement est désactivé');
    }

    // ADMIN_ÉTABLISSEMENT : vérifier qu'il gère bien cet établissement
    if (userRole === UserRole.ADMIN_ETABLISSEMENT) {
      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId },
        select: { establishmentId: true },
      });
      if (!adminProfile || adminProfile.establishmentId !== id) {
        throw new ForbiddenError("Vous n'avez pas les droits sur cet établissement");
      }
    }

    if (data.registrationNumber && data.registrationNumber !== establishment.registrationNumber) {
      const existing = await prisma.establishment.findUnique({
        where: { registrationNumber: data.registrationNumber },
      });
      if (existing) throw new ConflictError("Ce numéro d'enregistrement est déjà utilisé");
    }

    const updated = await prisma.establishment.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.region !== undefined && { region: data.region }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.registrationNumber !== undefined && {
          registrationNumber: data.registrationNumber,
        }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.coverPhotoUrl !== undefined && { coverPhotoUrl: data.coverPhotoUrl }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.openingHours !== undefined && { openingHours: data.openingHours as any }),
        ...(data.consultationPriceMin !== undefined && {
          consultationPriceMin: data.consultationPriceMin,
        }),
        ...(data.consultationPriceMax !== undefined && {
          consultationPriceMax: data.consultationPriceMax,
        }),
        ...(data.services !== undefined && { services: data.services }),
        ...(data.specialties !== undefined && { specialties: data.specialties }),
        ...(data.isOpen24_7 !== undefined && { isOpen24_7: data.isOpen24_7 }),
        ...(data.hasEmergency !== undefined && { hasEmergency: data.hasEmergency }),
        ...(data.hasParking !== undefined && { hasParking: data.hasParking }),
        ...(data.hasLaboratory !== undefined && { hasLaboratory: data.hasLaboratory }),
        ...(data.hasImaging !== undefined && { hasImaging: data.hasImaging }),
        // isActive et isVerified : SUPER_ADMIN seulement
        ...(userRole === UserRole.SUPER_ADMIN &&
          data.isActive !== undefined && { isActive: data.isActive }),
        ...(userRole === UserRole.SUPER_ADMIN &&
          data.isVerified !== undefined && { isVerified: data.isVerified }),
      },
    });

    logger.info('Établissement mis à jour', { id, userId });
    return updated;
  }

  // ─── DÉSACTIVATION (soft delete via isActive) ─────────────────

  async deactivate(id: string, userId: string): Promise<void> {
    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!establishment) throw new NotFoundError('Établissement');

    if (!establishment.isActive) {
      throw new BadRequestError('Cet établissement est déjà désactivé');
    }

    await prisma.establishment.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Établissement désactivé', { id, userId });
  }
}

export const establishmentService = new EstablishmentService();
