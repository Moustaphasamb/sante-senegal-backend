import crypto from 'crypto';
import { UserRole, KycStatus, Language, Gender } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { normalizePhoneNumber } from '../utils/otp';
import { otpService } from './otp.service';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from '../utils/errors';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface RegisterPatientInput {
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  preferredLanguage?: Language;
  email?: string;
  otpCode: string;
}

export interface RegisterMedecinInput extends RegisterPatientInput {
  role:
    | 'MEDECIN_SALARIE'
    | 'MEDECIN_LIBERAL_MOBILE'
    | 'SPECIALISTE_CABINET'
    | 'INFIRMIER_DOMICILE';
  licenseNumber: string;
}

interface LoginInput {
  phoneNumber: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

interface AuthResult {
  user: {
    id: string;
    phoneNumber: string;
    email: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    isPhoneVerified: boolean;
    kycStatus: KycStatus;
    preferredLanguage: Language;
    profilePhotoUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class AuthService {
  // ─────────────────────────────────────────────────────────────────
  // INSCRIPTION PATIENT
  // ─────────────────────────────────────────────────────────────────
  async registerPatient(input: RegisterPatientInput): Promise<AuthResult> {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    // 1. Vérifier l'OTP
    await otpService.verifyOtp(phoneNumber, input.otpCode, 'REGISTRATION');

    // 2. Vérifier le mot de passe
    const passwordCheck = validatePasswordStrength(input.password);
    if (!passwordCheck.isValid) {
      throw new ValidationError('Mot de passe invalide', passwordCheck.errors);
    }

    // 3. Vérifier que l'utilisateur n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      throw new ConflictError('Ce numéro de téléphone est déjà utilisé');
    }

    if (input.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existingEmail) {
        throw new ConflictError('Cet email est déjà utilisé');
      }
    }

    // 4. Hash du mot de passe
    const passwordHash = await hashPassword(input.password);

    // 5. Créer l'utilisateur + profil patient + DME (transaction)
    const user = await prisma.user.create({
      data: {
        phoneNumber,
        email: input.email,
        passwordHash,
        role: UserRole.PATIENT,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender,
        preferredLanguage: input.preferredLanguage ?? Language.FR,
        isPhoneVerified: true,
        kycStatus: KycStatus.APPROVED,
        patientProfile: {
          create: {
            medicalRecord: {
              create: {},
            },
          },
        },
        wallet: {
          create: {
            balance: 0,
          },
        },
        notificationSettings: {
          create: {},
        },
      },
    });

    logger.info('Nouveau patient inscrit', {
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });

    // 6. Générer les tokens
    return this.buildAuthResult(user);
  }

  // ─────────────────────────────────────────────────────────────────
  // INSCRIPTION MÉDECIN/PROFESSIONNEL
  // ─────────────────────────────────────────────────────────────────
  async registerMedecin(input: RegisterMedecinInput): Promise<AuthResult> {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    // 1. Vérifier l'OTP
    await otpService.verifyOtp(phoneNumber, input.otpCode, 'REGISTRATION');

    // 2. Vérifier mot de passe
    const passwordCheck = validatePasswordStrength(input.password);
    if (!passwordCheck.isValid) {
      throw new ValidationError('Mot de passe invalide', passwordCheck.errors);
    }

    // 3. Vérifier unicité du numéro ET du license number
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });
    if (existingUser) {
      throw new ConflictError('Ce numéro de téléphone est déjà utilisé');
    }

    const existingLicense = await prisma.medecinProfile.findUnique({
      where: { licenseNumber: input.licenseNumber },
    });
    if (existingLicense) {
      throw new ConflictError(
        'Ce numéro d\'ordre est déjà utilisé. Si c\'est une erreur, contactez le support.'
      );
    }

    // 4. Hash du mot de passe
    const passwordHash = await hashPassword(input.password);

    // 5. Créer l'utilisateur — KYC PENDING (vérification manuelle requise)
    const user = await prisma.user.create({
      data: {
        phoneNumber,
        email: input.email,
        passwordHash,
        role: input.role as UserRole,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender,
        preferredLanguage: input.preferredLanguage ?? Language.FR,
        isPhoneVerified: true,
        kycStatus: KycStatus.PENDING,
        medecinProfile: {
          create: {
            licenseNumber: input.licenseNumber,
            isVerified: false,
            specialties: [],
            languages: [input.preferredLanguage ?? Language.FR],
          },
        },
        wallet: {
          create: { balance: 0 },
        },
        notificationSettings: {
          create: {},
        },
      },
    });

    logger.info('Nouveau professionnel de santé inscrit (KYC pending)', {
      userId: user.id,
      role: user.role,
      licenseNumber: input.licenseNumber,
    });

    return this.buildAuthResult(user);
  }

  // ─────────────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────────────
  async login(input: LoginInput): Promise<AuthResult> {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    // 1. Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      // Ne pas révéler si le compte existe ou non
      throw new UnauthorizedError('Numéro ou mot de passe incorrect');
    }

    // 2. Vérifier que le compte est actif
    if (!user.isActive) {
      throw new ForbiddenError('Ce compte a été désactivé');
    }

    if (user.deletedAt) {
      throw new UnauthorizedError('Numéro ou mot de passe incorrect');
    }

    // 3. Vérifier le mot de passe
    const passwordOk = await comparePassword(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Numéro ou mot de passe incorrect');
    }

    // 4. Mettre à jour lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: input.ipAddress,
      },
    });

    logger.info('Connexion réussie', {
      userId: user.id,
      role: user.role,
    });

    return this.buildAuthResult(user, {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────
  async refreshTokens(refreshTokenStr: string): Promise<AuthResult> {
    // 1. Vérifier la signature
    const payload = verifyRefreshToken(refreshTokenStr);

    // 2. Vérifier que le token existe en DB et n'est pas révoqué
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Refresh token invalide');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedError('Refresh token révoqué');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expiré');
    }

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new ForbiddenError('Compte désactivé');
    }

    // 3. Rotation : révoquer l'ancien refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // 4. Générer une nouvelle paire de tokens
    return this.buildAuthResult(storedToken.user, {
      userAgent: storedToken.userAgent ?? undefined,
      ipAddress: storedToken.ipAddress ?? undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────────────────────────
  async logout(refreshTokenStr: string): Promise<void> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
    });

    if (storedToken && !storedToken.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Déconnecte de TOUS les appareils (révoque tous les refresh tokens)
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    logger.info('Déconnexion de tous les appareils', { userId });
  }

  // ─────────────────────────────────────────────────────────────────
  // ME (utilisateur connecté)
  // ─────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: {
          include: {
            medicalRecord: {
              select: {
                id: true,
                medicalHistory: true,
              },
            },
          },
        },
        medecinProfile: {
          include: {
            establishment: {
              select: {
                id: true,
                name: true,
                type: true,
                city: true,
              },
            },
          },
        },
        pharmacienProfile: {
          include: {
            pharmacy: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
        livreurProfile: true,
        adminProfile: true,
        wallet: {
          select: {
            balance: true,
            pendingBalance: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Utilisateur');
    }

    // Ne jamais renvoyer le passwordHash
    const { passwordHash, twoFactorSecret, ...userSafe } = user;
    return userSafe;
  }

  // ─────────────────────────────────────────────────────────────────
  // CHANGEMENT DE MOT DE PASSE
  // ─────────────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Utilisateur');

    const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestError('Mot de passe actuel incorrect');
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      throw new ValidationError('Nouveau mot de passe invalide', passwordCheck.errors);
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Révoquer tous les refresh tokens (forcer reconnexion)
    await this.logoutAllDevices(userId);

    logger.info('Mot de passe changé', { userId });
  }

  // ─────────────────────────────────────────────────────────────────
  // RÉINITIALISATION MOT DE PASSE (via OTP)
  // ─────────────────────────────────────────────────────────────────
  async resetPassword(
    phoneNumber: string,
    otpCode: string,
    newPassword: string
  ): Promise<void> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // 1. Vérifier OTP
    await otpService.verifyOtp(normalizedPhone, otpCode, 'RESET_PASSWORD');

    // 2. Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });
    if (!user) {
      throw new NotFoundError('Utilisateur');
    }

    // 3. Valider le nouveau mot de passe
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      throw new ValidationError('Mot de passe invalide', passwordCheck.errors);
    }

    // 4. Mettre à jour
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // 5. Révoquer tous les refresh tokens
    await this.logoutAllDevices(user.id);

    logger.info('Mot de passe réinitialisé via OTP', { userId: user.id });
  }

  // ═════════════════════════════════════════════════════════════════
  // HELPER PRIVÉ : Génère access + refresh tokens et les sauvegarde
  // ═════════════════════════════════════════════════════════════════
  private async buildAuthResult(
    user: {
      id: string;
      phoneNumber: string;
      email: string | null;
      firstName: string;
      lastName: string;
      role: UserRole;
      isPhoneVerified: boolean;
      kycStatus: KycStatus;
      preferredLanguage: Language;
      profilePhotoUrl: string | null;
    },
    sessionInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    // Générer un ID unique pour ce refresh token
    const tokenId = crypto.randomUUID();

    // Access token
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    });

    // Refresh token
    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenId,
    });

    // Sauvegarder le refresh token en DB
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
        userAgent: sessionInfo?.userAgent,
        ipAddress: sessionInfo?.ipAddress,
      },
    });

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        kycStatus: user.kycStatus,
        preferredLanguage: user.preferredLanguage,
        profilePhotoUrl: user.profilePhotoUrl,
      },
      accessToken,
      refreshToken,
    };
  }
}

export const authService = new AuthService();
