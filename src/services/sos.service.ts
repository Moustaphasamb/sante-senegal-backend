import { UserRole, NotificationType } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import { smsService } from './sms.service';
import { notificationService } from './notification.service';
import type { CreateSosAlertInput, ListSosAlertsQuery } from '../validators/sos.validators';

// ═══════════════════════════════════════════════════════════════════
// Service Urgences (SOS)
// ═══════════════════════════════════════════════════════════════════

class SosService {
  // ─── DÉCLENCHER ───────────────────────────────────────────────

  async trigger(userId: string, data: CreateSosAlertInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, phoneNumber: true },
    });
    if (!user) throw new NotFoundError('Utilisateur');

    const alert = await prisma.sosAlert.create({
      data: {
        userId,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        message: data.message,
      },
    });

    // ─── Notifier les contacts d'urgence (best-effort) ────────────
    const contacts = await prisma.emergencyContact.findMany({
      where: { userId, notifyOnEmergency: true },
      select: { name: true, phoneNumber: true },
    });

    const mapsLink = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
    const fullName = `${user.firstName} ${user.lastName}`;
    const smsText =
      `[Santé Sénégal - URGENCE] ${fullName} a déclenché une alerte SOS. ` +
      `Position : ${data.address ? data.address + ' — ' : ''}${mapsLink}` +
      `${data.message ? ` — Message : ${data.message}` : ''}`;

    let notifiedCount = 0;
    for (const contact of contacts) {
      const result = await smsService.send({ to: contact.phoneNumber, message: smsText });
      if (result.success) notifiedCount++;
    }

    if (notifiedCount > 0) {
      await prisma.sosAlert.update({
        where: { id: alert.id },
        data: { contactsNotified: true },
      });
    }

    // Notification in-app à l'utilisateur (confirmation)
    void notificationService.notify(
      userId,
      NotificationType.URGENCE_SOS,
      'Alerte SOS déclenchée',
      `Votre alerte a été enregistrée. ${notifiedCount} contact(s) d'urgence notifié(s).`,
      { metadata: { sosAlertId: alert.id }, actionUrl: `/sos/${alert.id}` }
    );

    void createAuditLog({
      userId,
      action: 'SOS_ALERT_TRIGGERED',
      resourceType: 'SOS_ALERT',
      resourceId: alert.id,
      metadata: { latitude: data.latitude, longitude: data.longitude, notifiedCount },
      ipAddress,
      userAgent,
    });

    logger.warn('🚨 Alerte SOS déclenchée', { alertId: alert.id, userId, notifiedCount });

    return { alert, contactsNotified: notifiedCount };
  }

  // ─── MES ALERTES ──────────────────────────────────────────────

  async listMine(userId: string, query: ListSosAlertsQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [alerts, total] = await prisma.$transaction([
      prisma.sosAlert.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sosAlert.count({ where: { userId } }),
    ]);

    return { alerts, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── RÉSOUDRE ─────────────────────────────────────────────────

  async resolve(id: string, userId: string, userRole: UserRole, ipAddress?: string, userAgent?: string) {
    const alert = await prisma.sosAlert.findUnique({
      where: { id },
      select: { id: true, userId: true, isResolved: true },
    });
    if (!alert) throw new NotFoundError('Alerte SOS');

    // Propriétaire ou super-admin uniquement
    if (alert.userId !== userId && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError("Cette alerte ne vous appartient pas");
    }
    if (alert.isResolved) {
      throw new BadRequestError('Cette alerte est déjà résolue');
    }

    const updated = await prisma.sosAlert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });

    void createAuditLog({
      userId,
      action: 'SOS_ALERT_RESOLVED',
      resourceType: 'SOS_ALERT',
      resourceId: id,
      ipAddress,
      userAgent,
    });

    logger.info('Alerte SOS résolue', { alertId: id, userId });
    return updated;
  }
}

export const sosService = new SosService();
