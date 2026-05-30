import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { UserRole, PrescriptionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';
import type {
  CreatePrescriptionInput,
  ListPrescriptionsQuery,
} from '../validators/prescription.validators';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function generatePrescriptionNumber(): string {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${year}-${hex}`;
}

async function getMedecinProfile(userId: string) {
  const m = await prisma.medecinProfile.findUnique({
    where: { userId },
    select: { id: true, licenseNumber: true, specialties: true },
  });
  if (!m) throw new NotFoundError('Profil médecin');
  return m;
}

async function getPatientProfile(userId: string) {
  const p = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!p) throw new NotFoundError('Profil patient');
  return p;
}

/** Vérifie que l'utilisateur a accès à cette ordonnance */
async function checkAccess(
  prescription: { patientId: string; medecinId: string },
  userId: string,
  userRole: UserRole
) {
  if (userRole === UserRole.PATIENT) {
    const p = await getPatientProfile(userId);
    if (prescription.patientId !== p.id) throw new ForbiddenError("Cette ordonnance ne vous appartient pas");
    return;
  }
  if (userRole === UserRole.PHARMACIEN) return; // pharmaciens peuvent vérifier QR/détail
  // Médecin ou admin
  const m = await prisma.medecinProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!m || prescription.medecinId !== m.id) {
    if (userRole !== UserRole.SUPER_ADMIN) throw new ForbiddenError("Cette ordonnance ne vous appartient pas");
  }
}

// ═══════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════

class PrescriptionService {
  // ─── CRÉER ────────────────────────────────────────────────────

  async create(
    medecinUserId: string,
    data: CreatePrescriptionInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const medecinProfile = await getMedecinProfile(medecinUserId);

    // Récupérer le patient + sa info user (prénom, nom pour le PDF)
    const patient = await prisma.user.findUnique({
      where: { id: data.patientUserId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        patientProfile: { select: { id: true } },
      },
    });
    if (!patient?.patientProfile) throw new NotFoundError('Patient');

    // Vérifier la consultation si fournie
    if (data.consultationId) {
      const consult = await prisma.consultation.findUnique({
        where: { id: data.consultationId },
        select: { medecinId: true, prescriptionId: true },
      });
      if (!consult) throw new NotFoundError('Consultation');
      if (consult.medecinId !== medecinProfile.id) throw new ForbiddenError("Cette consultation ne vous appartient pas");
      if (consult.prescriptionId) throw new BadRequestError('Une ordonnance existe déjà pour cette consultation');
    }

    const prescriptionNumber = generatePrescriptionNumber();
    const qrToken = crypto.randomUUID();
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt.getTime() + data.validityDays * 24 * 60 * 60 * 1000);

    // Signature électronique = SHA256(licenseNumber | prescriptionNumber | issuedAt ISO)
    const signatureHash = crypto
      .createHash('sha256')
      .update(`${medecinProfile.licenseNumber}|${prescriptionNumber}|${issuedAt.toISOString()}`)
      .digest('hex');

    const prescription = await prisma.prescription.create({
      data: {
        patientId: patient.patientProfile.id,
        medecinId: medecinProfile.id,
        consultationId: data.consultationId,
        prescriptionNumber,
        qrCode: qrToken,
        signatureHash,
        issuedAt,
        validUntil,
        isRenewable: data.isRenewable ?? false,
        renewalsRemaining: data.renewalsRemaining ?? 0,
        generalInstructions: data.generalInstructions,
        status: PrescriptionStatus.ACTIVE,
        items: {
          create: data.items.map((item) => ({
            medicationId: item.medicationId,
            medicationName: item.medicationName,
            dci: item.dci,
            dosage: item.dosage,
            form: item.form,
            quantity: item.quantity,
            posology: item.posology,
            duration: item.duration,
            instructions: item.instructions,
            allowGeneric: item.allowGeneric ?? true,
          })),
        },
      },
      include: {
        items: true,
        medecin: { select: { licenseNumber: true, user: { select: { firstName: true, lastName: true } } } },
        patient: { select: { user: { select: { firstName: true, lastName: true, dateOfBirth: true } } } },
      },
    });

    void createAuditLog({
      userId: medecinUserId,
      action: 'CREATE_PRESCRIPTION',
      resourceType: 'PRESCRIPTION',
      resourceId: prescription.id,
      metadata: { prescriptionNumber, patientUserId: data.patientUserId, itemCount: data.items.length },
      ipAddress,
      userAgent,
    });

    logger.info('Ordonnance créée', { prescriptionId: prescription.id, prescriptionNumber, medecinUserId });
    return prescription;
  }

  // ─── LISTE ────────────────────────────────────────────────────

  async list(userId: string, userRole: UserRole, query: ListPrescriptionsQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    let where: Record<string, unknown>;
    if (userRole === UserRole.PATIENT) {
      const p = await getPatientProfile(userId);
      where = { patientId: p.id };
    } else {
      const m = await getMedecinProfile(userId);
      where = { medecinId: m.id };
    }

    const [prescriptions, total] = await prisma.$transaction([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          items: { select: { medicationName: true, dosage: true, quantity: true } },
          medecin: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.prescription.count({ where }),
    ]);

    return { prescriptions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── DÉTAIL ───────────────────────────────────────────────────

  async getById(id: string, userId: string, userRole: UserRole) {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        items: true,
        medecin: {
          select: {
            licenseNumber: true,
            specialties: true,
            user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
            establishment: { select: { name: true, address: true, city: true } },
          },
        },
        patient: { select: { user: { select: { firstName: true, lastName: true, dateOfBirth: true } } } },
      },
    });
    if (!prescription) throw new NotFoundError('Ordonnance');
    await checkAccess(prescription, userId, userRole);
    return prescription;
  }

  // ─── GÉNÉRER PDF ──────────────────────────────────────────────

  async generatePdf(id: string, userId: string, userRole: UserRole): Promise<Buffer> {
    const prescription = await this.getById(id, userId, userRole);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const medecin = prescription.medecin;
      const patient = prescription.patient;
      const etab = medecin.establishment;

      // ─── En-tête
      doc.fontSize(18).font('Helvetica-Bold').text('ORDONNANCE MÉDICALE', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`N° ${prescription.prescriptionNumber}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // ─── Médecin
      doc.fontSize(12).font('Helvetica-Bold').text('PRESCRIPTEUR');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Dr ${medecin.user.firstName} ${medecin.user.lastName}`);
      doc.text(`N° Ordre : ${medecin.licenseNumber}`);
      if (etab) doc.text(`${etab.name} — ${etab.address}, ${etab.city}`);
      doc.moveDown(0.5);

      // ─── Patient
      doc.fontSize(12).font('Helvetica-Bold').text('PATIENT');
      doc.fontSize(10).font('Helvetica');
      doc.text(`${patient.user.firstName} ${patient.user.lastName}`);
      if (patient.user.dateOfBirth) {
        const dob = new Date(patient.user.dateOfBirth);
        doc.text(`Date de naissance : ${dob.toLocaleDateString('fr-FR')}`);
      }
      doc.moveDown(0.5);

      // ─── Dates
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date d'émission : ${new Date(prescription.issuedAt).toLocaleDateString('fr-FR')}`);
      doc.text(`Valide jusqu'au : ${new Date(prescription.validUntil).toLocaleDateString('fr-FR')}`);
      if (prescription.isRenewable) doc.text(`Renouvellements restants : ${prescription.renewalsRemaining}`);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // ─── Médicaments
      doc.fontSize(12).font('Helvetica-Bold').text('MÉDICAMENTS PRESCRITS');
      doc.moveDown(0.3);

      prescription.items.forEach((item, idx) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${item.medicationName} ${item.dosage}`);
        doc.fontSize(10).font('Helvetica');
        if (item.form) doc.text(`   Forme : ${item.form}`);
        doc.text(`   Posologie : ${item.posology}`);
        doc.text(`   Durée : ${item.duration} — Quantité : ${item.quantity} boîte(s)`);
        if (item.dci) doc.text(`   DCI : ${item.dci}`);
        if (!item.allowGeneric) doc.font('Helvetica-Bold').text('   ⚠ Non substituable');
        if (item.instructions) doc.font('Helvetica').text(`   Instructions : ${item.instructions}`);
        doc.moveDown(0.3);
      });

      if (prescription.generalInstructions) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').text('Instructions générales :');
        doc.fontSize(10).font('Helvetica').text(prescription.generalInstructions);
      }

      // ─── Signature
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text(`Signature électronique : ${prescription.signatureHash.substring(0, 32)}...`, { align: 'center' });
      doc.text(`Vérifiez l'authenticité via QR code — Santé Sénégal`, { align: 'center' });

      doc.end();
    });
  }

  // ─── GÉNÉRER QR CODE ──────────────────────────────────────────

  async generateQr(id: string, userId: string, userRole: UserRole): Promise<Buffer> {
    const prescription = await this.getById(id, userId, userRole);

    // Le QR code encode le token unique de vérification
    const verifyData = JSON.stringify({
      id: prescription.id,
      number: prescription.prescriptionNumber,
      token: prescription.qrCode,
    });

    const qrBuffer = await QRCode.toBuffer(verifyData, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return qrBuffer;
  }

  // ─── ANNULER ──────────────────────────────────────────────────

  async cancel(id: string, medecinUserId: string, ipAddress?: string, userAgent?: string) {
    const medecinProfile = await getMedecinProfile(medecinUserId);
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      select: { id: true, medecinId: true, status: true, prescriptionNumber: true },
    });
    if (!prescription) throw new NotFoundError('Ordonnance');
    if (prescription.medecinId !== medecinProfile.id) throw new ForbiddenError("Cette ordonnance ne vous appartient pas");
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new BadRequestError(`Impossible d'annuler une ordonnance avec le statut "${prescription.status}"`);
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: { status: PrescriptionStatus.ANNULEE },
    });

    void createAuditLog({
      userId: medecinUserId,
      action: 'CANCEL_PRESCRIPTION',
      resourceType: 'PRESCRIPTION',
      resourceId: id,
      metadata: { prescriptionNumber: prescription.prescriptionNumber },
      ipAddress,
      userAgent,
    });

    logger.info('Ordonnance annulée', { prescriptionId: id, medecinUserId });
    return updated;
  }
}

export const prescriptionService = new PrescriptionService();
