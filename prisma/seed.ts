import { PrismaClient, UserRole, Gender, BloodGroup, EstablishmentType, MedicalSpecialty, Language } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed initial pour Santé Sénégal
 * Crée des données de base pour tester l'application :
 * - 1 super admin
 * - Établissements (hôpitaux, cliniques, postes de santé)
 * - 3 patients
 * - 3 médecins (1 salarié, 1 libéral mobile, 1 spécialiste)
 * - 1 pharmacie + 1 pharmacien
 * - Médicaments du catalogue national
 */

async function main() {
  console.log('🌱 Démarrage du seed...');

  // ═══════════════════════════════════════════════════════════════
  // 1. SUPER ADMIN
  // ═══════════════════════════════════════════════════════════════
  console.log('👤 Création du super admin...');
  const adminPasswordHash = await bcrypt.hash('Admin2026!', 12);

  const superAdmin = await prisma.user.upsert({
    where: { phoneNumber: '+221770000001' },
    update: {},
    create: {
      phoneNumber: '+221770000001',
      email: 'admin@sante-senegal.sn',
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      firstName: 'Admin',
      lastName: 'Sénégal',
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      isEmailVerified: true,
      kycStatus: 'APPROVED',
      adminProfile: {
        create: {
          isSuperAdmin: true,
          permissions: ['*'],
        },
      },
    },
  });
  console.log(`   ✅ Super admin créé : ${superAdmin.phoneNumber}`);

  // ═══════════════════════════════════════════════════════════════
  // 2. ÉTABLISSEMENTS DE SANTÉ
  // ═══════════════════════════════════════════════════════════════
  console.log('🏥 Création des établissements...');

  const hopitalPrincipal = await prisma.establishment.upsert({
    where: { id: 'seed-hopital-principal' },
    update: {},
    create: {
      id: 'seed-hopital-principal',
      name: 'Hôpital Principal de Dakar',
      type: EstablishmentType.HOPITAL_PUBLIC,
      description: 'Hôpital public de référence à Dakar',
      address: 'Avenue Nelson Mandela, Dakar',
      city: 'Dakar',
      region: 'Dakar',
      latitude: 14.6708,
      longitude: -17.4380,
      phoneNumber: '+221338394000',
      email: 'contact@hopital-principal.sn',
      isOpen24_7: true,
      hasEmergency: true,
      hasLaboratory: true,
      hasImaging: true,
      specialties: [
        MedicalSpecialty.MEDECINE_GENERALE,
        MedicalSpecialty.CARDIOLOGIE,
        MedicalSpecialty.CHIRURGIE_GENERALE,
        MedicalSpecialty.PEDIATRIE,
      ],
      services: ['Urgences', 'Hospitalisation', 'Maternité', 'Laboratoire'],
      isActive: true,
      isVerified: true,
    },
  });

  const cliniquePasteur = await prisma.establishment.upsert({
    where: { id: 'seed-clinique-pasteur' },
    update: {},
    create: {
      id: 'seed-clinique-pasteur',
      name: 'Clinique Pasteur',
      type: EstablishmentType.CLINIQUE,
      description: 'Clinique privée multi-spécialités',
      address: 'Rue 6 Point E, Dakar',
      city: 'Dakar',
      region: 'Dakar',
      latitude: 14.6892,
      longitude: -17.4571,
      phoneNumber: '+221338690000',
      isOpen24_7: false,
      openingHours: {
        mon: { open: '08:00', close: '18:00' },
        tue: { open: '08:00', close: '18:00' },
        wed: { open: '08:00', close: '18:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: { open: '08:00', close: '18:00' },
        sat: { open: '08:00', close: '13:00' },
        sun: { closed: true },
      },
      hasEmergency: false,
      hasLaboratory: true,
      consultationPriceMin: 15000,
      consultationPriceMax: 35000,
      specialties: [
        MedicalSpecialty.GYNECOLOGIE_OBSTETRIQUE,
        MedicalSpecialty.PEDIATRIE,
        MedicalSpecialty.DERMATOLOGIE,
      ],
      isActive: true,
      isVerified: true,
    },
  });

  const posteSanteThies = await prisma.establishment.upsert({
    where: { id: 'seed-poste-thies' },
    update: {},
    create: {
      id: 'seed-poste-thies',
      name: 'Poste de Santé Thiès Nord',
      type: EstablishmentType.POSTE_SANTE,
      description: 'Poste de santé communautaire',
      address: 'Thiès Nord',
      city: 'Thiès',
      region: 'Thiès',
      latitude: 14.7886,
      longitude: -16.9260,
      phoneNumber: '+221339510000',
      isOpen24_7: false,
      specialties: [MedicalSpecialty.MEDECINE_GENERALE],
      services: ['Consultations générales', 'Vaccinations', 'Suivi maternité'],
      isActive: true,
      isVerified: true,
    },
  });

  console.log(`   ✅ ${3} établissements créés`);

  // ═══════════════════════════════════════════════════════════════
  // 3. PATIENTS
  // ═══════════════════════════════════════════════════════════════
  console.log('🧑 Création des patients...');
  const patientPasswordHash = await bcrypt.hash('Patient2026!', 12);

  const patient1 = await prisma.user.upsert({
    where: { phoneNumber: '+221771111111' },
    update: {},
    create: {
      phoneNumber: '+221771111111',
      email: 'fatou.diop@example.sn',
      passwordHash: patientPasswordHash,
      role: UserRole.PATIENT,
      firstName: 'Fatou',
      lastName: 'Diop',
      dateOfBirth: new Date('1990-05-15'),
      gender: Gender.FEMME,
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      patientProfile: {
        create: {
          city: 'Dakar',
          region: 'Dakar',
          address: 'Sacré Coeur 3, Dakar',
          latitude: 14.7167,
          longitude: -17.4677,
          bloodGroup: BloodGroup.O_POSITIF,
          height: 165,
          weight: 60,
          medicalRecord: {
            create: {
              medicalHistory: 'Aucun antécédent particulier',
              isSmoker: false,
            },
          },
        },
      },
    },
  });

  const patient2 = await prisma.user.upsert({
    where: { phoneNumber: '+221772222222' },
    update: {},
    create: {
      phoneNumber: '+221772222222',
      passwordHash: patientPasswordHash,
      role: UserRole.PATIENT,
      firstName: 'Mamadou',
      lastName: 'Sarr',
      dateOfBirth: new Date('1985-03-20'),
      gender: Gender.HOMME,
      preferredLanguage: Language.WO,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      patientProfile: {
        create: {
          city: 'Dakar',
          region: 'Dakar',
          address: 'Yoff, Dakar',
          latitude: 14.7444,
          longitude: -17.4810,
          bloodGroup: BloodGroup.A_POSITIF,
        },
      },
    },
  });

  const patient3 = await prisma.user.upsert({
    where: { phoneNumber: '+221773333333' },
    update: {},
    create: {
      phoneNumber: '+221773333333',
      passwordHash: patientPasswordHash,
      role: UserRole.PATIENT,
      firstName: 'Aïcha',
      lastName: 'Ndiaye',
      dateOfBirth: new Date('1995-08-10'),
      gender: Gender.FEMME,
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      patientProfile: {
        create: {
          city: 'Thiès',
          region: 'Thiès',
          latitude: 14.7886,
          longitude: -16.9260,
          bloodGroup: BloodGroup.B_POSITIF,
        },
      },
    },
  });

  console.log(`   ✅ 3 patients créés`);

  // ═══════════════════════════════════════════════════════════════
  // 4. MÉDECINS
  // ═══════════════════════════════════════════════════════════════
  console.log('👨‍⚕️ Création des médecins...');
  const medecinPasswordHash = await bcrypt.hash('Medecin2026!', 12);

  // Médecin salarié
  const medecinSalarie = await prisma.user.upsert({
    where: { phoneNumber: '+221780000001' },
    update: {},
    create: {
      phoneNumber: '+221780000001',
      email: 'dr.diallo@hopital-principal.sn',
      passwordHash: medecinPasswordHash,
      role: UserRole.MEDECIN_SALARIE,
      firstName: 'Ousmane',
      lastName: 'Diallo',
      gender: Gender.HOMME,
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      kycVerifiedAt: new Date(),
      medecinProfile: {
        create: {
          licenseNumber: 'CNOM-SN-001234',
          specialties: [MedicalSpecialty.CARDIOLOGIE],
          yearsOfExperience: 15,
          languages: [Language.FR, Language.WO],
          bio: 'Cardiologue avec 15 ans d\'expérience à l\'Hôpital Principal',
          establishmentId: hopitalPrincipal.id,
          consultationPriceMin: 20000,
          consultationPriceMax: 30000,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Médecin libéral mobile
  const medecinMobile = await prisma.user.upsert({
    where: { phoneNumber: '+221780000002' },
    update: {},
    create: {
      phoneNumber: '+221780000002',
      email: 'dr.sow.mobile@sante-senegal.sn',
      passwordHash: medecinPasswordHash,
      role: UserRole.MEDECIN_LIBERAL_MOBILE,
      firstName: 'Mariama',
      lastName: 'Sow',
      gender: Gender.FEMME,
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      kycVerifiedAt: new Date(),
      medecinProfile: {
        create: {
          licenseNumber: 'CNOM-SN-005678',
          specialties: [MedicalSpecialty.MEDECINE_GENERALE],
          yearsOfExperience: 8,
          languages: [Language.FR, Language.WO],
          bio: 'Médecin généraliste libéral, consultations à domicile dans Dakar',
          isMobileAvailable: true,
          mobileRadiusKm: 15,
          mobileConsultationPrice: 15000,
          mobileTravelFee: 3000,
          currentLatitude: 14.6928,
          currentLongitude: -17.4467,
          lastLocationUpdate: new Date(),
          consultationPriceMin: 15000,
          consultationPriceMax: 20000,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Spécialiste en cabinet
  const specialiste = await prisma.user.upsert({
    where: { phoneNumber: '+221780000003' },
    update: {},
    create: {
      phoneNumber: '+221780000003',
      email: 'dr.fall.cabinet@sante-senegal.sn',
      passwordHash: medecinPasswordHash,
      role: UserRole.SPECIALISTE_CABINET,
      firstName: 'Abdoulaye',
      lastName: 'Fall',
      gender: Gender.HOMME,
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      kycVerifiedAt: new Date(),
      medecinProfile: {
        create: {
          licenseNumber: 'CNOM-SN-009012',
          specialties: [MedicalSpecialty.DERMATOLOGIE],
          yearsOfExperience: 12,
          languages: [Language.FR],
          bio: 'Dermatologue à Clinique Pasteur, spécialiste des maladies cutanées',
          establishmentId: cliniquePasteur.id,
          consultationPriceMin: 25000,
          consultationPriceMax: 35000,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  console.log(`   ✅ 3 médecins créés`);

  // ═══════════════════════════════════════════════════════════════
  // 5. PHARMACIE + PHARMACIEN
  // ═══════════════════════════════════════════════════════════════
  console.log('💊 Création des pharmacies...');

  const pharmacieGuyAxe = await prisma.pharmacy.upsert({
    where: { id: 'seed-pharmacie-guy-axe' },
    update: {},
    create: {
      id: 'seed-pharmacie-guy-axe',
      name: 'Pharmacie Guy Axe',
      address: 'Avenue Cheikh Anta Diop, Dakar',
      city: 'Dakar',
      region: 'Dakar',
      latitude: 14.6889,
      longitude: -17.4540,
      phoneNumber: '+221338240000',
      isOpen24_7: true,
      hasDelivery: true,
      deliveryRadiusKm: 10,
      deliveryFee: 1500,
      minimumOrder: 2000,
      isActive: true,
      isVerified: true,
    },
  });

  const pharmacien = await prisma.user.upsert({
    where: { phoneNumber: '+221790000001' },
    update: {},
    create: {
      phoneNumber: '+221790000001',
      passwordHash: await bcrypt.hash('Pharma2026!', 12),
      role: UserRole.PHARMACIEN,
      firstName: 'Awa',
      lastName: 'Ba',
      preferredLanguage: Language.FR,
      isPhoneVerified: true,
      kycStatus: 'APPROVED',
      pharmacienProfile: {
        create: {
          licenseNumber: 'AUTH-PHARMA-001',
          pharmacyId: pharmacieGuyAxe.id,
          isVerified: true,
        },
      },
    },
  });

  console.log(`   ✅ 1 pharmacie + 1 pharmacien créés`);

  // ═══════════════════════════════════════════════════════════════
  // 6. CATALOGUE MÉDICAMENTS
  // ═══════════════════════════════════════════════════════════════
  console.log('💉 Création du catalogue médicaments...');

  const medications = [
    {
      commercialName: 'Doliprane 1000mg',
      dci: 'Paracétamol',
      laboratory: 'Sanofi',
      form: 'Comprimé',
      dosage: '1000mg',
      packagingUnit: 'Boîte de 8',
      therapeuticClass: 'Antalgique',
      category: 'ANTIDOULEUR',
      requiresPrescription: false,
      referencePrice: 2500,
    },
    {
      commercialName: 'Amoxicilline 500mg',
      dci: 'Amoxicilline',
      laboratory: 'Mylan',
      form: 'Gélule',
      dosage: '500mg',
      packagingUnit: 'Boîte de 12',
      therapeuticClass: 'Antibiotique',
      category: 'ANTIBIOTIQUE',
      requiresPrescription: true,
      isGeneric: true,
      referencePrice: 3500,
    },
    {
      commercialName: 'Loratadine 10mg',
      dci: 'Loratadine',
      laboratory: 'Bayer',
      form: 'Comprimé',
      dosage: '10mg',
      packagingUnit: 'Boîte de 10',
      therapeuticClass: 'Antihistaminique',
      category: 'ANTI_ALLERGIE',
      requiresPrescription: false,
      referencePrice: 4500,
    },
    {
      commercialName: 'Metformine 500mg',
      dci: 'Metformine',
      laboratory: 'Merck',
      form: 'Comprimé',
      dosage: '500mg',
      packagingUnit: 'Boîte de 30',
      therapeuticClass: 'Antidiabétique',
      category: 'ANTIDIABETIQUE',
      requiresPrescription: true,
      referencePrice: 5000,
    },
    {
      commercialName: 'Smecta',
      dci: 'Diosmectite',
      laboratory: 'Ipsen',
      form: 'Poudre',
      dosage: '3g',
      packagingUnit: 'Boîte de 30 sachets',
      therapeuticClass: 'Antidiarrhéique',
      category: 'GASTRO',
      requiresPrescription: false,
      referencePrice: 4500,
    },
  ];

  for (const med of medications) {
    const medication = await prisma.medication.upsert({
      where: { commercialName: med.commercialName } as any,
      update: med,
      create: med,
    }).catch(async () => {
      // Si pas de unique constraint sur commercialName, on crée simplement
      return await prisma.medication.create({ data: med });
    });

    // Ajouter au stock de la pharmacie Guy Axe
    await prisma.pharmacyStock.upsert({
      where: {
        pharmacyId_medicationId: {
          pharmacyId: pharmacieGuyAxe.id,
          medicationId: medication.id,
        },
      },
      update: { quantity: 50 },
      create: {
        pharmacyId: pharmacieGuyAxe.id,
        medicationId: medication.id,
        quantity: 50,
        price: med.referencePrice ?? 2000,
      },
    });
  }

  console.log(`   ✅ ${medications.length} médicaments + stocks créés`);

  // ═══════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Seed terminé avec succès !');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n📝 Comptes de test créés :');
  console.log('');
  console.log('   SUPER ADMIN');
  console.log('   Tel : +221770000001');
  console.log('   Mot de passe : Admin2026!');
  console.log('');
  console.log('   PATIENT (Fatou Diop)');
  console.log('   Tel : +221771111111');
  console.log('   Mot de passe : Patient2026!');
  console.log('');
  console.log('   MÉDECIN SALARIÉ (Dr Diallo - Cardiologue)');
  console.log('   Tel : +221780000001');
  console.log('   Mot de passe : Medecin2026!');
  console.log('');
  console.log('   MÉDECIN LIBÉRAL MOBILE (Dr Sow - Généraliste)');
  console.log('   Tel : +221780000002');
  console.log('   Mot de passe : Medecin2026!');
  console.log('');
  console.log('   PHARMACIEN (Awa Ba - Pharmacie Guy Axe)');
  console.log('   Tel : +221790000001');
  console.log('   Mot de passe : Pharma2026!');
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant le seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
