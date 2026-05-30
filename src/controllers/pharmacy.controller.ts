import { Request, Response, NextFunction } from 'express';
import { pharmacyService } from '../services/pharmacy.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  ListPharmaciesQuery,
  NearbyPharmaciesQuery,
  PharmacyStockQuery,
  UpdateStockInput,
} from '../validators/pharmacy.validators';

class PharmacyController {
  // ─── LISTE ────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListPharmaciesQuery;
      const result = await pharmacyService.list(query);
      sendSuccess(res, result.pharmacies, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── GÉOLOC ───────────────────────────────────────────────────

  nearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as NearbyPharmaciesQuery;
      const pharmacies = await pharmacyService.nearby(query);
      sendSuccess(res, pharmacies);
    } catch (error) {
      next(error);
    }
  };

  // ─── DE GARDE ─────────────────────────────────────────────────

  onDuty = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pharmacies = await pharmacyService.onDuty();
      sendSuccess(res, pharmacies);
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
      const pharmacy = await pharmacyService.getById(req.params.id);
      sendSuccess(res, pharmacy);
    } catch (error) {
      next(error);
    }
  };

  // ─── STOCK D'UNE PHARMACIE ────────────────────────────────────

  getStock = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as unknown as PharmacyStockQuery;
      const result = await pharmacyService.getStock(req.params.id, query);
      sendSuccess(res, result.stocks, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── MISE À JOUR STOCK (pharmacien) ───────────────────────────

  updateStock = async (
    req: Request<{}, {}, UpdateStockInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await pharmacyService.updateStock(req.user.userId, req.body);
      sendSuccess(res, result, { message: 'Stock mis à jour avec succès' });
    } catch (error) {
      next(error);
    }
  };
}

export const pharmacyController = new PharmacyController();
