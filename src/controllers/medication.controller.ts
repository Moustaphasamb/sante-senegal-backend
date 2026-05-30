import { Request, Response, NextFunction } from 'express';
import { medicationService } from '../services/medication.service';
import { sendSuccess } from '../utils/response';
import type {
  ListMedicationsQuery,
  MedicationAvailabilityQuery,
} from '../validators/medication.validators';

class MedicationController {
  // ─── CATALOGUE ────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListMedicationsQuery;
      const result = await medicationService.list(query);
      sendSuccess(res, result.medications, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── DISPONIBILITÉ EN PHARMACIE ───────────────────────────────

  availability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as MedicationAvailabilityQuery;
      const result = await medicationService.availability(query);
      sendSuccess(res, result);
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
      const medication = await medicationService.getById(req.params.id);
      sendSuccess(res, medication);
    } catch (error) {
      next(error);
    }
  };
}

export const medicationController = new MedicationController();
