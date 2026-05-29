import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { prisma } from '../config/database';

/**
 * Middleware qui vérifie que l'utilisateur est authentifié (JWT valide).
 * Si OK, attache req.user
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError('Token d\'authentification manquant');
    }

    const payload = verifyAccessToken(token);

    // Vérifier que l'utilisateur existe toujours et est actif
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        role: true,
        phoneNumber: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedError('Utilisateur introuvable');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Compte désactivé');
    }

    // Attacher l'utilisateur à la requête
    req.user = {
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware OPTIONNEL : authentifie si token présent, sinon continue sans
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true, deletedAt: true, role: true, phoneNumber: true },
    });

    if (user && user.isActive && !user.deletedAt) {
      req.user = {
        userId: user.id,
        role: user.role,
        phoneNumber: user.phoneNumber,
      };
    }

    next();
  } catch (error) {
    // En cas d'erreur, on continue sans utilisateur authentifié
    next();
  }
};

/**
 * Middleware RBAC : autorise UNIQUEMENT certains rôles
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize('SUPER_ADMIN'), handler)
 *   router.get('/medical', authenticate, authorize('MEDECIN_SALARIE', 'SPECIALISTE_CABINET'), handler)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Non authentifié'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Accès interdit. Rôle requis : ${allowedRoles.join(' ou ')}`
        )
      );
      return;
    }

    next();
  };
};

/**
 * Middleware : autorise tous les médecins (salariés, libéraux, spécialistes, infirmiers)
 */
export const authorizeAnyMedecin = authorize(
  UserRole.MEDECIN_SALARIE,
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.SPECIALISTE_CABINET,
  UserRole.INFIRMIER_DOMICILE
);

/**
 * Middleware : autorise tout admin (établissement ou super)
 */
export const authorizeAnyAdmin = authorize(
  UserRole.ADMIN_ETABLISSEMENT,
  UserRole.SUPER_ADMIN
);

/**
 * Middleware : KYC requis (uniquement les utilisateurs validés)
 */
export const requireKycApproved = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Non authentifié');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { kycStatus: true },
    });

    if (user?.kycStatus !== 'APPROVED') {
      throw new ForbiddenError(
        'Votre compte est en attente de validation. Vous serez notifié dès validation.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
