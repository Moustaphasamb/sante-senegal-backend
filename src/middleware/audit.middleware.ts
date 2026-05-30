import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../utils/audit';

/**
 * Middleware d'audit automatique (opt-in, à attacher sur une route précise).
 *
 * Enregistre une entrée AuditLog APRÈS une réponse réussie (< 400),
 * de façon non bloquante. À utiliser sur les routes sensibles qui ne
 * journalisent pas déjà explicitement via createAuditLog.
 *
 * @example
 *   router.delete('/:id',
 *     authenticate,
 *     auditAction('DELETE_RESOURCE', 'RESOURCE'),
 *     controller.remove
 *   );
 */
export function auditAction(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      // Ne journaliser que les succès d'utilisateurs authentifiés
      if (res.statusCode >= 400 || !req.user) return;

      const ua = req.headers['user-agent'];
      const resourceId = getResourceId?.(req) ?? (req.params.id as string | undefined) ?? 'N/A';
      void createAuditLog({
        userId: req.user.userId,
        action,
        resourceType,
        resourceId,
        ipAddress: req.ip,
        userAgent: Array.isArray(ua) ? ua[0] : ua,
      });
    });
    next();
  };
}
