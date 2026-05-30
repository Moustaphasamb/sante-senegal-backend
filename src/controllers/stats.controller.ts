import { Request, Response, NextFunction } from 'express';
import { statsService } from '../services/stats.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

class StatsController {
  // ─── STATS PERSONNELLES ───────────────────────────────────────

  getMyStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const stats = await statsService.getMyStats(req.user.userId, req.user.role);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  };

  // ─── STATS ÉTABLISSEMENT ──────────────────────────────────────

  getEstablishmentStats = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const stats = await statsService.getEstablishmentStats(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  };

  // ─── STATS GLOBALES ───────────────────────────────────────────

  getGlobalStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await statsService.getGlobalStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  };
}

export const statsController = new StatsController();
