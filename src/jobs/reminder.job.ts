import { AppointmentStatus, NotificationType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';
import { smsTemplates } from '../services/sms.service';

// RDV concernés par les rappels (ni annulés, ni terminés)
const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.EN_ATTENTE,
  AppointmentStatus.CONFIRME,
  AppointmentStatus.REPROGRAMME,
];

const HOUR = 60 * 60 * 1000;

function formatDateFr(d: Date): string {
  return d.toLocaleString('fr-FR', { timeZone: 'Africa/Dakar', dateStyle: 'full', timeStyle: 'short' });
}

function medecinName(a: { medecin: { user: { firstName: string; lastName: string } } }): string {
  return `Dr ${a.medecin.user.firstName} ${a.medecin.user.lastName}`;
}

const REMINDER_INCLUDE = {
  patient: { select: { userId: true } },
  medecin: { select: { user: { select: { firstName: true, lastName: true } } } },
} as const;

/**
 * Scanne les RDV à venir et envoie les rappels J-1 (23-25h) et H-2 (1.5-2.5h).
 * Idempotent : les flags reminderJ1Sent / reminderH2Sent évitent les doublons.
 */
export async function runAppointmentReminderScan(): Promise<void> {
  const now = new Date();

  // ─── Rappel J-1 (entre 23h et 25h avant le RDV) ───────────────
  const j1 = await prisma.appointment.findMany({
    where: {
      reminderJ1Sent: false,
      status: { in: ACTIVE_STATUSES },
      scheduledAt: { gte: new Date(now.getTime() + 23 * HOUR), lte: new Date(now.getTime() + 25 * HOUR) },
    },
    select: { id: true, scheduledAt: true, ...REMINDER_INCLUDE },
  });

  for (const a of j1) {
    const date = formatDateFr(new Date(a.scheduledAt));
    await notificationService.notify(
      a.patient.userId,
      NotificationType.RDV_RAPPEL_J1,
      'Rappel : RDV demain',
      `Vous avez un rendez-vous demain avec ${medecinName(a)} — ${date}.`,
      {
        sms: true,
        smsMessage: smsTemplates.rdvReminderJ1(date, medecinName(a)),
        metadata: { appointmentId: a.id },
        actionUrl: `/appointments/${a.id}`,
      }
    );
    await prisma.appointment.update({ where: { id: a.id }, data: { reminderJ1Sent: true } });
  }

  // ─── Rappel H-2 (entre 1.5h et 2.5h avant le RDV) ─────────────
  const h2 = await prisma.appointment.findMany({
    where: {
      reminderH2Sent: false,
      status: { in: ACTIVE_STATUSES },
      scheduledAt: { gte: new Date(now.getTime() + 1.5 * HOUR), lte: new Date(now.getTime() + 2.5 * HOUR) },
    },
    select: { id: true, scheduledAt: true, ...REMINDER_INCLUDE },
  });

  for (const a of h2) {
    const date = formatDateFr(new Date(a.scheduledAt));
    const heure = new Date(a.scheduledAt).toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Dakar',
      hour: '2-digit',
      minute: '2-digit',
    });
    await notificationService.notify(
      a.patient.userId,
      NotificationType.RDV_RAPPEL_H2,
      'Rappel : RDV dans 2h',
      `Votre rendez-vous avec ${medecinName(a)} est dans environ 2 heures (${heure}).`,
      {
        sms: true,
        smsMessage: smsTemplates.rdvReminderH2(heure, medecinName(a)),
        metadata: { appointmentId: a.id },
        actionUrl: `/appointments/${a.id}`,
      }
    );
    await prisma.appointment.update({ where: { id: a.id }, data: { reminderH2Sent: true } });
  }

  if (j1.length || h2.length) {
    logger.info('Rappels RDV envoyés', { j1: j1.length, h2: h2.length });
  }
}

let reminderTimer: NodeJS.Timeout | null = null;
let isScanning = false;

/**
 * Démarre le planificateur de rappels (toutes les heures, via setInterval).
 * Ne dépend PAS de Redis/Bull — fonctionne même sans cache.
 */
export function startReminderScheduler(): void {
  if (reminderTimer) return; // déjà démarré

  const tick = async (): Promise<void> => {
    if (isScanning) return; // évite les chevauchements
    isScanning = true;
    try {
      await runAppointmentReminderScan();
    } catch (err) {
      logger.error('Erreur lors du scan des rappels RDV', { err });
    } finally {
      isScanning = false;
    }
  };

  // Premier passage au démarrage, puis toutes les heures
  void tick();
  reminderTimer = setInterval(() => void tick(), HOUR);
  logger.info('✅ Planificateur de rappels RDV démarré (intervalle : 1h)');
}

export function stopReminderScheduler(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
