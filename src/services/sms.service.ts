import { config } from '../config/env';
import { logger } from '../utils/logger';

interface SendSmsOptions {
  to: string;
  message: string;
  provider?: 'TWILIO' | 'ORANGE' | 'AUTO';
}

interface SmsResult {
  success: boolean;
  provider: string;
  externalId?: string;
  error?: string;
}

/**
 * Service d'envoi de SMS avec fallback multi-providers.
 *
 * En mode DEV : log le SMS dans la console au lieu de l'envoyer
 * En mode PROD : envoie via Twilio ou Orange SMS API
 */
class SmsService {
  /**
   * Envoie un SMS via le meilleur provider disponible
   */
  async send(options: SendSmsOptions): Promise<SmsResult> {
    const { to, message, provider = 'AUTO' } = options;

    // ─── MODE DEV : log dans la console ───────────────────────
    if (config.isDev) {
      this.logSmsInDev(to, message);
      return {
        success: true,
        provider: 'DEV_CONSOLE',
        externalId: `dev-${Date.now()}`,
      };
    }

    // ─── MODE PROD : essai des providers ──────────────────────
    if (provider === 'ORANGE' || provider === 'AUTO') {
      const orangeResult = await this.sendViaOrange(to, message);
      if (orangeResult.success) return orangeResult;
    }

    if (provider === 'TWILIO' || provider === 'AUTO') {
      const twilioResult = await this.sendViaTwilio(to, message);
      if (twilioResult.success) return twilioResult;
    }

    logger.error('SMS: tous les providers ont échoué', { to });
    return {
      success: false,
      provider: 'NONE',
      error: 'Aucun provider SMS disponible',
    };
  }

  /**
   * Log un SMS en mode dev (affiché dans la console)
   */
  private logSmsInDev(to: string, message: string): void {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📱 SMS [MODE DEV - non envoyé]');
    logger.info(`   À      : ${to}`);
    logger.info(`   Message: ${message}`);
    logger.info('═══════════════════════════════════════════════════════');
  }

  /**
   * Envoi via Orange Sénégal API
   * TODO: implémenter quand on aura les credentials Orange
   */
  private async sendViaOrange(
    to: string,
    message: string
  ): Promise<SmsResult> {
    if (!config.sms.orange.clientId || !config.sms.orange.clientSecret) {
      return {
        success: false,
        provider: 'ORANGE',
        error: 'Credentials Orange non configurés',
      };
    }

    try {
      // TODO: implémenter l'appel API Orange SMS
      // https://developer.orange.com/apis/sms-sn
      logger.warn('Orange SMS API: implémentation à venir');
      return {
        success: false,
        provider: 'ORANGE',
        error: 'Non implémenté',
      };
    } catch (error) {
      logger.error('Orange SMS error:', error);
      return {
        success: false,
        provider: 'ORANGE',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Envoi via Twilio API (fallback international)
   * TODO: implémenter quand on aura les credentials Twilio
   */
  private async sendViaTwilio(
    to: string,
    message: string
  ): Promise<SmsResult> {
    if (!config.sms.twilio.accountSid || !config.sms.twilio.authToken) {
      return {
        success: false,
        provider: 'TWILIO',
        error: 'Credentials Twilio non configurés',
      };
    }

    try {
      // TODO: implémenter l'appel API Twilio
      logger.warn('Twilio SMS API: implémentation à venir');
      return {
        success: false,
        provider: 'TWILIO',
        error: 'Non implémenté',
      };
    } catch (error) {
      logger.error('Twilio SMS error:', error);
      return {
        success: false,
        provider: 'TWILIO',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}

export const smsService = new SmsService();

// ═══════════════════════════════════════════════════════════════════
// Helpers de messages prédéfinis
// ═══════════════════════════════════════════════════════════════════

export const smsTemplates = {
  otpRegistration: (code: string) =>
    `[Santé Sénégal] Votre code de vérification est : ${code}. Valide 5 minutes. Ne le partagez avec personne.`,

  otpLogin: (code: string) =>
    `[Santé Sénégal] Code de connexion : ${code}. Valide 5 minutes.`,

  otpResetPassword: (code: string) =>
    `[Santé Sénégal] Code pour réinitialiser votre mot de passe : ${code}. Valide 5 minutes.`,

  rdvConfirmation: (date: string, medecin: string) =>
    `[Santé Sénégal] RDV confirmé avec ${medecin} le ${date}. Bonne consultation !`,

  rdvReminderJ1: (date: string, medecin: string) =>
    `[Santé Sénégal] Rappel : RDV demain avec ${medecin} - ${date}`,

  rdvReminderH2: (heure: string, lieu: string) =>
    `[Santé Sénégal] Votre RDV est dans 2h à ${heure} - ${lieu}`,

  prescriptionReceived: (medecin: string) =>
    `[Santé Sénégal] Nouvelle ordonnance de ${medecin} disponible dans l'app.`,
};
