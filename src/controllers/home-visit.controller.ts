import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { homeVisitService } from '../services/home-visit.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreateHomeVisitInput,
  ListHomeVisitsQuery,
  CancelHomeVisitInput,
} from '../validators/home-visit.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

const MEDECIN_ROLES: UserRole[] = [
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.MEDECIN_SALARIE,
  UserRole.SPECIALISTE_CABINET,
  UserRole.INFIRMIER_DOMICILE,
];

class HomeVisitController {
  // ─── CRÉER DEMANDE ────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreateHomeVisitInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const visit = await homeVisitService.create(req.user.userId, req.body, ipAddress, userAgent);
      sendCreated(res, visit, 'Recherche de médecin lancée — vous serez notifié dès acceptation');
    } catch (error) {
      next(error);
    }
  };

  // ─── LISTE MES VISITES ────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListHomeVisitsQuery;
      const result = await homeVisitService.list(req.user.userId, req.user.role, query);
      sendSuccess(res, result.visits, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉTAIL ───────────────────────────────────────────────────

  getById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const visit = await homeVisitService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, visit);
    } catch (error) {
      next(error);
    }
  };

  // ─── ACCEPTER ─────────────────────────────────────────────────

  accept = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const visit = await homeVisitService.accept(req.params.id, req.user.userId);
      sendSuccess(res, visit, { message: 'Visite acceptée — le patient a été notifié' });
    } catch (error) {
      next(error);
    }
  };

  // ─── REFUSER ──────────────────────────────────────────────────

  reject = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await homeVisitService.reject(req.params.id, req.user.userId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── EN ROUTE ─────────────────────────────────────────────────

  startTrip = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const visit = await homeVisitService.startTrip(req.params.id, req.user.userId);
      sendSuccess(res, visit, { message: 'Vous êtes en route — le patient a été notifié' });
    } catch (error) {
      next(error);
    }
  };

  // ─── ARRIVÉ ───────────────────────────────────────────────────

  arrived = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const visit = await homeVisitService.arrived(req.params.id, req.user.userId);
      sendSuccess(res, visit, { message: 'Arrivée enregistrée — le patient a été notifié' });
    } catch (error) {
      next(error);
    }
  };

  // ─── TERMINER ─────────────────────────────────────────────────

  complete = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await homeVisitService.complete(req.params.id, req.user.userId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── ANNULER ──────────────────────────────────────────────────

  cancel = async (
    req: Request<{ id: string }, {}, CancelHomeVisitInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await homeVisitService.cancel(
        req.params.id,
        req.user.userId,
        req.user.role,
        req.body,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Visite annulée' });
    } catch (error) {
      next(error);
    }
  };
}

export const homeVisitController = new HomeVisitController();
