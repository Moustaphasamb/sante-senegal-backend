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
import { prescriptionRoutes } from './prescription.routes';
import { medicationRoutes } from './medication.routes';
import { pharmacyRoutes } from './pharmacy.routes';
import { pharmacyOrderRoutes } from './pharmacy-order.routes';
import { deliveryRoutes } from './delivery.routes';
import { paymentRoutes } from './payment.routes';
import { walletRoutes } from './wallet.routes';
import { notificationRoutes } from './notification.routes';
import { sosRoutes } from './sos.routes';
import { reviewRoutes } from './review.routes';
import { auditRoutes } from './audit.routes';
import { statsRoutes } from './stats.routes';
import { consultationController } from '../controllers/consultation.controller';
import { reviewController } from '../controllers/review.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { listConsultationsSchema } from '../validators/consultation.validators';
import { moderateReviewSchema } from '../validators/review.validators';
import { UserRole } from '@prisma/client';

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

// ─── Ordonnances numériques ─────────────────────────────────
router.use('/prescriptions', prescriptionRoutes);

// ─── Médicaments (catalogue) ────────────────────────────────
router.use('/medications', medicationRoutes);

// ─── Pharmacies ─────────────────────────────────────────────
router.use('/pharmacies', pharmacyRoutes);

// ─── Commandes pharmacie ────────────────────────────────────
router.use('/pharmacy-orders', pharmacyOrderRoutes);

// ─── Livraisons ─────────────────────────────────────────────
router.use('/deliveries', deliveryRoutes);

// ─── Paiements ──────────────────────────────────────────────
router.use('/payments', paymentRoutes);

// ─── Portefeuilles ──────────────────────────────────────────
router.use('/wallet', walletRoutes);

// ─── Notifications ──────────────────────────────────────────
router.use('/notifications', notificationRoutes);

// ─── Urgences (SOS) ─────────────────────────────────────────
router.use('/sos', sosRoutes);

// ─── Avis & Notation ────────────────────────────────────────
router.use('/reviews', reviewRoutes);

// ─── Audit & Conformité (super-admin) ───────────────────────
router.use('/admin/audit-logs', auditRoutes);

// ─── Statistiques & Dashboards ──────────────────────────────
router.use('/stats', statsRoutes);

// ─── Modération d'avis (admin) ──────────────────────────────
router.post(
  '/admin/reviews/:id/moderate',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  validateBody(moderateReviewSchema),
  reviewController.moderate
);

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
