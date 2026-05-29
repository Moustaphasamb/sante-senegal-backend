import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { establishmentRoutes } from './establishment.routes';
import { medecinRoutes } from './medecin.routes';
import { medicalRecordRoutes } from './medical-record.routes';
import { appointmentRoutes } from './appointment.routes';
import { homeVisitRoutes } from './home-visit.routes';
import { consultationRoutes } from './consultation.routes';
import { consultationController } from '../controllers/consultation.controller';
import { authenticate } from '../middleware/authenticate';
import { validateQuery } from '../middleware/validate';
import { listConsultationsSchema } from '../validators/consultation.validators';

const router = Router();

// ─── Health check ──────────────────────────────────────
router.use('/health', healthRoutes);

// ─── Auth ──────────────────────────────────────────────
router.use('/auth', authRoutes);

// ─── Utilisateurs & Profils ────────────────────────────
router.use('/users', userRoutes);

// ─── Établissements de santé ───────────────────────────
router.use('/establishments', establishmentRoutes);

// ─── Médecins ──────────────────────────────────────────────
router.use('/medecins', medecinRoutes);

// ─── Dossier Médical Électronique (DME) ────────────────────
router.use('/medical-records', medicalRecordRoutes);

// ─── Rendez-vous ────────────────────────────────────────────
router.use('/appointments', appointmentRoutes);

// ─── Visites à domicile (médecin libéral mobile) ────────────
router.use('/home-visits', homeVisitRoutes);

// ─── Consultations ──────────────────────────────────────────
router.use('/consultations', consultationRoutes);

// ─── Historique consultations d'un patient ──────────────────
router.get(
  '/patients/:patientId/consultations',
  authenticate,
  validateQuery(listConsultationsSchema),
  consultationController.getPatientHistory
);

// ─── Modules futurs (à ajouter au fur et à mesure) ─────
// router.use('/patients', patientRoutes);
// router.use('/appointments', appointmentRoutes);
// router.use('/home-visits', homeVisitRoutes);
// router.use('/prescriptions', prescriptionRoutes);
// router.use('/pharmacies', pharmacyRoutes);
// router.use('/medications', medicationRoutes);
// router.use('/deliveries', deliveryRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/notifications', notificationRoutes);

export { router as apiRoutes };
