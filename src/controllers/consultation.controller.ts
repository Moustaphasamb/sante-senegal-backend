import { Request, Response, NextFunction } from 'express';
import { consultationService } from '../services/consultation.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreateConsultationInput,
  UpdateConsultationInput,
  ListConsultationsQuery,
} from '../validators/consultation.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

class ConsultationController {
  // ─── CRÉER ────────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreateConsultationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const consultation = await consultationService.create(req.user.userId, req.body, ipAddress, userAgent);
      sendCreated(res, consultation, 'Consultation enregistrée dans le dossier médical');
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
      const consultation = await consultationService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, consultation);
    } catch (error) {
      next(error);
    }
  };

  // ─── MODIFIER ─────────────────────────────────────────────────

  update = async (
    req: Request<{ id: string }, {}, UpdateConsultationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const updated = await consultationService.update(req.params.id, req.user.userId, req.body, ipAddress, userAgent);
      sendSuccess(res, updated, { message: 'Consultation mise à jour' });
    } catch (error) {
      next(error);
    }
  };

  // ─── HISTORIQUE PATIENT ───────────────────────────────────────

  getPatientHistory = async (
    req: Request<{ patientId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListConsultationsQuery;
      const result = await consultationService.getPatientHistory(
        req.params.patientId,
        req.user.userId,
        req.user.role,
        query
      );
      sendSuccess(res, result.consultations, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };
}

export const consultationController = new ConsultationController();
