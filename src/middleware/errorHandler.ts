import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { config } from '../config/env';

/**
 * Middleware global de gestion des erreurs.
 * À utiliser EN DERNIER après toutes les routes.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response => {
  // Log de l'erreur
  logger.error(`${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Erreurs personnalisées de l'application
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Erreurs de validation Zod
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 422, 'VALIDATION_ERROR', 'Données invalides', details);
  }

  // Erreurs Prisma — détection par nom de classe (compatible toutes versions)
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    return handlePrismaError(err as Prisma.PrismaClientKnownRequestError, res);
  }

  if (err.constructor.name === 'PrismaClientValidationError') {
    return sendError(
      res,
      400,
      'PRISMA_VALIDATION_ERROR',
      'Erreur de validation de données'
    );
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'INVALID_TOKEN', 'Token invalide');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'TOKEN_EXPIRED', 'Token expiré');
  }

  // Erreur inconnue
  const message = config.isProd
    ? 'Une erreur interne est survenue'
    : err.message;

  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
};

/**
 * Gestion spécifique des erreurs Prisma
 */
const handlePrismaError = (
  err: Prisma.PrismaClientKnownRequestError,
  res: Response
): Response => {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const target = (err.meta?.target as string[])?.join(', ') || 'champ';
      return sendError(
        res,
        409,
        'DUPLICATE_ENTRY',
        `Ce ${target} est déjà utilisé`
      );
    }

    case 'P2025':
      // Record not found
      return sendError(res, 404, 'NOT_FOUND', 'Ressource non trouvée');

    case 'P2003':
      // Foreign key constraint violation
      return sendError(
        res,
        400,
        'FOREIGN_KEY_VIOLATION',
        'Référence invalide vers une ressource'
      );

    case 'P2014':
      // Required relation violation
      return sendError(
        res,
        400,
        'RELATION_VIOLATION',
        'Violation d\'une relation requise'
      );

    default:
      logger.error('Erreur Prisma non gérée:', err);
      return sendError(
        res,
        500,
        'DATABASE_ERROR',
        'Erreur de base de données'
      );
  }
};

/**
 * Middleware pour les routes non trouvées (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response
): Response => {
  return sendError(
    res,
    404,
    'ROUTE_NOT_FOUND',
    `Route ${req.method} ${req.path} non trouvée`
  );
};
