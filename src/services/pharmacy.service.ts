import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { haversineDistance, boundingBox } from '../utils/geo';
import type {
  ListPharmaciesQuery,
  NearbyPharmaciesQuery,
  PharmacyStockQuery,
  UpdateStockInput,
} from '../validators/pharmacy.validators';

// Sélection commune (liste publique d'une pharmacie)
const PHARMACY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  region: true,
  latitude: true,
  longitude: true,
  phoneNumber: true,
  email: true,
  photoUrl: true,
  isOpen24_7: true,
  isOnDuty: true,
  hasDelivery: true,
  deliveryRadiusKm: true,
  deliveryFee: true,
  minimumOrder: true,
  averageRating: true,
  totalReviews: true,
  isVerified: true,
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service Pharmacies
// ═══════════════════════════════════════════════════════════════════

class PharmacyService {
  // ─── LISTE PAGINÉE + FILTRES ──────────────────────────────────

  async list(query: ListPharmaciesQuery) {
    const { page, limit, city, region, hasDelivery, isOpen24_7, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(region && { region: { contains: region, mode: 'insensitive' as const } }),
      ...(hasDelivery !== undefined && { hasDelivery }),
      ...(isOpen24_7 !== undefined && { isOpen24_7 }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [pharmacies, total] = await prisma.$transaction([
      prisma.pharmacy.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { name: 'asc' }],
        select: PHARMACY_SELECT,
      }),
      prisma.pharmacy.count({ where }),
    ]);

    return { pharmacies, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── RECHERCHE GÉOLOCALISÉE (Haversine) ───────────────────────

  async nearby(query: NearbyPharmaciesQuery) {
    const { lat, lng, radius, onDuty, hasDelivery } = query;
    const { latDelta, lngDelta } = boundingBox(lat, radius);

    const candidates = await prisma.pharmacy.findMany({
      where: {
        isActive: true,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
        ...(onDuty !== undefined && { isOnDuty: onDuty }),
        ...(hasDelivery !== undefined && { hasDelivery }),
      },
      select: PHARMACY_SELECT,
    });

    return candidates
      .map((p) => ({
        ...p,
        distance: Math.round(haversineDistance(lat, lng, p.latitude, p.longitude) * 10) / 10,
      }))
      .filter((p) => p.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  // ─── PHARMACIES DE GARDE ──────────────────────────────────────

  async onDuty() {
    const now = new Date();

    // De garde = drapeau isOnDuty actif, OU ouvert 24/7, OU planning de garde couvrant maintenant
    const pharmacies = await prisma.pharmacy.findMany({
      where: {
        isActive: true,
        OR: [
          { isOnDuty: true },
          { isOpen24_7: true },
          { dutySchedules: { some: { startDate: { lte: now }, endDate: { gte: now } } } },
        ],
      },
      orderBy: [{ averageRating: 'desc' }, { name: 'asc' }],
      select: PHARMACY_SELECT,
    });

    return pharmacies;
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string) {
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id, isActive: true },
      select: { ...PHARMACY_SELECT, openingHours: true, _count: { select: { stocks: true } } },
    });
    if (!pharmacy) throw new NotFoundError('Pharmacie');
    return pharmacy;
  }

  private async exists(id: string): Promise<boolean> {
    const p = await prisma.pharmacy.findFirst({ where: { id, isActive: true }, select: { id: true } });
    return !!p;
  }

  // ─── STOCK D'UNE PHARMACIE ────────────────────────────────────

  async getStock(pharmacyId: string, query: PharmacyStockQuery) {
    if (!(await this.exists(pharmacyId))) throw new NotFoundError('Pharmacie');

    const { page, limit, search, inStockOnly } = query;
    const skip = (page - 1) * limit;

    const where = {
      pharmacyId,
      ...(inStockOnly && { quantity: { gt: 0 } }),
      ...(search && {
        medication: {
          OR: [
            { commercialName: { contains: search, mode: 'insensitive' as const } },
            { dci: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const [stocks, total] = await prisma.$transaction([
      prisma.pharmacyStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { medication: { commercialName: 'asc' } },
        select: {
          quantity: true,
          price: true,
          isLowStock: true,
          lastUpdatedAt: true,
          medication: {
            select: {
              id: true,
              commercialName: true,
              dci: true,
              dosage: true,
              form: true,
              requiresPrescription: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.pharmacyStock.count({ where }),
    ]);

    return { stocks, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── MISE À JOUR STOCK (pharmacien) ───────────────────────────

  async updateStock(userId: string, data: UpdateStockInput) {
    // Récupérer la pharmacie du pharmacien
    const profile = await prisma.pharmacienProfile.findUnique({
      where: { userId },
      select: { pharmacyId: true },
    });
    if (!profile?.pharmacyId) {
      throw new ForbiddenError("Aucune pharmacie n'est associée à votre compte");
    }
    const pharmacyId = profile.pharmacyId;

    // Vérifier que tous les médicaments existent
    const medicationIds = data.items.map((i) => i.medicationId);
    const found = await prisma.medication.findMany({
      where: { id: { in: medicationIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((m) => m.id));
    const missing = medicationIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Médicament(s) introuvable(s) : ${missing.join(', ')}`);
    }

    const now = new Date();

    // Upsert chaque ligne de stock en transaction
    await prisma.$transaction(
      data.items.map((item) => {
        const threshold = item.lowStockThreshold ?? 5;
        const isLowStock = item.quantity <= threshold;
        return prisma.pharmacyStock.upsert({
          where: { pharmacyId_medicationId: { pharmacyId, medicationId: item.medicationId } },
          create: {
            pharmacyId,
            medicationId: item.medicationId,
            quantity: item.quantity,
            price: item.price,
            lowStockThreshold: threshold,
            isLowStock,
            lastRestockedAt: now,
            lastUpdatedAt: now,
          },
          update: {
            quantity: item.quantity,
            price: item.price,
            lowStockThreshold: threshold,
            isLowStock,
            lastUpdatedAt: now,
          },
        });
      })
    );

    logger.info('Stock pharmacie mis à jour', { pharmacyId, userId, itemCount: data.items.length });
    return { pharmacyId, updated: data.items.length };
  }
}

export const pharmacyService = new PharmacyService();
