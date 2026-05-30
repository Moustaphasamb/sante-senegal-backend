import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  ListNotificationsQuery,
  UpdateNotificationSettingsInput,
} from '../validators/notification.validators';

class NotificationController {
  // ─── LISTE ────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListNotificationsQuery;
      const result = await notificationService.list(req.user.userId, query);
      sendSuccess(res, result.notifications, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── MARQUER LU ───────────────────────────────────────────────

  markRead = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const notification = await notificationService.markRead(req.params.id, req.user.userId);
      sendSuccess(res, notification, { message: 'Notification marquée comme lue' });
    } catch (error) {
      next(error);
    }
  };

  // ─── TOUT MARQUER LU ──────────────────────────────────────────

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await notificationService.markAllRead(req.user.userId);
      sendSuccess(res, result, { message: 'Toutes les notifications ont été marquées comme lues' });
    } catch (error) {
      next(error);
    }
  };

  // ─── PRÉFÉRENCES (lecture) ────────────────────────────────────

  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const settings = await notificationService.getOrCreateSettings(req.user.userId);
      sendSuccess(res, settings);
    } catch (error) {
      next(error);
    }
  };

  // ─── PRÉFÉRENCES (modification) ───────────────────────────────

  updateSettings = async (
    req: Request<{}, {}, UpdateNotificationSettingsInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const settings = await notificationService.updateSettings(req.user.userId, req.body);
      sendSuccess(res, settings, { message: 'Préférences mises à jour' });
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
