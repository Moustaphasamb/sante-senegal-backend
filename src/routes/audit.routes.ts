import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { auditController } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateQuery } from '../middleware/validate';
import { listAuditLogsSchema } from '../validators/audit.validators';

const router = Router();

// Toutes les routes d'audit sont réservées au SUPER_ADMIN
router.use(authenticate, authorize(UserRole.SUPER_ADMIN));

/**
 * GET /admin/audit-logs
 * Liste filtrée des logs (userId, action, resourceType, resourceId, from, to)
 */
router.get('/', validateQuery(listAuditLogsSchema), auditController.list);

/**
 * GET /admin/audit-logs/resource/:resourceType/:resourceId
 * Historique chronologique des actions sur une ressource précise
 */
router.get('/resource/:resourceType/:resourceId', auditController.resourceHistory);

export { router as auditRoutes };
