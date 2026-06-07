import crypto from 'crypto';
import { UserRole, PharmacyOrderStatus, PrescriptionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  CreatePharmacyOrderInput,
  ListPharmacyOrdersQuery,
} from '../validators/pharmacy-order.validators';

// ═══════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════

// Commission plateforme sur les frais de livraison (R10)
const DELIVERY_PLATFORM_RATE = 0.2;

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CMD-${year}-${hex}`;
}

async function getPatientProfile(userId: string) {
  const p = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!p) throw new NotFoundError('Profil patient');
  return p;
}

async function getPharmacienPharmacyId(userId: string): Promise<string> {
  const profile = await prisma.pharmacienProfile.findUnique({
    where: { userId },
    select: { pharmacyId: true },
  });
  if (!profile?.pharmacyId) {
    throw new ForbiddenError("Aucune pharmacie n'est associée à votre compte");
  }
  return profile.pharmacyId;
}

const ORDER_INCLUDE = {
  items: true,
  pharmacy: { select: { id: true, name: true, address: true, city: true, phoneNumber: true } },
  patient: { select: { user: { select: { firstName: true, lastName: true, phoneNumber: true } } } },
  prescription: { select: { id: true, prescriptionNumber: true } },
  delivery: { select: { id: true, status: true } },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class PharmacyOrderService {
  // ─── CRÉER ────────────────────────────────────────────────────

  async create(userId: string, data: CreatePharmacyOrderInput) {
    const patient = await getPatientProfile(userId);

    // Pharmacie cible
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id: data.pharmacyId, isActive: true },
      select: {
        id: true,
        address: true,
        hasDelivery: true,
        deliveryFee: true,
        minimumOrder: true,
      },
    });
    if (!pharmacy) throw new NotFoundError('Pharmacie');

    if (data.deliveryMode === 'LIVRAISON' && !pharmacy.hasDelivery) {
      throw new BadRequestError('Cette pharmacie ne propose pas la livraison');
    }

    // Ordonnance (optionnelle) — vérifier propriété + validité
    if (data.prescriptionId) {
      const prescription = await prisma.prescription.findUnique({
        where: { id: data.prescriptionId },
        select: { patientId: true, status: true, validUntil: true },
      });
      if (!prescription) throw new NotFoundError('Ordonnance');
      if (prescription.patientId !== patient.id) {
        throw new ForbiddenError("Cette ordonnance ne vous appartient pas");
      }
      if (prescription.status !== PrescriptionStatus.ACTIVE) {
        throw new BadRequestError("Cette ordonnance n'est plus active");
      }
      if (prescription.validUntil < new Date()) {
        throw new BadRequestError('Cette ordonnance est expirée');
      }
    }

    // Vérifier la disponibilité + récupérer le prix réel depuis le stock (R9)
    const medicationIds = data.items.map((i) => i.medicationId);
    const stocks = await prisma.pharmacyStock.findMany({
      where: { pharmacyId: pharmacy.id, medicationId: { in: medicationIds } },
      select: {
        medicationId: true,
        quantity: true,
        price: true,
        medication: { select: { commercialName: true, dci: true, dosage: true } },
      },
    });
    const stockMap = new Map(stocks.map((s) => [s.medicationId, s]));

    const orderItems = data.items.map((item) => {
      const stock = stockMap.get(item.medicationId);
      if (!stock) {
        throw new BadRequestError(`Médicament indisponible dans cette pharmacie (${item.medicationId})`);
      }
      if (stock.quantity < item.quantity) {
        throw new BadRequestError(
          `Stock insuffisant pour ${stock.medication.commercialName} (disponible : ${stock.quantity})`
        );
      }
      return {
        medicationName: stock.medication.commercialName,
        dci: stock.medication.dci,
        dosage: stock.medication.dosage,
        quantity: item.quantity,
        unitPrice: stock.price,
        totalPrice: stock.price * item.quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const deliveryFee = data.deliveryMode === 'LIVRAISON' ? pharmacy.deliveryFee ?? 0 : 0;

    if (pharmacy.minimumOrder && subtotal < pharmacy.minimumOrder) {
      throw new BadRequestError(
        `Montant minimum de commande : ${pharmacy.minimumOrder} FCFA (votre panier : ${subtotal} FCFA)`
      );
    }

    const order = await prisma.pharmacyOrder.create({
      data: {
        patientId: patient.id,
        pharmacyId: pharmacy.id,
        prescriptionId: data.prescriptionId,
        orderNumber: generateOrderNumber(),
        status: PharmacyOrderStatus.EN_ATTENTE,
        deliveryMode: data.deliveryMode,
        deliveryAddress: data.deliveryAddress,
        deliveryLatitude: data.deliveryLatitude,
        deliveryLongitude: data.deliveryLongitude,
        deliveryNotes: data.deliveryNotes,
        subtotal,
        deliveryFee,
        totalAmount: subtotal + deliveryFee,
        items: { create: orderItems },
      },
      include: ORDER_INCLUDE,
    });

    logger.info('Commande pharmacie créée', { orderId: order.id, orderNumber: order.orderNumber, userId });
    return order;
  }

  // ─── LISTE ────────────────────────────────────────────────────

  async list(userId: string, userRole: UserRole, query: ListPharmacyOrdersQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    let where: Record<string, unknown>;
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      where = { patientId: p.id };
    } else if (userRole === UserRole.PHARMACIEN) {
      const pharmacyId = await getPharmacienPharmacyId(userId);
      where = { pharmacyId };
    } else {
      throw new ForbiddenError('Accès réservé aux patients et pharmaciens');
    }
    if (status) where.status = status;

    const [orders, total] = await prisma.$transaction([
      prisma.pharmacyOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ORDER_INCLUDE,
      }),
      prisma.pharmacyOrder.count({ where }),
    ]);

    return { orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const order = await prisma.pharmacyOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundError('Commande');
    await this.checkAccess(order, userId, userRole);
    return order;
  }

  /** Vérifie que l'utilisateur a accès à cette commande */
  private async checkAccess(
    order: { patientId: string; pharmacyId: string },
    userId: string,
    userRole: UserRole
  ) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      if (order.patientId !== p.id) throw new ForbiddenError("Cette commande ne vous appartient pas");
      return;
    }
    if (userRole === UserRole.PHARMACIEN) {
      const pharmacyId = await getPharmacienPharmacyId(userId);
      if (order.pharmacyId !== pharmacyId) throw new ForbiddenError("Cette commande ne concerne pas votre pharmacie");
      return;
    }
    throw new ForbiddenError('Accès non autorisé');
  }

  /** Charge une commande et vérifie qu'elle appartient à la pharmacie du pharmacien */
  private async loadForPharmacien(id: string, userId: string) {
    const pharmacyId = await getPharmacienPharmacyId(userId);
    const order = await prisma.pharmacyOrder.findUnique({
      where: { id },
      select: { id: true, pharmacyId: true, patientId: true, status: true, deliveryMode: true, orderNumber: true },
    });
    if (!order) throw new NotFoundError('Commande');
    if (order.pharmacyId !== pharmacyId) {
      throw new ForbiddenError('Cette commande ne concerne pas votre pharmacie');
    }
    return order;
  }

  // ─── ACCEPTER (pharmacien) ────────────────────────────────────

  async accept(id: string, userId: string) {
    const order = await this.loadForPharmacien(id, userId);
    if (order.status !== PharmacyOrderStatus.EN_ATTENTE) {
      throw new BadRequestError(`Impossible d'accepter une commande au statut "${order.status}"`);
    }
    const updated = await prisma.pharmacyOrder.update({
      where: { id },
      data: { status: PharmacyOrderStatus.ACCEPTEE },
      include: ORDER_INCLUDE,
    });
    logger.info('Commande acceptée', { orderId: id, userId });
    return updated;
  }

  // ─── REFUSER (pharmacien) ─────────────────────────────────────

  async refuse(id: string, userId: string, reason?: string) {
    const order = await this.loadForPharmacien(id, userId);
    if (order.status !== PharmacyOrderStatus.EN_ATTENTE) {
      throw new BadRequestError(`Impossible de refuser une commande au statut "${order.status}"`);
    }
    const updated = await prisma.pharmacyOrder.update({
      where: { id },
      data: { status: PharmacyOrderStatus.REFUSEE_PHARMACIEN, cancellationReason: reason },
      include: ORDER_INCLUDE,
    });
    logger.info('Commande refusée', { orderId: id, userId });
    return updated;
  }

  // ─── PRÊTE (pharmacien) ───────────────────────────────────────

  async ready(id: string, userId: string) {
    const order = await this.loadForPharmacien(id, userId);
    if (order.status !== PharmacyOrderStatus.ACCEPTEE && order.status !== PharmacyOrderStatus.EN_PREPARATION) {
      throw new BadRequestError(`La commande doit être acceptée avant d'être prête (statut actuel : "${order.status}")`);
    }
    const updated = await prisma.pharmacyOrder.update({
      where: { id },
      data: { status: PharmacyOrderStatus.PRETE, readyAt: new Date() },
      include: ORDER_INCLUDE,
    });

    // Mode LIVRAISON : créer la mission de livraison (recherche de livreur)
    if (order.deliveryMode === 'LIVRAISON') {
      await this.createDeliveryForOrder(id);
    }

    logger.info('Commande prête', { orderId: id, userId });
    return updated;
  }

  /** Crée la Delivery associée à une commande LIVRAISON prête (idempotent) */
  private async createDeliveryForOrder(orderId: string): Promise<void> {
    const existing = await prisma.delivery.findUnique({ where: { orderId }, select: { id: true } });
    if (existing) return; // déjà créée

    const order = await prisma.pharmacyOrder.findUnique({
      where: { id: orderId },
      select: {
        deliveryFee: true,
        deliveryAddress: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        pharmacy: { select: { address: true, latitude: true, longitude: true } },
      },
    });
    if (
      !order ||
      !order.deliveryAddress ||
      order.deliveryLatitude === null ||
      order.deliveryLongitude === null
    ) {
      throw new BadRequestError('Adresse de livraison incomplète sur la commande');
    }

    // Commission plateforme sur la livraison (R10) : 20 % des frais de livraison
    const platformFee = Math.round(order.deliveryFee * DELIVERY_PLATFORM_RATE);

    await prisma.delivery.create({
      data: {
        orderId,
        pickupAddress: order.pharmacy.address,
        pickupLatitude: order.pharmacy.latitude,
        pickupLongitude: order.pharmacy.longitude,
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
        deliveryFee: order.deliveryFee,
        platformFee,
      },
    });
    logger.info('Mission de livraison créée', { orderId });
  }

  // ─── TERMINER (pharmacien) ────────────────────────────────────

  async complete(id: string, userId: string) {
    const order = await this.loadForPharmacien(id, userId);
    // Les commandes en LIVRAISON sont clôturées par le livreur (module Livraison)
    if (order.deliveryMode === 'LIVRAISON') {
      throw new BadRequestError(
        'Une commande en livraison est clôturée automatiquement par le livreur, pas par la pharmacie'
      );
    }
    if (order.status !== PharmacyOrderStatus.PRETE) {
      throw new BadRequestError(`La commande doit être prête avant d'être terminée (statut actuel : "${order.status}")`);
    }
    const updated = await prisma.pharmacyOrder.update({
      where: { id },
      data: { status: PharmacyOrderStatus.RETIREE, completedAt: new Date() },
      include: ORDER_INCLUDE,
    });
    logger.info('Commande terminée (retrait)', { orderId: id, userId });
    return updated;
  }

  // ─── ANNULER (patient ou pharmacien) ──────────────────────────

  async cancel(id: string, userId: string, userRole: UserRole, reason?: string) {
    const order = await prisma.pharmacyOrder.findUnique({
      where: { id },
      select: { id: true, patientId: true, pharmacyId: true, status: true },
    });
    if (!order) throw new NotFoundError('Commande');
    await this.checkAccess(order, userId, userRole);

    const cancellable: PharmacyOrderStatus[] = [
      PharmacyOrderStatus.EN_ATTENTE,
      PharmacyOrderStatus.ACCEPTEE,
      PharmacyOrderStatus.EN_PREPARATION,
      PharmacyOrderStatus.PRETE,
    ];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestError(`Impossible d'annuler une commande au statut "${order.status}"`);
    }

    const updated = await prisma.pharmacyOrder.update({
      where: { id },
      data: { status: PharmacyOrderStatus.ANNULEE, cancellationReason: reason },
      include: ORDER_INCLUDE,
    });
    logger.info('Commande annulée', { orderId: id, userId, role: userRole });
    return updated;
  }
}

export const pharmacyOrderService = new PharmacyOrderService();
