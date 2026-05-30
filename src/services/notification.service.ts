import { NotificationType, NotificationChannel } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { smsService } from './sms.service';
import { getIO } from '../sockets';
import type {
  ListNotificationsQuery,
  UpdateNotificationSettingsInput,
} from '../validators/notification.validators';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface NotifyOptions {
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  sms?: boolean; // tenter aussi un envoi SMS
  smsMessage?: string; // texte SMS spécifique (sinon = message in-app)
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

interface SettingsLike {
  smsEnabled: boolean;
  rdvReminders: boolean;
  prescriptionAlerts: boolean;
  paymentAlerts: boolean;
  promotionalMessages: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

/** Le type de notification est-il autorisé par les préférences de catégorie ? */
function categoryEnabled(type: NotificationType, s: SettingsLike): boolean {
  if (type.startsWith('RDV_')) return s.rdvReminders;
  if (type === NotificationType.ORDONNANCE_RECUE) return s.prescriptionAlerts;
  if (type === NotificationType.PAIEMENT_REUSSI || type === NotificationType.PAIEMENT_ECHEC) {
    return s.paymentAlerts;
  }
  return true; // tout le reste (urgences, système, livraison…) toujours autorisé
}

/** Heure actuelle dans les heures silencieuses ? (Sénégal = UTC, pas de DST) */
function inQuietHours(s: SettingsLike): boolean {
  if (!s.quietHoursStart || !s.quietHoursEnd) return false;
  const now = new Date();
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [sh, sm] = s.quietHoursStart.split(':').map(Number);
  const [eh, em] = s.quietHoursEnd.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // Plage qui chevauche minuit (ex : 22:00 → 07:00)
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

function emitRealtime(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket.io non initialisé — on ignore
  }
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class NotificationService {
  // ─── PRÉFÉRENCES (upsert avec valeurs par défaut) ─────────────

  async getOrCreateSettings(userId: string) {
    return prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(userId: string, data: UpdateNotificationSettingsInput) {
    return prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  // ─── NOTIFIER (réutilisable par tous les modules) ─────────────

  /**
   * Crée une notification in-app, l'émet en temps réel (Socket.io)
   * et tente un SMS si demandé et autorisé par les préférences.
   * Ne lève jamais d'erreur bloquante (best-effort).
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    opts: NotifyOptions = {}
  ) {
    try {
      const settings = await this.getOrCreateSettings(userId);
      if (!categoryEnabled(type, settings)) {
        return null; // l'utilisateur a désactivé cette catégorie
      }

      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          channel: NotificationChannel.IN_APP,
          title,
          message,
          metadata: opts.metadata as object | undefined,
          actionUrl: opts.actionUrl,
          isSent: true,
          sentAt: new Date(),
        },
      });

      emitRealtime(userId, 'notification:new', {
        id: notification.id,
        type,
        title,
        message,
        actionUrl: opts.actionUrl,
        createdAt: notification.createdAt,
      });

      // ─── Canal SMS (optionnel) ──────────────────────────────
      if (opts.sms && settings.smsEnabled && !inQuietHours(settings)) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { phoneNumber: true },
        });
        if (user?.phoneNumber) {
          void smsService
            .send({ to: user.phoneNumber, message: opts.smsMessage ?? message })
            .catch((err) => logger.error('Échec envoi SMS notification', { userId, err }));
        }
      }

      return notification;
    } catch (err) {
      logger.error('Échec création notification', { userId, type, err });
      return null;
    }
  }

  // ─── LISTE ────────────────────────────────────────────────────

  async list(userId: string, query: ListNotificationsQuery) {
    const { page, limit, unreadOnly, type } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
      ...(type && { type }),
    };

    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount },
    };
  }

  // ─── MARQUER LU ───────────────────────────────────────────────

  async markRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, isRead: true },
    });
    if (!notification || notification.userId !== userId) throw new NotFoundError('Notification');

    if (notification.isRead) return notification;

    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ─── TOUT MARQUER LU ──────────────────────────────────────────

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}

export const notificationService = new NotificationService();
