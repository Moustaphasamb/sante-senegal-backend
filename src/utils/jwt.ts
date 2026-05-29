import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config/env';
import { UnauthorizedError } from './errors';

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
  phoneNumber: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
  tokenId: string;
}

/**
 * Génère un access token JWT (courte durée)
 */
export const generateAccessToken = (payload: {
  userId: string;
  role: UserRole;
  phoneNumber: string;
}): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
    issuer: config.appName,
  };

  return jwt.sign(payload, config.jwt.secret, options);
};

/**
 * Génère un refresh token JWT (longue durée)
 */
export const generateRefreshToken = (payload: {
  userId: string;
  tokenId: string;
}): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
    issuer: config.appName,
  };

  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

/**
 * Vérifie un access token et retourne le payload
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expiré');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token invalide');
    }
    throw error;
  }
};

/**
 * Vérifie un refresh token et retourne le payload
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token expiré');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Refresh token invalide');
    }
    throw error;
  }
};

/**
 * Extrait le token du header Authorization
 */
export const extractTokenFromHeader = (
  authHeader: string | undefined
): string | null => {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
};

/**
 * Calcule la date d'expiration d'un refresh token
 */
export const getRefreshTokenExpiry = (): Date => {
  const expiresIn = config.jwt.refreshExpiresIn;
  const match = expiresIn.match(/^(\d+)([smhdwy])$/);

  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30j par défaut
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
};
