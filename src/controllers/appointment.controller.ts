import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { appointmentService } from '../services/appointment.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  ListAppointmentsQuery,
  CreateAppointmentInput,
  CancelAppointmentInput,
  RescheduleAppointmentInput,
  GetAvailabilityQuery,
} from '../validators/appointment.validators';

function getCtx(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Rôles médecin autorisés à accéder aux endpoints "médecin"
const MEDECIN_ROLES: UserRole[] = [
  UserRole.MEDECIN_SALARIE,
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.SPECIALISTE_CABINET,
  UserRole.INFIRMIER_DOMICILE,
];

class AppointmentController {
  // ─── LISTE MES RDV ────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListAppointmentsQuery;
      const result = await appointmentService.list(req.user.userId, req.user.role, query);
      sendSuccess(res, result.appointments, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── RDV À VENIR ──────────────────────────────────────────────

  upcoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const appointments = await appointmentService.getUpcoming(req.user.userId, req.user.role);
      sendSuccess(res, appointments);
    } catch (error) {
      next(error);
    }
  };

  // ─── CRÉER RDV ────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreateAppointmentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await appointmentService.create(req.user.userId, req.body, ipAddress, userAgent);
      sendCreated(res, result, 'Rendez-vous créé avec succès');
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉTAIL RDV ───────────────────────────────────────────────

  getById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const appointment = await appointmentService.getById(
        req.params.id,
        req.user.userId,
        req.user.role
      );
      sendSuccess(res, appointment);
    } catch (error) {
      next(error);
    }
  };

  // ─── ANNULER ──────────────────────────────────────────────────

  cancel = async (
    req: Request<{ id: string }, {}, CancelAppointmentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const result = await appointmentService.cancel(
        req.params.id,
        req.user.userId,
        req.user.role,
        req.body,
        ipAddress,
        userAgent
      );
      sendSuccess(res, result, { message: 'Rendez-vous annulé' });
    } catch (error) {
      next(error);
    }
  };

  // ─── REPROGRAMMER ─────────────────────────────────────────────

  reschedule = async (
    req: Request<{ id: string }, {}, RescheduleAppointmentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { ipAddress, userAgent } = getCtx(req);
      const updated = await appointmentService.reschedule(
        req.params.id,
        req.user.userId,
        req.body,
        ipAddress,
        userAgent
      );
      sendSuccess(res, updated, { message: 'Rendez-vous reprogrammé' });
    } catch (error) {
      next(error);
    }
  };

  // ─── CHECK-IN ─────────────────────────────────────────────────

  checkIn = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await appointmentService.checkIn(req.params.id, req.user.userId);
      sendSuccess(res, updated, { message: 'Check-in enregistré' });
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉMARRER CONSULTATION ────────────────────────────────────

  start = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await appointmentService.startConsultation(req.params.id, req.user.userId);
      sendSuccess(res, updated, { message: 'Consultation démarrée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── TERMINER CONSULTATION ────────────────────────────────────

  end = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await appointmentService.endConsultation(req.params.id, req.user.userId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── DISPONIBILITÉS (monté sur /medecins/:id/availability) ────

  availability = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as unknown as GetAvailabilityQuery;
      const result = await appointmentService.getAvailability(req.params.id, query.date);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

export const appointmentController = new AppointmentController();
