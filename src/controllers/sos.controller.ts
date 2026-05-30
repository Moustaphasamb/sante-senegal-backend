import { Request, Response, NextFunction } from 'express';
import { sosService } from '../services/sos.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type { CreateSosAlertInput, ListSosAlertsQuery } from '../validators/sos.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

class SosController {
  // ─── DÉCLENCHER ───────────────────────────────────────────────

  trigger = async (
    req: Request<{}, {}, CreateSosAlertInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await sosService.trigger(req.user.userId, req.body, ipAddress, userAgent);
      sendCreated(res, result, 'Alerte SOS déclenchée');
    } catch (error) {
      next(error);
    }
  };

  // ─── MES ALERTES ──────────────────────────────────────────────

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListSosAlertsQuery;
      const result = await sosService.listMine(req.user.userId, query);
      sendSuccess(res, result.alerts, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── RÉSOUDRE ─────────────────────────────────────────────────

  resolve = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const alert = await sosService.resolve(req.params.id, req.user.userId, req.user.role, ipAddress, userAgent);
      sendSuccess(res, alert, { message: 'Alerte marquée comme résolue' });
    } catch (error) {
      next(error);
    }
  };
}

export const sosController = new SosController();
