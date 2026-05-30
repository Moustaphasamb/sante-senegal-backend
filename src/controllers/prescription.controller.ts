import { Request, Response, NextFunction } from 'express';
import { prescriptionService } from '../services/prescription.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreatePrescriptionInput,
  ListPrescriptionsQuery,
} from '../validators/prescription.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

class PrescriptionController {
  // ─── CRÉER ────────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreatePrescriptionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const prescription = await prescriptionService.create(req.user.userId, req.body, ipAddress, userAgent);
      sendCreated(res, prescription, 'Ordonnance créée avec succès');
    } catch (error) {
      next(error);
    }
  };

  // ─── LISTE ────────────────────────────────────────────────────

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListPrescriptionsQuery;
      const result = await prescriptionService.list(req.user.userId, req.user.role, query);
      sendSuccess(res, result.prescriptions, { meta: result.meta });
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
      const prescription = await prescriptionService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, prescription);
    } catch (error) {
      next(error);
    }
  };

  // ─── VÉRIFIER PAR TOKEN QR (pharmacien) ───────────────────────

  verifyByToken = async (
    req: Request<{ token: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const prescription = await prescriptionService.verifyByToken(req.params.token);
      sendSuccess(res, prescription, { message: 'Ordonnance vérifiée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── PDF ──────────────────────────────────────────────────────

  getPdf = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const buffer = await prescriptionService.generatePdf(req.params.id, req.user.userId, req.user.role);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ordonnance-${req.params.id}.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // ─── QR CODE ──────────────────────────────────────────────────

  getQr = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const buffer = await prescriptionService.generateQr(req.params.id, req.user.userId, req.user.role);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="qr-${req.params.id}.png"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // ─── ANNULER ──────────────────────────────────────────────────

  cancel = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const updated = await prescriptionService.cancel(req.params.id, req.user.userId, ipAddress, userAgent);
      sendSuccess(res, updated, { message: 'Ordonnance annulée' });
    } catch (error) {
      next(error);
    }
  };
}

export const prescriptionController = new PrescriptionController();
