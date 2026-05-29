import { prisma } from '../config/database';
import { config } from '../config/env';
import { generateOtpCode, hashOtpCode, verifyOtpCode, normalizePhoneNumber } from '../utils/otp';
import { smsService, smsTemplates } from './sms.service';
import { BadRequestError, NotFoundError, TooManyRequestsError } from '../utils/errors';
import { logger } from '../utils/logger';

export type OtpPurpose = 'REGISTRATION' | 'LOGIN' | 'RESET_PASSWORD';

interface SendOtpResult {
  success: boolean;
  expiresIn: number; // secondes
  message: string;
}

interface VerifyOtpResult {
  success: boolean;
  otpId: string;
  phoneNumber: string;
}

class OtpService {
  /**
   * Envoie un code OTP par SMS
   */
  async sendOtp(
    phoneNumber: string,
    purpose: OtpPurpose,
    userId?: string
  ): Promise<SendOtpResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // ─── Vérifier qu'on ne spamme pas l'utilisateur ──────────
    // Max 3 OTP non utilisés actifs par numéro
    const activeOtps = await prisma.otpCode.count({
      where: {
        phoneNumber: normalizedPhone,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeOtps >= 3) {
      throw new TooManyRequestsError(
        'Trop de codes OTP demandés. Veuillez patienter avant de réessayer.'
      );
    }

    // ─── Générer le code ──────────────────────────────────────
    const code = generateOtpCode();
    const hashedCode = await hashOtpCode(code);
    const expiresAt = new Date(
      Date.now() + config.otp.expiresInMinutes * 60 * 1000
    );

    // ─── Sauvegarder en DB ────────────────────────────────────
    await prisma.otpCode.create({
      data: {
        phoneNumber: normalizedPhone,
        code: hashedCode,
        purpose,
        expiresAt,
        userId: userId ?? null,
      },
    });

    // ─── Choisir le template selon le purpose ─────────────────
    let message: string;
    switch (purpose) {
      case 'REGISTRATION':
        message = smsTemplates.otpRegistration(code);
        break;
      case 'LOGIN':
        message = smsTemplates.otpLogin(code);
        break;
      case 'RESET_PASSWORD':
        message = smsTemplates.otpResetPassword(code);
        break;
    }

    // ─── Envoyer le SMS ───────────────────────────────────────
    const smsResult = await smsService.send({
      to: normalizedPhone,
      message,
    });

    if (!smsResult.success) {
      logger.error('OTP: échec envoi SMS', {
        phoneNumber: normalizedPhone,
        error: smsResult.error,
      });
      // On ne throw pas pour ne pas révéler les détails à l'utilisateur
    }

    return {
      success: true,
      expiresIn: config.otp.expiresInMinutes * 60,
      message: 'Code OTP envoyé par SMS',
    };
  }

  /**
   * Vérifie un code OTP
   */
  async verifyOtp(
    phoneNumber: string,
    code: string,
    purpose: OtpPurpose
  ): Promise<VerifyOtpResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // ─── Récupérer les OTP non utilisés pour ce numéro ────────
    const otps = await prisma.otpCode.findMany({
      where: {
        phoneNumber: normalizedPhone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (otps.length === 0) {
      throw new NotFoundError('Aucun code OTP valide trouvé. Demandez-en un nouveau.');
    }

    // ─── Essayer de matcher avec un des OTP actifs ────────────
    for (const otp of otps) {
      // Vérifier tentatives max
      if (otp.attempts >= config.otp.maxAttempts) {
        // Invalider cet OTP
        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { expiresAt: new Date() },
        });
        continue;
      }

      const isValid = await verifyOtpCode(code, otp.code);

      // Incrémenter le compteur de tentatives
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      if (isValid) {
        // ✅ Code valide → marquer comme utilisé
        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { usedAt: new Date() },
        });

        // Invalider tous les autres OTP du même numéro/purpose
        await prisma.otpCode.updateMany({
          where: {
            phoneNumber: normalizedPhone,
            purpose,
            usedAt: null,
            id: { not: otp.id },
          },
          data: { expiresAt: new Date() },
        });

        return {
          success: true,
          otpId: otp.id,
          phoneNumber: normalizedPhone,
        };
      }
    }

    throw new BadRequestError('Code OTP incorrect');
  }

  /**
   * Nettoie les OTP expirés (à appeler via un job CRON)
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await prisma.otpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    logger.info(`OTP cleanup: ${result.count} codes supprimés`);
    return result.count;
  }
}

export const otpService = new OtpService();
