import {
  UserRole,
  AppointmentStatus,
  PrescriptionStatus,
  PharmacyOrderStatus,
  DeliveryStatus,
  HomeVisitStatus,
  PaymentStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';

const MEDECIN_ROLES: UserRole[] = [
  UserRole.MEDECIN_SALARIE,
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.SPECIALISTE_CABINET,
];

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

async function walletSummary(userId: string) {
  const w = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true, pendingBalance: true, totalEarned: true, totalWithdrawn: true },
  });
  return w ?? { balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 };
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ═══════════════════════════════════════════════════════════════════
// Service Statistiques & Dashboards
// ═══════════════════════════════════════════════════════════════════

class StatsService {
  // ─── STATS PERSONNELLES (selon le rôle) ───────────────────────

  async getMyStats(userId: string, role: UserRole) {
    if (role === UserRole.PATIENT) return this.patientStats(userId);
    if (MEDECIN_ROLES.includes(role)) return this.medecinStats(userId);
    if (role === UserRole.PHARMACIEN) return this.pharmacienStats(userId);
    if (role === UserRole.LIVREUR) return this.livreurStats(userId);
    // INFIRMIER, admins : tableau minimal (leurs KPIs passent par d'autres endpoints)
    return { role, wallet: await walletSummary(userId) };
  }

  private async patientStats(userId: string) {
    const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundError('Profil patient');
    const patientId = profile.id;
    const now = new Date();

    const [appointmentsTotal, appointmentsUpcoming, appointmentsCompleted, prescriptionsActive, ordersTotal, wallet] =
      await Promise.all([
        prisma.appointment.count({ where: { patientId } }),
        prisma.appointment.count({
          where: {
            patientId,
            scheduledAt: { gt: now },
            status: { in: [AppointmentStatus.EN_ATTENTE, AppointmentStatus.CONFIRME, AppointmentStatus.REPROGRAMME] },
          },
        }),
        prisma.appointment.count({ where: { patientId, status: AppointmentStatus.TERMINE } }),
        prisma.prescription.count({ where: { patientId, status: PrescriptionStatus.ACTIVE } }),
        prisma.pharmacyOrder.count({ where: { patientId } }),
        walletSummary(userId),
      ]);

    return {
      role: UserRole.PATIENT,
      appointments: { total: appointmentsTotal, upcoming: appointmentsUpcoming, completed: appointmentsCompleted },
      prescriptionsActive,
      pharmacyOrders: ordersTotal,
      wallet,
    };
  }

  private async medecinStats(userId: string) {
    const profile = await prisma.medecinProfile.findUnique({
      where: { userId },
      select: { id: true, averageRating: true, totalReviews: true },
    });
    if (!profile) throw new NotFoundError('Profil médecin');
    const medecinId = profile.id;
    const now = new Date();

    const [appointmentsTotal, appointmentsCompleted, appointmentsUpcoming, consultationsTotal, prescriptionsIssued, homeVisitsCompleted, wallet] =
      await Promise.all([
        prisma.appointment.count({ where: { medecinId } }),
        prisma.appointment.count({ where: { medecinId, status: AppointmentStatus.TERMINE } }),
        prisma.appointment.count({
          where: {
            medecinId,
            scheduledAt: { gt: now },
            status: { in: [AppointmentStatus.EN_ATTENTE, AppointmentStatus.CONFIRME, AppointmentStatus.REPROGRAMME] },
          },
        }),
        prisma.consultation.count({ where: { medecinId } }),
        prisma.prescription.count({ where: { medecinId } }),
        prisma.homeVisit.count({ where: { medecinId, status: HomeVisitStatus.TERMINEE } }),
        walletSummary(userId),
      ]);

    return {
      role: 'MEDECIN',
      rating: { average: profile.averageRating, totalReviews: profile.totalReviews },
      appointments: { total: appointmentsTotal, completed: appointmentsCompleted, upcoming: appointmentsUpcoming },
      consultationsTotal,
      prescriptionsIssued,
      homeVisitsCompleted,
      wallet,
    };
  }

  private async pharmacienStats(userId: string) {
    const profile = await prisma.pharmacienProfile.findUnique({
      where: { userId },
      select: { pharmacyId: true },
    });
    if (!profile?.pharmacyId) {
      return { role: UserRole.PHARMACIEN, pharmacy: null, wallet: await walletSummary(userId) };
    }
    const pharmacyId = profile.pharmacyId;

    const [pharmacy, ordersTotal, ordersPending, ordersCompleted, stockItems, lowStockItems, wallet] = await Promise.all([
      prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true, averageRating: true, totalReviews: true } }),
      prisma.pharmacyOrder.count({ where: { pharmacyId } }),
      prisma.pharmacyOrder.count({ where: { pharmacyId, status: PharmacyOrderStatus.EN_ATTENTE } }),
      prisma.pharmacyOrder.count({
        where: { pharmacyId, status: { in: [PharmacyOrderStatus.RETIREE, PharmacyOrderStatus.LIVREE] } },
      }),
      prisma.pharmacyStock.count({ where: { pharmacyId } }),
      prisma.pharmacyStock.count({ where: { pharmacyId, isLowStock: true } }),
      walletSummary(userId),
    ]);

    return {
      role: UserRole.PHARMACIEN,
      pharmacy,
      orders: { total: ordersTotal, pending: ordersPending, completed: ordersCompleted },
      stock: { items: stockItems, lowStock: lowStockItems },
      wallet,
    };
  }

  private async livreurStats(userId: string) {
    const profile = await prisma.livreurProfile.findUnique({
      where: { userId },
      select: { id: true, totalDeliveries: true, averageRating: true },
    });
    if (!profile) throw new NotFoundError('Profil livreur');
    const livreurId = profile.id;

    const [delivered, failed, inProgress, wallet] = await Promise.all([
      prisma.delivery.count({ where: { livreurId, status: DeliveryStatus.LIVREE } }),
      prisma.delivery.count({ where: { livreurId, status: DeliveryStatus.ECHEC } }),
      prisma.delivery.count({
        where: { livreurId, status: { in: [DeliveryStatus.ACCEPTEE, DeliveryStatus.RECUPEREE, DeliveryStatus.EN_ROUTE] } },
      }),
      walletSummary(userId),
    ]);

    return {
      role: UserRole.LIVREUR,
      rating: { average: profile.averageRating },
      deliveries: { total: profile.totalDeliveries, delivered, failed, inProgress },
      wallet,
    };
  }

  // ─── STATS D'UN ÉTABLISSEMENT ─────────────────────────────────

  async getEstablishmentStats(establishmentId: string, userId: string, role: UserRole) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      select: { id: true, name: true },
    });
    if (!establishment) throw new NotFoundError('Établissement');

    // R4 : un ADMIN_ETABLISSEMENT ne voit QUE son établissement
    if (role === UserRole.ADMIN_ETABLISSEMENT) {
      const admin = await prisma.adminProfile.findUnique({ where: { userId }, select: { establishmentId: true } });
      if (!admin || admin.establishmentId !== establishmentId) {
        throw new ForbiddenError("Vous n'avez accès qu'aux statistiques de votre établissement");
      }
    }

    const [medecinsCount, appointmentsTotal, appointmentsThisMonth, appointmentsCompleted, revenueAgg] = await Promise.all([
      prisma.medecinProfile.count({ where: { establishmentId } }),
      prisma.appointment.count({ where: { establishmentId } }),
      prisma.appointment.count({ where: { establishmentId, createdAt: { gte: startOfMonth() } } }),
      prisma.appointment.count({ where: { establishmentId, status: AppointmentStatus.TERMINE } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.REUSSI, appointment: { establishmentId } },
        _sum: { amount: true },
      }),
    ]);

    return {
      establishment,
      medecinsCount,
      appointments: { total: appointmentsTotal, thisMonth: appointmentsThisMonth, completed: appointmentsCompleted },
      revenueXOF: revenueAgg._sum.amount ?? 0,
    };
  }

  // ─── STATS GLOBALES (super-admin) ─────────────────────────────

  async getGlobalStats() {
    const [
      usersByRole,
      establishments,
      pharmacies,
      appointments,
      consultations,
      prescriptions,
      pharmacyOrders,
      deliveries,
      paymentsAgg,
      activeSosAlerts,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.establishment.count({ where: { isActive: true } }),
      prisma.pharmacy.count({ where: { isActive: true } }),
      prisma.appointment.count(),
      prisma.consultation.count(),
      prisma.prescription.count(),
      prisma.pharmacyOrder.count(),
      prisma.delivery.count(),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.REUSSI },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      prisma.sosAlert.count({ where: { isResolved: false } }),
    ]);

    return {
      users: {
        total: usersByRole.reduce((sum, r) => sum + r._count, 0),
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
      },
      establishments,
      pharmacies,
      activity: { appointments, consultations, prescriptions, pharmacyOrders, deliveries },
      payments: {
        successfulCount: paymentsAgg._count,
        volumeXOF: paymentsAgg._sum.amount ?? 0,
        platformRevenueXOF: paymentsAgg._sum.platformFee ?? 0,
      },
      activeSosAlerts,
    };
  }
}

export const statsService = new StatsService();
