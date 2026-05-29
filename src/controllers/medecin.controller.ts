import { Request, Response, NextFunction } from 'express';
import { medecinService } from '../services/medecin.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import type {
  ListMedecinsQuery,
  NearbyMedecinsQuery,
  UpdateMedecinProfileInput,
  UploadDocumentInput,
  UpdateLocationInput,
  SetScheduleInput,
  RejectKycInput,
} from '../validators/medecin.validators';

class MedecinController {
  // ─── LISTE ───────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListMedecinsQuery;
      const result = await medecinService.list(query);
      sendSuccess(res, result.medecins, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── NEARBY ──────────────────────────────────────────────────

  nearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as NearbyMedecinsQuery;
      const results = await medecinService.nearby(query);
      sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  };

  // ─── PROFIL PUBLIC ────────────────────────────────────────────

  getPublicProfile = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const medecin = await medecinService.getPublicProfile(req.params.id);
      sendSuccess(res, medecin);
    } catch (error) {
      next(error);
    }
  };

  // ─── MON PROFIL ───────────────────────────────────────────────

  getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const medecin = await medecinService.getMyProfile(req.user.userId);
      sendSuccess(res, medecin);
    } catch (error) {
      next(error);
    }
  };

  // ─── MISE À JOUR PROFIL ───────────────────────────────────────

  updateProfile = async (
    req: Request<{}, {}, UpdateMedecinProfileInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await medecinService.updateProfile(req.user.userId, req.body);
      sendSuccess(res, updated, { message: 'Profil médecin mis à jour avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── UPLOAD DOCUMENT KYC ─────────────────────────────────────

  uploadDocument = async (
    req: Request<{}, {}, UploadDocumentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      if (!req.file) {
        throw new BadRequestError('Aucun fichier envoyé. Champ requis : "document"');
      }

      const { documentType } = req.body;
      const url = await medecinService.uploadDocument(
        req.user.userId,
        req.file.buffer,
        req.file.mimetype,
        documentType
      );

      sendSuccess(res, { documentType, url }, { message: 'Document uploadé avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── TOGGLE DISPONIBILITÉ MOBILE ─────────────────────────────

  toggleMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const isMobileAvailable = await medecinService.toggleMobileAvailability(req.user.userId);
      const message = isMobileAvailable
        ? 'Mode libéral mobile activé — vous êtes maintenant visible'
        : 'Mode libéral mobile désactivé';
      sendSuccess(res, { isMobileAvailable }, { message });
    } catch (error) {
      next(error);
    }
  };

  // ─── MISE À JOUR POSITION GPS ─────────────────────────────────

  updateLocation = async (
    req: Request<{}, {}, UpdateLocationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await medecinService.updateLocation(req.user.userId, req.body);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── PLANNING — LECTURE ───────────────────────────────────────

  getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const schedule = await medecinService.getSchedule(req.user.userId);
      sendSuccess(res, schedule);
    } catch (error) {
      next(error);
    }
  };

  // ─── PLANNING — ÉCRITURE ──────────────────────────────────────

  setSchedule = async (
    req: Request<{}, {}, SetScheduleInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const schedule = await medecinService.setSchedule(req.user.userId, req.body);
      sendSuccess(res, schedule, { message: 'Planning mis à jour avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── APPROVE KYC ─────────────────────────────────────────────

  approveKyc = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await medecinService.approveKyc(req.params.id, req.user.userId);
      sendSuccess(res, null, { message: 'KYC approuvé — médecin validé avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── REJECT KYC ──────────────────────────────────────────────

  rejectKyc = async (
    req: Request<{ id: string }, {}, RejectKycInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await medecinService.rejectKyc(req.params.id, req.user.userId, req.body);
      sendSuccess(res, null, { message: 'KYC rejeté — médecin notifié' });
    } catch (error) {
      next(error);
    }
  };
}

export const medecinController = new MedecinController();
