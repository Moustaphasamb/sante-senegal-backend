import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createReviewSchema,
  respondReviewSchema,
  listReviewsSchema,
} from '../validators/review.validators';

const router = Router();

/**
 * POST /reviews
 * Publier un avis (utilisateur authentifié)
 */
router.post('/', authenticate, validateBody(createReviewSchema), reviewController.create);

/**
 * GET /reviews/me/received
 * Mes avis reçus (professionnel)
 * ⚠ AVANT /target/:userId n'est pas nécessaire (chemins distincts) mais on reste explicite
 */
router.get('/me/received', authenticate, validateQuery(listReviewsSchema), reviewController.myReceived);

/**
 * GET /reviews/target/:userId
 * Avis publics (approuvés) sur un utilisateur
 */
router.get('/target/:userId', validateQuery(listReviewsSchema), reviewController.listForTarget);

/**
 * POST /reviews/:id/respond
 * Répondre à un avis (la cible de l'avis)
 */
router.post('/:id/respond', authenticate, validateBody(respondReviewSchema), reviewController.respond);

export { router as reviewRoutes };
