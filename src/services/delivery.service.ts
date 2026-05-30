import { DeliveryStatus, PharmacyOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { haversineDistance } from '../utils/geo';
import { getIO } from '../sockets';
import type { AvailableDeliveriesQuery, DeliveredInput, FailedInput } from '../validators/delivery.validators';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

async function getLivreurProfile(userId: string) {
  const l = await prisma.livreurProfile.findUnique({
    where: { userId },
    select: { id: true, isVerified: true },
  });
  if (!l) throw new NotFoundError('Profil livreur');
  return l;
}

/** Notifie le patient d'une livraison via sa room personnelle (best-effort) */
function notifyPatient(patientUserId: string | undefined, event: string, payload: unknown) {
  if (!patientUserId) return;
  try {
    getIO().to(`user:${patientUserId}`).emit(event, payload);
  } catch {
    // Socket.io non initialisé (ex : tests) — on ignore
  }
}

const DELIVERY_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      patient: { select: { user: { select: { firstName: true, lastName: true, phoneNumber: true } } } },
      pharmacy: { select: { name: true, phoneNumber: true } },
    },
  },
  livreur: {
    select: {
      id: true,
      vehicleType: true,
      averageRating: true,
      user: { select: { firstName: true, lastName: true, phoneNumber: true } },
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class DeliveryService {
  // ─── LIVRAISONS DISPONIBLES (livreur) ─────────────────────────

  async available(userId: string, query: AvailableDeliveriesQuery) {
    await getLivreurProfile(userId);
    const { lat, lng, radius } = query;

    const deliveries = await prisma.delivery.findMany({
      where: { status: DeliveryStatus.RECHERCHE_LIVREUR, livreurId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        pickupAddress: true,
        pickupLatitude: true,
        pickupLongitude: true,
        deliveryAddress: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        deliveryFee: true,
        createdAt: true,
        order: { select: { orderNumber: true, pharmacy: { select: { name: true } } } },
      },
    });

    // Tri/filtre par proximité du point de retrait si position fournie
    if (lat !== undefined && lng !== undefined) {
      return deliveries
        .map((d) => ({
          ...d,
          distance: Math.round(haversineDistance(lat, lng, d.pickupLatitude, d.pickupLongitude) * 10) / 10,
        }))
        .filter((d) => d.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    }

    return deliveries;
  }

  // ─── ACCEPTER (livreur) ───────────────────────────────────────

  async accept(id: string, userId: string) {
    const livreur = await getLivreurProfile(userId);

    const existing = await prisma.delivery.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundError('Livraison');

    // Attribution atomique : seulement si encore en recherche et non assignée
    const claim = await prisma.delivery.updateMany({
      where: { id, status: DeliveryStatus.RECHERCHE_LIVREUR, livreurId: null },
      data: { livreurId: livreur.id, status: DeliveryStatus.ACCEPTEE, acceptedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new ConflictError('Cette livraison a déjà été attribuée à un autre livreur');
    }

    const delivery = await prisma.delivery.findUnique({ where: { id }, include: DELIVERY_INCLUDE });
    notifyPatient(await this.patientUserId(id), 'delivery:status', {
      deliveryId: id,
      status: DeliveryStatus.ACCEPTEE,
    });
    logger.info('Livraison acceptée', { deliveryId: id, livreurId: livreur.id });
    return delivery;
  }

  // ─── RÉCUPÉRÉE À LA PHARMACIE (livreur) ───────────────────────

  async pickedUp(id: string, userId: string) {
    const delivery = await this.loadForLivreur(id, userId);
    if (delivery.status !== DeliveryStatus.ACCEPTEE) {
      throw new BadRequestError(`Statut invalide pour une récupération : "${delivery.status}"`);
    }
    const updated = await prisma.delivery.update({
      where: { id },
      data: { status: DeliveryStatus.RECUPEREE, pickedUpAt: new Date() },
      include: DELIVERY_INCLUDE,
    });
    notifyPatient(await this.patientUserId(id), 'delivery:status', {
      deliveryId: id,
      status: DeliveryStatus.RECUPEREE,
    });
    logger.info('Colis récupéré', { deliveryId: id });
    return updated;
  }

  // ─── LIVRÉE (livreur) ─────────────────────────────────────────

  async delivered(id: string, userId: string, data: DeliveredInput) {
    const delivery = await this.loadForLivreur(id, userId);
    if (delivery.status !== DeliveryStatus.RECUPEREE && delivery.status !== DeliveryStatus.EN_ROUTE) {
      throw new BadRequestError(`La livraison doit être récupérée avant d'être livrée (statut : "${delivery.status}")`);
    }

    // Transaction : clôturer la livraison + la commande + incrémenter le compteur livreur
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.LIVREE,
          deliveredAt: new Date(),
          deliveryPhotoUrl: data.deliveryPhotoUrl,
          signatureUrl: data.signatureUrl,
        },
        include: DELIVERY_INCLUDE,
      });
      await tx.pharmacyOrder.update({
        where: { id: d.order.id },
        data: { status: PharmacyOrderStatus.LIVREE, completedAt: new Date() },
      });
      if (delivery.livreurId) {
        await tx.livreurProfile.update({
          where: { id: delivery.livreurId },
          data: { totalDeliveries: { increment: 1 } },
        });
      }
      return d;
    });

    notifyPatient(await this.patientUserId(id), 'delivery:status', { deliveryId: id, status: DeliveryStatus.LIVREE });
    logger.info('Livraison terminée', { deliveryId: id });
    return updated;
  }

  // ─── ÉCHEC (livreur) ──────────────────────────────────────────

  async failed(id: string, userId: string, data: FailedInput) {
    const delivery = await this.loadForLivreur(id, userId);
    const terminal: DeliveryStatus[] = [DeliveryStatus.LIVREE, DeliveryStatus.ECHEC, DeliveryStatus.ANNULEE];
    if (terminal.includes(delivery.status)) {
      throw new BadRequestError(`Livraison déjà clôturée (statut : "${delivery.status}")`);
    }
    const updated = await prisma.delivery.update({
      where: { id },
      data: { status: DeliveryStatus.ECHEC, failureReason: data.reason },
      include: DELIVERY_INCLUDE,
    });
    notifyPatient(await this.patientUserId(id), 'delivery:status', {
      deliveryId: id,
      status: DeliveryStatus.ECHEC,
      reason: data.reason,
    });
    logger.info('Livraison en échec', { deliveryId: id, reason: data.reason });
    return updated;
  }

  // ─── TRACKING (patient ou livreur) ────────────────────────────

  async getTracking(id: string, userId: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        pickupLatitude: true,
        pickupLongitude: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        livreurCurrentLat: true,
        livreurCurrentLng: true,
        lastLocationUpdate: true,
        estimatedDeliveryTime: true,
        acceptedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        order: { select: { patient: { select: { userId: true } } } },
        livreur: {
          select: {
            userId: true,
            vehicleType: true,
            averageRating: true,
            user: { select: { firstName: true, lastName: true, phoneNumber: true } },
          },
        },
      },
    });
    if (!delivery) throw new NotFoundError('Livraison');

    const isPatient = delivery.order.patient.userId === userId;
    const isLivreur = delivery.livreur?.userId === userId;
    if (!isPatient && !isLivreur) {
      throw new ForbiddenError("Vous n'avez pas accès au suivi de cette livraison");
    }
    return delivery;
  }

  // ─── Internes ─────────────────────────────────────────────────

  /** Charge une livraison et vérifie qu'elle est assignée à ce livreur */
  private async loadForLivreur(id: string, userId: string) {
    const livreur = await getLivreurProfile(userId);
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      select: { id: true, livreurId: true, status: true },
    });
    if (!delivery) throw new NotFoundError('Livraison');
    if (delivery.livreurId !== livreur.id) {
      throw new ForbiddenError("Cette livraison ne vous est pas attribuée");
    }
    return delivery;
  }

  /** Récupère l'userId du patient d'une livraison (pour notifications) */
  private async patientUserId(deliveryId: string): Promise<string | undefined> {
    const d = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { order: { select: { patient: { select: { userId: true } } } } },
    });
    return d?.order.patient.userId;
  }
}

export const deliveryService = new DeliveryService();
