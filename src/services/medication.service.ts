import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { haversineDistance } from '../utils/geo';
import type {
  ListMedicationsQuery,
  MedicationAvailabilityQuery,
} from '../validators/medication.validators';

// ═══════════════════════════════════════════════════════════════════
// Service Catalogue Médicaments
// ═══════════════════════════════════════════════════════════════════

class MedicationService {
  // ─── CATALOGUE PAGINÉ + RECHERCHE ─────────────────────────────

  async list(query: ListMedicationsQuery) {
    const { page, limit, search, category, form, requiresPrescription } = query;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(category && { category: { equals: category, mode: 'insensitive' as const } }),
      ...(form && { form: { contains: form, mode: 'insensitive' as const } }),
      ...(requiresPrescription !== undefined && { requiresPrescription }),
      ...(search && {
        OR: [
          { commercialName: { contains: search, mode: 'insensitive' as const } },
          { dci: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [medications, total] = await prisma.$transaction([
      prisma.medication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { commercialName: 'asc' },
      }),
      prisma.medication.count({ where }),
    ]);

    return { medications, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string) {
    const medication = await prisma.medication.findUnique({ where: { id } });
    if (!medication || !medication.isActive) throw new NotFoundError('Médicament');
    return medication;
  }

  // ─── DISPONIBILITÉ EN PHARMACIE ───────────────────────────────

  async availability(query: MedicationAvailabilityQuery) {
    const { medicationId, lat, lng, radius, inStockOnly } = query;

    // Vérifier que le médicament existe
    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
      select: { id: true, commercialName: true, dci: true, dosage: true, form: true, requiresPrescription: true },
    });
    if (!medication) throw new NotFoundError('Médicament');

    const stocks = await prisma.pharmacyStock.findMany({
      where: {
        medicationId,
        ...(inStockOnly && { quantity: { gt: 0 } }),
        pharmacy: { isActive: true },
      },
      select: {
        quantity: true,
        price: true,
        isLowStock: true,
        lastUpdatedAt: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            region: true,
            latitude: true,
            longitude: true,
            phoneNumber: true,
            isOpen24_7: true,
            isOnDuty: true,
            hasDelivery: true,
            averageRating: true,
          },
        },
      },
    });

    // Mise en forme : aplatir pharmacy + stock
    let results = stocks.map((s) => ({
      pharmacy: s.pharmacy,
      quantity: s.quantity,
      price: s.price,
      isLowStock: s.isLowStock,
      lastUpdatedAt: s.lastUpdatedAt,
      ...(lat !== undefined && lng !== undefined && {
        distance: Math.round(haversineDistance(lat, lng, s.pharmacy.latitude, s.pharmacy.longitude) * 10) / 10,
      }),
    }));

    // Filtre + tri géographique si coordonnées fournies, sinon tri par prix croissant
    if (lat !== undefined && lng !== undefined) {
      results = results
        .filter((r) => (r as { distance: number }).distance <= radius)
        .sort((a, b) => (a as { distance: number }).distance - (b as { distance: number }).distance);
    } else {
      results.sort((a, b) => a.price - b.price);
    }

    return { medication, count: results.length, pharmacies: results };
  }
}

export const medicationService = new MedicationService();
