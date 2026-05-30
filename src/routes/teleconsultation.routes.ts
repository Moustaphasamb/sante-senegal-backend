import { Router } from 'express';
import { teleconsultationController } from '../controllers/teleconsultation.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createTeleconsultationSchema,
  recordingConsentSchema,
  sendMessageSchema,
  listTeleconsultationsSchema,
} from '../validators/teleconsultation.validators';
import { UserRole } from '@prisma/client';

const router = Router();

const MEDECIN_ROLES = [
  UserRole.MEDECIN_SALARIE,
  UserRole.MEDECIN_LIBERAL_MOBILE,
  UserRole.SPECIALISTE_CABINET,
] as const;

// Création / liste / détail
router.post('/', authenticate, validateBody(createTeleconsultationSchema), teleconsultationController.create);
router.get('/me', authenticate, validateQuery(listTeleconsultationsSchema), teleconsultationController.listMine);
router.get('/:id', authenticate, teleconsultationController.getById);

// Session
router.post('/:id/join', authenticate, teleconsultationController.join);
router.post('/:id/start', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.start);
router.post('/:id/end', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.end);

// Enregistrement
router.patch(
  '/:id/recording-consent',
  authenticate,
  authorize(UserRole.PATIENT),
  validateBody(recordingConsentSchema),
  teleconsultationController.recordingConsent
);
router.post('/:id/recording/start', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.startRecording);
router.post('/:id/recording/stop', authenticate, authorize(...MEDECIN_ROLES), teleconsultationController.stopRecording);

// Chat
router.get('/:id/messages', authenticate, teleconsultationController.listMessages);
router.post('/:id/messages', authenticate, validateBody(sendMessageSchema), teleconsultationController.sendMessage);

export { router as teleconsultationRoutes };
