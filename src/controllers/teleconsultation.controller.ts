import { Request, Response, NextFunction } from 'express';
import { teleconsultationService } from '../services/teleconsultation.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreateTeleconsultationInput,
  RecordingConsentInput,
  SendMessageInput,
  ListTeleconsultationsQuery,
} from '../validators/teleconsultation.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

class TeleconsultationController {
  create = async (
    req: Request<{}, {}, CreateTeleconsultationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.create(req.user.userId, req.body.appointmentId);
      sendCreated(res, result, 'Téléconsultation prête');
    } catch (error) {
      next(error);
    }
  };

  listMine = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListTeleconsultationsQuery;
      const result = await teleconsultationService.listMine(req.user.userId, query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.getById(
        req.params.id,
        req.user.userId,
        req.user.role
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  join = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.join(
        req.params.id,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  start = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.start(
        req.params.id,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Téléconsultation démarrée' });
    } catch (error) {
      next(error);
    }
  };

  end = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.end(
        req.params.id,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Téléconsultation terminée' });
    } catch (error) {
      next(error);
    }
  };

  recordingConsent = async (
    req: Request<{ id: string }, {}, RecordingConsentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.setRecordingConsent(
        req.params.id,
        req.user.userId,
        req.body.consent
      );
      sendSuccess(res, result, { message: 'Consentement enregistré' });
    } catch (error) {
      next(error);
    }
  };

  startRecording = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.startRecording(
        req.params.id,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Enregistrement démarré' });
    } catch (error) {
      next(error);
    }
  };

  stopRecording = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await teleconsultationService.stopRecording(
        req.params.id,
        req.user.userId,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Enregistrement arrêté' });
    } catch (error) {
      next(error);
    }
  };

  listMessages = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.listMessages(req.params.id, req.user.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (
    req: Request<{ id: string }, {}, SendMessageInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await teleconsultationService.sendMessage(
        req.params.id,
        req.user.userId,
        req.body.content
      );
      sendCreated(res, result, 'Message envoyé');
    } catch (error) {
      next(error);
    }
  };
}

export const teleconsultationController = new TeleconsultationController();
