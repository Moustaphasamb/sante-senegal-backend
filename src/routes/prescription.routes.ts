import { Router } from 'express';
import { prescriptionController } from '../controllers/prescription.controller';
import { authenticate, authorizeAnyMedecin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createPrescriptionSchema,
  listPrescriptionsSchema,
} from '../validators/prescription.validators';

const router = Router();

/**
 * POST /prescriptions
 * Créer une ordonnance numérique (médecin uniquement)
 */
router.post(
  '/',
  authenticate,
  authorizeAnyMedecin,
  validateBody(createPrescriptionSchema),
  prescriptionController.create
);

/**
 * GET /prescriptions/me
 * Lister mes ordonnances (patient = reçues, médecin = émises)
 */
router.get(
  '/me',
  authenticate,
  validateQuery(listPrescriptionsSchema),
  prescriptionController.list
);

/**
 * GET /prescriptions/:id
 * Détail d'une ordonnance (patient concerné, médecin auteur, pharmacien, admin)
 */
router.get('/:id', authenticate, prescriptionController.getById);

/**
 * GET /prescriptions/:id/pdf
 * Télécharger le PDF de l'ordonnance
 */
router.get('/:id/pdf', authenticate, prescriptionController.getPdf);

/**
 * GET /prescriptions/:id/qr
 * Obtenir le QR code de vérification (PNG)
 */
router.get('/:id/qr', authenticate, prescriptionController.getQr);

/**
 * POST /prescriptions/:id/cancel
 * Annuler une ordonnance (médecin auteur, statut ACTIVE uniquement)
 */
router.post(
  '/:id/cancel',
  authenticate,
  authorizeAnyMedecin,
  prescriptionController.cancel
);

export { router as prescriptionRoutes };
