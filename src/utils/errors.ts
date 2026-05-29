/**
 * Classe de base pour toutes les erreurs personnalisées
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Mauvaise requête
export class BadRequestError extends AppError {
  constructor(message = 'Requête invalide', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

// 401 - Non authentifié
export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// 403 - Non autorisé (authentifié mais sans droit)
export class ForbiddenError extends AppError {
  constructor(message = 'Accès interdit') {
    super(message, 403, 'FORBIDDEN');
  }
}

// 404 - Ressource non trouvée
export class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super(`${resource} non trouvée`, 404, 'NOT_FOUND');
  }
}

// 409 - Conflit (ex: email déjà utilisé)
export class ConflictError extends AppError {
  constructor(message = 'Conflit avec une ressource existante') {
    super(message, 409, 'CONFLICT');
  }
}

// 422 - Données non traitables
export class ValidationError extends AppError {
  constructor(message = 'Données invalides', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
  }
}

// 429 - Trop de requêtes
export class TooManyRequestsError extends AppError {
  constructor(message = 'Trop de requêtes, réessayez plus tard') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

// 500 - Erreur serveur interne
export class InternalServerError extends AppError {
  constructor(message = 'Erreur interne du serveur') {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false);
  }
}

// 503 - Service indisponible
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporairement indisponible') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
