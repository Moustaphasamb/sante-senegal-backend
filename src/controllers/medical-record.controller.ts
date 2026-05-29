import { Request, Response, NextFunction } from 'express';
import { medicalRecordService } from '../services/medical-record.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import type {
  UpdateMedicalRecordInput,
  AddAllergyInput,
  AddChronicConditionInput,
  UploadMedicalDocInput,
  CreateShareTokenInput,
} from '../validators/medical-record.validators';

// Extraire IP et User-Agent depuis la requête
function getRequestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

class MedicalRecordController {
  // ─── MON DME ──────────────────────────────────────────────────

  getMyDme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const dme = await medicalRecordService.getMyDme(req.user.userId, ipAddress, userAgent);
      sendSuccess(res, dme);
    } catch (error) {
      next(error);
    }
  };

  // ─── DME D'UN PATIENT (médecin) ───────────────────────────────

  getDmeByPatient = async (
    req: Request<{ patientId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const dme = await medicalRecordService.getDmeByPatient(
        req.params.patientId,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, dme);
    } catch (error) {
      next(error);
    }
  };

  // ─── MISE À JOUR DME ──────────────────────────────────────────

  updateMyDme = async (
    req: Request<{}, {}, UpdateMedicalRecordInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const updated = await medicalRecordService.updateMyDme(
        req.user.userId,
        req.body,
        ipAddress,
        userAgent
      );
      sendSuccess(res, updated, { message: 'Dossier médical mis à jour' });
    } catch (error) {
      next(error);
    }
  };

  // ─── ALLERGIE ─────────────────────────────────────────────────

  addAllergy = async (
    req: Request<{}, {}, AddAllergyInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const allergy = await medicalRecordService.addAllergy(
        req.user.userId,
        req.body,
        ipAddress,
        userAgent
      );
      sendCreated(res, allergy, 'Allergie ajoutée au dossier médical');
    } catch (error) {
      next(error);
    }
  };

  // ─── MALADIE CHRONIQUE ────────────────────────────────────────

  addChronicCondition = async (
    req: Request<{}, {}, AddChronicConditionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const condition = await medicalRecordService.addChronicCondition(
        req.user.userId,
        req.body,
        ipAddress,
        userAgent
      );
      sendCreated(res, condition, 'Maladie chronique ajoutée au dossier médical');
    } catch (error) {
      next(error);
    }
  };

  // ─── UPLOAD DOCUMENT MÉDICAL ──────────────────────────────────

  uploadDocument = async (
    req: Request<{}, {}, UploadMedicalDocInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      if (!req.file) {
        throw new BadRequestError('Aucun fichier envoyé. Champ requis : "document"');
      }
      const { ipAddress, userAgent } = getRequestContext(req);
      const document = await medicalRecordService.uploadMedicalDocument(
        req.user.userId,
        req.file.buffer,
        req.file.mimetype,
        req.file.size,
        req.body,
        ipAddress,
        userAgent
      );
      sendCreated(res, document, 'Document médical ajouté au dossier');
    } catch (error) {
      next(error);
    }
  };

  // ─── TOKEN DE PARTAGE ─────────────────────────────────────────

  createShareToken = async (
    req: Request<{}, {}, CreateShareTokenInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const shareToken = await medicalRecordService.createShareToken(
        req.user.userId,
        req.body,
        ipAddress,
        userAgent
      );
      sendCreated(res, shareToken, 'Token de partage généré');
    } catch (error) {
      next(error);
    }
  };

  // ─── ACCÈS VIA TOKEN QR ───────────────────────────────────────

  accessByToken = async (
    req: Request<{ token: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      const result = await medicalRecordService.accessByToken(
        req.params.token,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ─── RÉVOQUER TOKEN ───────────────────────────────────────────

  revokeShareToken = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getRequestContext(req);
      await medicalRecordService.revokeShareToken(
        req.user.userId,
        req.params.id,
        ipAddress,
        userAgent
      );
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}

export const medicalRecordController = new MedicalRecordController();
