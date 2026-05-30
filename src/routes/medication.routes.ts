import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { validateQuery } from '../middleware/validate';
import {
  listMedicationsSchema,
  medicationAvailabilitySchema,
} from '../validators/medication.validators';

const router = Router();

/**
 * GET /medications
 * Catalogue national paginé + recherche (nom commercial / DCI)
 */
router.get('/', validateQuery(listMedicationsSchema), medicationController.list);

/**
 * GET /medications/search/availability?medicationId=X&lat=&lng=&radius=
 * Trouver les pharmacies disposant d'un médicament (avec géoloc optionnelle)
 * ⚠ Doit être déclaré AVANT /:id
 */
router.get(
  '/search/availability',
  validateQuery(medicationAvailabilitySchema),
  medicationController.availability
);

/**
 * GET /medications/:id
 * Détail d'un médicament
 */
router.get('/:id', medicationController.getById);

export { router as medicationRoutes };
