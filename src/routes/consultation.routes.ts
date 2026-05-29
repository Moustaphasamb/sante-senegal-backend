import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { consultationController } from '../controllers/consultation.controller';
import { authenticate, authorize, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createConsultationSchema,
  updateConsultationSchema,
  listConsultationsSchema,
} from '../validators/consultation.validators';

const router = Router();

/**
 * POST /consultations
 * Saisir une consultation (médecin, après un RDV ou une visite)
 * Body : { appointmentId | homeVisitId, diagnosis, motif, ... }
 */
router.post(
  '/',
  authenticate,
  authorizeAnyMedecin,
  validateBody(createConsultationSchema),
  consultationController.create
);

/**
 * PATCH /consultations/:id
 * Modifier une consultation (médecin auteur, dans les 24h)
 */
router.patch(
  '/:id',
  authenticate,
  authorizeAnyMedecin,
  validateBody(updateConsultationSchema),
  consultationController.update
);

/**
 * GET /consultations/:id
 * Détail d'une consultation (patient concerné ou médecin avec token DME)
 */
router.get('/:id', authenticate, consultationController.getById);

export { router as consultationRoutes };
