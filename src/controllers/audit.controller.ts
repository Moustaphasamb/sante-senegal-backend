import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';
import type { ListAuditLogsQuery } from '../validators/audit.validators';

class AuditController {
  // ─── LISTE ────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListAuditLogsQuery;
      const result = await auditService.list(query);
      sendSuccess(res, result.logs, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── HISTORIQUE D'UNE RESSOURCE ───────────────────────────────

  resourceHistory = async (
    req: Request<{ resourceType: string; resourceId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const logs = await auditService.resourceHistory(req.params.resourceType, req.params.resourceId);
      sendSuccess(res, logs);
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
