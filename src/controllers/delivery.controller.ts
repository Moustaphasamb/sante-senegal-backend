import { Request, Response, NextFunction } from 'express';
import { deliveryService } from '../services/delivery.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  AvailableDeliveriesQuery,
  DeliveredInput,
  FailedInput,
} from '../validators/delivery.validators';

class DeliveryController {
  // ─── DISPONIBLES (livreur) ────────────────────────────────────

  available = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as AvailableDeliveriesQuery;
      const deliveries = await deliveryService.available(req.user.userId, query);
      sendSuccess(res, deliveries);
    } catch (error) {
      next(error);
    }
  };

  // ─── MES COURSES (livreur) ────────────────────────────────────

  mine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const deliveries = await deliveryService.mine(req.user.userId);
      sendSuccess(res, deliveries);
    } catch (error) {
      next(error);
    }
  };

  // ─── ACCEPTER (livreur) ───────────────────────────────────────

  accept = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const delivery = await deliveryService.accept(req.params.id, req.user.userId);
      sendSuccess(res, delivery, { message: 'Livraison acceptée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── RÉCUPÉRÉE (livreur) ──────────────────────────────────────

  pickedUp = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const delivery = await deliveryService.pickedUp(req.params.id, req.user.userId);
      sendSuccess(res, delivery, { message: 'Colis récupéré' });
    } catch (error) {
      next(error);
    }
  };

  // ─── LIVRÉE (livreur) ─────────────────────────────────────────

  delivered = async (
    req: Request<{ id: string }, {}, DeliveredInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const delivery = await deliveryService.delivered(req.params.id, req.user.userId, req.body);
      sendSuccess(res, delivery, { message: 'Livraison effectuée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── ÉCHEC (livreur) ──────────────────────────────────────────

  failed = async (
    req: Request<{ id: string }, {}, FailedInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const delivery = await deliveryService.failed(req.params.id, req.user.userId, req.body);
      sendSuccess(res, delivery, { message: 'Livraison marquée en échec' });
    } catch (error) {
      next(error);
    }
  };

  // ─── TRACKING (patient ou livreur) ────────────────────────────

  getTracking = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const tracking = await deliveryService.getTracking(req.params.id, req.user.userId);
      sendSuccess(res, tracking);
    } catch (error) {
      next(error);
    }
  };
}

export const deliveryController = new DeliveryController();
