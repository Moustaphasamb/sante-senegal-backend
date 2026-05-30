import { Router } from 'express';
import { sosController } from '../controllers/sos.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { createSosAlertSchema, listSosAlertsSchema } from '../validators/sos.validators';

const router = Router();

/**
 * POST /sos/alert
 * Déclencher une alerte SOS (tout utilisateur authentifié)
 */
router.post('/alert', authenticate, validateBody(createSosAlertSchema), sosController.trigger);

/**
 * GET /sos/me
 * Mes alertes SOS
 */
router.get('/me', authenticate, validateQuery(listSosAlertsSchema), sosController.listMine);

/**
 * POST /sos/:id/resolve
 * Marquer une alerte comme résolue (propriétaire ou super-admin)
 */
router.post('/:id/resolve', authenticate, sosController.resolve);

export { router as sosRoutes };
