import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  listNotificationsSchema,
  updateNotificationSettingsSchema,
} from '../validators/notification.validators';

const router = Router();

/**
 * GET /notifications/me
 * Mes notifications (paginées, filtre unreadOnly/type) + unreadCount
 */
router.get('/me', authenticate, validateQuery(listNotificationsSchema), notificationController.list);

/**
 * GET /notifications/me/settings
 * Mes préférences de notification
 */
router.get('/me/settings', authenticate, notificationController.getSettings);

/**
 * PATCH /notifications/me/settings
 * Modifier mes préférences
 */
router.patch(
  '/me/settings',
  authenticate,
  validateBody(updateNotificationSettingsSchema),
  notificationController.updateSettings
);

/**
 * PATCH /notifications/me/read-all
 * Tout marquer comme lu
 */
router.patch('/me/read-all', authenticate, notificationController.markAllRead);

/**
 * PATCH /notifications/me/:id/read
 * Marquer une notification comme lue
 */
router.patch('/me/:id/read', authenticate, notificationController.markRead);

export { router as notificationRoutes };
