import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { sendError } from '../utils/response';

/**
 * Rate limiter global pour toutes les routes API
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      'Trop de requêtes, veuillez réessayer plus tard'
    );
  },
});

/**
 * Rate limiter strict pour authentification (anti brute force)
 * 5 tentatives par 15 min
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    sendError(
      res,
      429,
      'TOO_MANY_AUTH_ATTEMPTS',
      'Trop de tentatives, veuillez réessayer dans 15 minutes'
    );
  },
});

/**
 * Rate limiter pour envoi OTP (anti spam SMS)
 * 3 envois par 5 min par numéro
 */
export const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phoneNumber || req.ip || 'unknown',
  handler: (req, res) => {
    sendError(
      res,
      429,
      'TOO_MANY_OTP_REQUESTS',
      'Trop de codes OTP demandés, veuillez patienter 5 minutes'
    );
  },
});
