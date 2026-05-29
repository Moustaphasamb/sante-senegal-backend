import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate, authorize, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  listAppointmentsSchema,
  createAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from '../validators/appointment.validators';

const router = Router();

// ─── Routes communes (patient + médecin) ─────────────────────────
// ⚠️ /me/* toujours avant /:id

/**
 * GET /appointments/me
 * Lister mes rendez-vous (patient ou médecin)
 */
router.get(
  '/me',
  authenticate,
  validateQuery(listAppointmentsSchema),
  appointmentController.list
);

/**
 * GET /appointments/me/upcoming
 * Mes prochains rendez-vous confirmés
 */
router.get('/me/upcoming', authenticate, appointmentController.upcoming);

// ─── Routes patient ───────────────────────────────────────────────

/**
 * POST /appointments
 * Créer un rendez-vous (PATIENT uniquement)
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(createAppointmentSchema),
  appointmentController.create
);

/**
 * PATCH /appointments/:id/reschedule
 * Reprogrammer un rendez-vous (PATIENT)
 */
router.patch(
  '/:id/reschedule',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(rescheduleAppointmentSchema),
  appointmentController.reschedule
);

/**
 * POST /appointments/:id/check-in
 * Signaler son arrivée (PATIENT)
 */
router.post(
  '/:id/check-in',
  authenticate,
  authorize(UserRole.PATIENT),
  appointmentController.checkIn
);

// ─── Routes médecin ───────────────────────────────────────────────

/**
 * POST /appointments/:id/start
 * Démarrer la consultation (médecin)
 */
router.post(
  '/:id/start',
  authenticate,
  authorizeAnyMedecin,
  appointmentController.start
);

/**
 * POST /appointments/:id/end
 * Terminer la consultation (médecin)
 */
router.post(
  '/:id/end',
  authenticate,
  authorizeAnyMedecin,
  appointmentController.end
);

// ─── Routes communes (annulation) ────────────────────────────────

/**
 * PATCH /appointments/:id/cancel
 * Annuler un rendez-vous (patient = ANNULE_PATIENT, médecin = ANNULE_PRATICIEN)
 */
router.patch(
  '/:id/cancel',
  authenticate,
  validateBody(cancelAppointmentSchema),
  appointmentController.cancel
);

// ─── Détail (en dernier — catch-all sur :id) ─────────────────────

/**
 * GET /appointments/:id
 * Détail d'un rendez-vous (patient ou médecin impliqué)
 */
router.get('/:id', authenticate, appointmentController.getById);

export { router as appointmentRoutes };
