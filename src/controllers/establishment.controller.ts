import { Request, Response, NextFunction } from 'express';
import { establishmentService } from '../services/establishment.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  ListEstablishmentsQuery,
  NearbyEstablishmentsQuery,
  CreateEstablishmentInput,
  UpdateEstablishmentInput,
  AttachMedecinInput,
} from '../validators/establishment.validators';

class EstablishmentController {
  // ─── LISTE ───────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListEstablishmentsQuery;
      const result = await establishmentService.list(query);
      sendSuccess(res, result.establishments, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── NEARBY ──────────────────────────────────────────────────

  nearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as NearbyEstablishmentsQuery;
      const results = await establishmentService.nearby(query);
      sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉTAIL ──────────────────────────────────────────────────

  getById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const establishment = await establishmentService.getById(req.params.id);
      sendSuccess(res, establishment);
    } catch (error) {
      next(error);
    }
  };

  // ─── CRÉATION ────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreateEstablishmentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const establishment = await establishmentService.create(req.body, req.user.userId, req.user.role);
      sendCreated(res, establishment, 'Établissement créé avec succès');
    } catch (error) {
      next(error);
    }
  };

  // ─── MISE À JOUR ──────────────────────────────────────────────

  update = async (
    req: Request<{ id: string }, {}, UpdateEstablishmentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await establishmentService.update(
        req.params.id,
        req.body,
        req.user.userId,
        req.user.role
      );
      sendSuccess(res, updated, { message: 'Établissement mis à jour avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── MÉDECINS DE MON ÉTABLISSEMENT ───────────────────────────

  listMyMedecins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const medecins = await establishmentService.listMyMedecins(req.user.userId);
      sendSuccess(res, medecins);
    } catch (error) {
      next(error);
    }
  };

  attachMedecin = async (
    req: Request<{}, {}, AttachMedecinInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const medecin = await establishmentService.attachMedecin(
        req.user.userId,
        req.body.phoneNumber
      );
      sendCreated(res, medecin, 'Médecin rattaché avec succès');
    } catch (error) {
      next(error);
    }
  };

  detachMedecin = async (
    req: Request<{ medecinId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await establishmentService.detachMedecin(req.user.userId, req.params.medecinId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉSACTIVATION ───────────────────────────────────────────

  remove = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await establishmentService.deactivate(req.params.id, req.user.userId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}

export const establishmentController = new EstablishmentController();
