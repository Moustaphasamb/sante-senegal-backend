import { Request, Response, NextFunction } from 'express';
import { pharmacyOrderService } from '../services/pharmacy-order.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreatePharmacyOrderInput,
  ListPharmacyOrdersQuery,
  OrderReasonInput,
} from '../validators/pharmacy-order.validators';

class PharmacyOrderController {
  // ─── CRÉER ────────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreatePharmacyOrderInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const order = await pharmacyOrderService.create(req.user.userId, req.body);
      sendCreated(res, order, 'Commande créée avec succès');
    } catch (error) {
      next(error);
    }
  };

  // ─── LISTE ────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListPharmacyOrdersQuery;
      const result = await pharmacyOrderService.list(req.user.userId, req.user.role, query);
      sendSuccess(res, result.orders, { meta: result.meta });
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
      const order = await pharmacyOrderService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, order);
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
      const order = await pharmacyOrderService.accept(req.params.id, req.user.userId);
      sendSuccess(res, order, { message: 'Commande acceptée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── REFUSER ──────────────────────────────────────────────────

  refuse = async (
    req: Request<{ id: string }, {}, OrderReasonInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const order = await pharmacyOrderService.refuse(req.params.id, req.user.userId, req.body.reason);
      sendSuccess(res, order, { message: 'Commande refusée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── PRÊTE ────────────────────────────────────────────────────

  ready = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const order = await pharmacyOrderService.ready(req.params.id, req.user.userId);
      sendSuccess(res, order, { message: 'Commande prête pour retrait/livraison' });
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
      const order = await pharmacyOrderService.complete(req.params.id, req.user.userId);
      sendSuccess(res, order, { message: 'Commande terminée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── ANNULER ──────────────────────────────────────────────────

  cancel = async (
    req: Request<{ id: string }, {}, OrderReasonInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const order = await pharmacyOrderService.cancel(
        req.params.id,
        req.user.userId,
        req.user.role,
        req.body.reason
      );
      sendSuccess(res, order, { message: 'Commande annulée' });
    } catch (error) {
      next(error);
    }
  };
}

export const pharmacyOrderController = new PharmacyOrderController();
