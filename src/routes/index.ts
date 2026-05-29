import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { establishmentRoutes } from './establishment.routes';

const router = Router();

// ─── Health check ──────────────────────────────────────
router.use('/health', healthRoutes);

// ─── Auth ──────────────────────────────────────────────
router.use('/auth', authRoutes);

// ─── Utilisateurs & Profils ────────────────────────────
router.use('/users', userRoutes);

// ─── Établissements de santé ───────────────────────────
router.use('/establishments', establishmentRoutes);

// ─── Modules futurs (à ajouter au fur et à mesure) ─────
// router.use('/patients', patientRoutes);
// router.use('/medecins', medecinRoutes);
// router.use('/appointments', appointmentRoutes);
// router.use('/home-visits', homeVisitRoutes);
// router.use('/prescriptions', prescriptionRoutes);
// router.use('/pharmacies', pharmacyRoutes);
// router.use('/medications', medicationRoutes);
// router.use('/deliveries', deliveryRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/notifications', notificationRoutes);

export { router as apiRoutes };
