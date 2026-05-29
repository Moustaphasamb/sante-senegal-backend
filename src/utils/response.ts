import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Réponse de succès normalisée
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  options?: {
    status?: number;
    message?: string;
    meta?: SuccessResponse<T>['meta'];
  }
): Response => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (options?.message) {
    response.message = options.message;
  }

  if (options?.meta) {
    response.meta = options.meta;
  }

  return res.status(options?.status ?? 200).json(response);
};

/**
 * Réponse d'erreur normalisée
 */
export const sendError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(status).json(response);
};

/**
 * Réponse de création (201)
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string
): Response => {
  return sendSuccess(res, data, { status: 201, message });
};

/**
 * Réponse sans contenu (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};
