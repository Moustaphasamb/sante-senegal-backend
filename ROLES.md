# 👥 ROLES.md — Acteurs et permissions du système

> **Référence complète des 9 rôles utilisateurs de Santé Sénégal**
> Ce document est la source de vérité pour le système RBAC (Role-Based Access Control).
>
> ⚠️ Toute permission codée dans le projet DOIT respecter ce document.
> Si une règle n'est pas claire ici → demander à Baye avant d'implémenter.

---

## 📑 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Patient](#1--patient)
3. [Médecin salarié](#2--médecin-salarié)
4. [Médecin libéral mobile ⭐](#3--médecin-libéral-mobile-)
5. [Spécialiste en cabinet](#4--spécialiste-en-cabinet)
6. [Infirmier à domicile](#5--infirmier-à-domicile)
7. [Pharmacien](#6--pharmacien)
8. [Livreur](#7--livreur)
9. [Admin établissement](#8--admin-établissement)
10. [Super-admin plateforme](#9--super-admin-plateforme)
11. [Matrice résumée des permissions](#-matrice-résumée-des-permissions)
12. [Règles d'or de l'autorisation](#-règles-dor-de-lautorisation)
13. [Implémentation technique RBAC](#-implémentation-technique-rbac)

---

## Vue d'ensemble

Santé Sénégal compte **9 rôles distincts**, chacun avec ses propres permissions et restrictions. Les rôles correspondent à l'enum Prisma `UserRole` :

```typescript
enum UserRole {
  PATIENT
  MEDECIN_SALARIE
  MEDECIN_LIBERAL_MOBILE
  SPECIALISTE_CABINET
  INFIRMIER_DOMICILE
  PHARMACIEN
  LIVREUR
  ADMIN_ETABLISSEMENT
  SUPER_ADMIN
}
```

### Hiérarchie de confiance (KYC)

```
SUPER_ADMIN       ← Créé manuellement
    ↓
ADMIN_ETABLISSEMENT  ← Validé par SUPER_ADMIN
    ↓
MEDECINS / INFIRMIERS / PHARMACIENS / LIVREURS  ← KYC manuel obligatoire
    ↓
PATIENT  ← KYC auto (OTP suffit)
```

---

## 1. 🧑 PATIENT

### Identité
Tout citoyen sénégalais (ou résident) utilisant l'app pour ses soins de santé.

### KYC
**Approuvé automatiquement** à l'inscription (OTP suffit).

### Permissions ✅

#### Profil
- Créer et modifier son profil personnel
- Uploader sa photo de profil
- Gérer ses contacts d'urgence
- Choisir sa langue (FR / Wolof)
- Activer / désactiver les notifications
- Demander la suppression de son compte (soft delete + anonymisation)

#### DME (son propre)
- Consulter son DME complet (allergies, antécédents, consultations, ordonnances, vaccinations)
- Uploader des documents médicaux personnels (anciennes analyses, radios)
- Ajouter ses allergies, maladies chroniques
- Partager temporairement son DME avec un médecin (QR code, 1h / 24h / 7j / illimité)
- Révoquer un accès au DME à tout moment

#### Rendez-vous & Consultations
- Rechercher des médecins / établissements
- Prendre / annuler / reprogrammer des RDV
- Faire une téléconsultation vidéo
- Demander un médecin libéral mobile à domicile
- Suivre l'arrivée du médecin en temps réel
- Consulter l'historique de ses consultations

#### Ordonnances & Pharmacie
- Consulter ses ordonnances numériques
- Télécharger ordonnance en PDF
- Voir le QR code de l'ordonnance
- Rechercher des médicaments
- Voir les pharmacies à proximité (avec stock)
- Voir les pharmacies de garde
- Commander des médicaments depuis une ordonnance
- Choisir livraison à domicile ou retrait pharmacie
- Suivre la livraison en temps réel

#### Paiements
- Effectuer des paiements (Wave, Orange Money)
- Voir l'historique de ses paiements
- Demander un remboursement (litige)

#### Évaluation
- Noter les médecins, pharmacies, livreurs (1-5 étoiles + commentaire)

#### Urgences
- Déclencher une alerte SOS (urgence vitale)

### Restrictions ❌
- ❌ Voir le DME d'autres patients
- ❌ Modifier ses consultations passées (seul le médecin peut, dans les 24h)
- ❌ S'auto-prescrire des médicaments
- ❌ Valider un diplôme médical
- ❌ Voir les revenus des médecins
- ❌ Accéder aux statistiques d'autres utilisateurs
- ❌ Modifier ses notes / avis après publication (au-delà de 7 jours)

---

## 2. 👨‍⚕️ MÉDECIN SALARIÉ

### Identité
Médecin rattaché à un hôpital public, clinique privée, poste ou centre de santé.

### KYC
**Validation manuelle obligatoire** par super-admin :
- Diplôme de médecine (scan)
- Carte de l'Ordre des Médecins du Sénégal
- CNI (Carte Nationale d'Identité)
- Photo professionnelle
- Attestation de rattachement à l'établissement

### Permissions ✅

#### Tout ce qu'a un patient pour son propre compte +

#### Agenda
- Voir son agenda de RDV (jour, semaine, mois)
- Définir ses créneaux disponibles
- Bloquer des plages horaires (congés, formations, urgences)
- Voir le profil des patients qui ont RDV avec lui

#### DME des patients
- Consulter le DME d'un patient **avec son consentement** (token QR ou consentement écrit)
- Voir uniquement les sections nécessaires à la consultation
- L'accès est **toujours logué** dans `AuditLog`

#### Consultations
- Saisir une consultation (motif, examen, diagnostic, traitement, signes vitaux)
- Enregistrer les codes CIM-10
- Joindre des documents (photos lésions, etc.)
- Modifier sa consultation **dans les 24h** suivant la saisie (corrections)

#### Ordonnances
- Émettre une ordonnance numérique signée
- Prescrire des médicaments avec posologie
- Autoriser ou non la substitution générique
- Marquer une ordonnance comme renouvelable
- Annuler sa propre ordonnance (avant délivrance)

#### Examens & Référencement
- Prescrire des examens complémentaires (biologie, imagerie)
- Référer le patient à un confrère
- Demander un avis spécialisé

#### Téléconsultation
- Faire une téléconsultation vidéo
- Partager son écran (résultats)
- Enregistrer la consultation (avec consentement patient)

#### Statistiques personnelles
- Voir ses statistiques (nombre consultations, revenus, notes)
- Voir son wallet et historique de paiements
- Demander un retrait de son wallet

#### Profil professionnel
- Mettre à jour sa bio, langues, spécialités
- Définir ses tarifs de consultation
- Répondre aux avis qu'il reçoit

### Restrictions ❌
- ❌ Modifier le DME au-delà des 24h après consultation
- ❌ Supprimer une consultation (jamais)
- ❌ Accéder à un DME sans consentement explicite
- ❌ Activer le mode "libéral mobile" (c'est un rôle différent)
- ❌ Gérer le personnel de l'établissement
- ❌ Modifier les horaires de l'établissement
- ❌ Émettre une ordonnance hors de sa spécialité (warning, pas blocage)
- ❌ Voir les consultations effectuées par d'autres médecins (sauf si patient partage)

---

## 3. 🚗 MÉDECIN LIBÉRAL MOBILE ⭐

### Identité
Médecin indépendant qui se déplace au **domicile des patients**.
**C'est l'innovation majeure du projet** — équivalent Uber Santé.

### KYC
**Validation manuelle obligatoire** :
- Diplôme + Ordre + CNI + Photo
- Permis de conduire (recommandé)
- Vérification de la zone d'activité

### Permissions ✅

#### Toutes les permissions du médecin salarié +

#### Disponibilité géolocalisée
- **Activer / désactiver** sa disponibilité (toggle ON/OFF en 1 clic)
- Définir son **rayon de déplacement** (5, 10, 15, 20 km)
- Mettre à jour sa position GPS en temps réel (envoi automatique par l'app)
- Voir le nombre de patients potentiels dans sa zone

#### Tarification
- Fixer son **tarif de consultation** à domicile (FCFA)
- Fixer son **tarif de déplacement** (frais kilométriques)
- Modifier ses tarifs **uniquement quand inactif** (pas pendant une mission)

#### Missions à domicile
- Recevoir des demandes de consultation à domicile (notifications push sonores)
- Voir le profil du patient demandeur (nom, motif, distance, photo)
- **Accepter ou refuser** une demande en **60 secondes max**
- Démarrer un trajet → navigation GPS automatique vers le patient
- Marquer son arrivée chez le patient
- Saisir la consultation **sur place** (mobile / tablette)
- Générer et envoyer l'ordonnance immédiatement
- Recevoir le paiement à la fin de la consultation

#### Statistiques mobiles
- Voir son **score de réactivité** (temps moyen d'acceptation)
- Voir son **score de complétion** (% missions terminées)
- Voir le revenu généré par les visites à domicile

### Restrictions ❌
- ❌ Accepter plus d'une mission à la fois
- ❌ Annuler une mission acceptée sans pénalité (note + indispo 1h)
- ❌ Modifier le tarif après acceptation
- ❌ Sortir de son rayon défini (pas de matching hors zone)
- ❌ Refuser un patient pour des raisons discriminatoires (sanctions)

### Règles métier spécifiques
- Si 60 secondes sans réponse → la mission passe au médecin suivant
- 3 refus consécutifs = avertissement
- 5 annulations / mois après acceptation = suspension 7 jours

---

## 4. 👩‍⚕️ SPÉCIALISTE EN CABINET

### Identité
Médecin spécialiste exerçant en cabinet privé (cardiologue, dermatologue, gynéco, etc.).

### KYC
**Validation manuelle obligatoire** + justificatif de spécialité.

### Permissions ✅

#### Toutes les permissions du médecin salarié +

#### Cabinet
- Gérer son cabinet (adresse, horaires d'ouverture, photos, services)
- Définir des tarifs spécifiques selon le type de consultation :
  - Première consultation
  - Consultation de suivi
  - Consultation d'urgence
- Avoir un agenda **personnalisé indépendant** d'un établissement
- Gérer son secrétariat (si applicable, sous-comptes)
- Recevoir des paiements directement sur son wallet

### Restrictions ❌
- ❌ Mêmes que médecin salarié
- ❌ Faire de visite à domicile (sauf si aussi inscrit comme MÉDECIN_LIBERAL_MOBILE)

---

## 5. 💉 INFIRMIER À DOMICILE

### Identité
Infirmier qualifié proposant des soins à domicile : injections, pansements, prélèvements, perfusions, suivi post-opératoire.

### KYC
**Validation manuelle obligatoire** :
- Diplôme infirmier d'État
- Autorisation d'exercice
- CNI

### Permissions ✅

#### Profil & disponibilité
- Tout ce qu'a un patient pour son propre compte
- Mêmes permissions de **mobilité géolocalisée** que le médecin libéral mobile
- Activer / désactiver disponibilité géolocalisée
- Définir son rayon et ses tarifs

#### Missions infirmières
- Recevoir des demandes de soins infirmiers
- Accepter / refuser demandes
- Lire l'ordonnance du médecin avant l'acte
- Enregistrer les **actes infirmiers** dans le DME (sans diagnostic)
- Confirmer la réalisation de l'acte
- Marquer la fin d'une perfusion / soin
- Joindre des photos avant/après (avec consentement patient)
- Recevoir le paiement après l'acte

### Restrictions ❌
- ❌ Poser un diagnostic médical
- ❌ Prescrire des médicaments
- ❌ Modifier une ordonnance
- ❌ Faire de consultation médicale
- ❌ Émettre un certificat médical
- ❌ Exécuter un acte hors ordonnance valide (sauf premiers secours)

### Règle d'or
**Peut UNIQUEMENT exécuter ce qui est dans l'ordonnance du médecin.**

---

## 6. 💊 PHARMACIEN

### Identité
Responsable d'une pharmacie partenaire (titulaire ou employé autorisé).

### KYC
**Validation manuelle obligatoire** :
- Diplôme de pharmacie
- Autorisation d'exercice
- Autorisation de la pharmacie (registre)
- CNI

### Permissions ✅

#### Gestion pharmacie
- Mettre à jour le profil de sa pharmacie (horaires, photos, services)
- Activer le mode "**pharmacie de garde**" (24/7)
- Configurer la livraison (rayon, frais, minimum commande)

#### Stock
- Gérer le stock de médicaments **en temps réel**
- Importer le stock via CSV
- Définir les prix de vente par médicament
- Configurer les alertes de stock bas
- Marquer un médicament en rupture

#### Commandes
- Recevoir les ordonnances numériques (notifications push)
- Vérifier l'authenticité de l'ordonnance (QR code, signature)
- **Accepter ou refuser** une commande
- Proposer une **substitution générique** (avec consentement patient)
- Marquer une commande comme préparée
- Choisir entre **retrait en pharmacie** ou **livraison**
- Décrémenter automatiquement le stock à la délivrance

#### Statistiques
- Voir les statistiques de sa pharmacie (commandes, CA, top médicaments)
- Recevoir les paiements
- Voir son wallet et demander des retraits
- Répondre aux avis clients

### Restrictions ❌
- ❌ Délivrer un médicament soumis à ordonnance **sans ordonnance valide**
- ❌ Modifier l'ordonnance d'un médecin
- ❌ Afficher un médicament en stock alors qu'il n'y est pas (sanctions : suspension 30j)
- ❌ Voir le DME complet du patient (juste l'ordonnance en cours)
- ❌ Voir les paiements d'autres pharmacies
- ❌ Vendre des médicaments stupéfiants sans autorisation spéciale
- ❌ Modifier les tarifs de référence nationaux

---

## 7. 🛵 LIVREUR

### Identité
Coursier qui livre les médicaments aux patients à domicile.

### KYC
**Validation manuelle obligatoire** :
- CNI
- Permis de conduire (si véhicule motorisé)
- Justificatif de domicile
- Photo

### Permissions ✅

#### Disponibilité
- Activer / désactiver sa disponibilité
- Définir son type de véhicule (moto, voiture, vélo, à pied)
- Mettre à jour sa position GPS en temps réel

#### Livraisons
- Voir les livraisons disponibles dans sa zone
- Filtrer par distance / prix
- **Accepter une livraison** (1 seule à la fois)
- Voir l'itinéraire vers la pharmacie
- Marquer "récupéré" à la pharmacie (scan QR ou code)
- Voir l'itinéraire vers le patient
- Tracking GPS du patient pendant la livraison
- Marquer "livré" avec preuve :
  - Photo du colis remis
  - Signature digitale du patient
- Signaler un échec de livraison (patient absent, refus)

#### Revenus
- Voir ses revenus
- Voir son wallet
- Demander un retrait

### Restrictions ❌
- ❌ Voir le contenu détaillé de la commande (juste "médicaments")
- ❌ Modifier le prix
- ❌ Livrer en dehors de sa zone définie
- ❌ Accepter plus d'une livraison à la fois
- ❌ Voir les informations médicales du patient
- ❌ Ouvrir le colis
- ❌ Garder un colis non livré (obligation de retour à la pharmacie sous 24h)

---

## 8. 🏥 ADMIN ÉTABLISSEMENT

### Identité
Administrateur d'un hôpital, clinique, poste ou centre de santé (1 à plusieurs par établissement).

### KYC
**Validation manuelle par super-admin** + lettre d'autorisation de l'établissement.

### Permissions ✅
(**Limitées à SON établissement uniquement**)

#### Gestion de l'établissement
- Modifier les informations de l'établissement (nom, adresse, photos, description)
- Gérer les horaires d'ouverture
- Définir les services proposés (urgences, labo, imagerie, etc.)
- Gérer les départements / services internes

#### Personnel médical
- **Inviter** des médecins à rejoindre l'établissement
- **Retirer** un médecin de l'établissement
- Voir la liste des médecins rattachés
- Gérer les remplacements

#### Planning
- Voir le planning global de l'établissement
- Gérer les permanences

#### Finances & Statistiques
- Voir les statistiques de l'établissement (flux patients, RDV, revenus globaux)
- Gérer les abonnements de l'établissement
- Voir les factures
- Gérer la facturation

#### Communication
- Répondre aux avis sur l'établissement
- Communiquer avec les patients (annonces, fermetures exceptionnelles)
- Inviter d'autres admins pour l'établissement

### Restrictions ❌
- ❌ Voir les DME des patients
- ❌ Modifier les consultations
- ❌ Accéder à d'autres établissements
- ❌ Valider les KYC des médecins (c'est le super-admin)
- ❌ Supprimer son établissement (super-admin uniquement)
- ❌ Voir les revenus individuels détaillés des médecins (sauf si convention spécifique)
- ❌ Modifier les ordonnances
- ❌ Voir les paiements personnels des médecins

---

## 9. 👑 SUPER-ADMIN PLATEFORME

### Identité
Équipe Santé Sénégal (Baye Tapha Samb + futurs collaborateurs).

### KYC
**Créé manuellement** par un autre super-admin existant. Accès très restreint.

### Permissions ✅
(Tout, avec audit log obligatoire)

#### Validation KYC
- Approuver ou rejeter un dossier de professionnel (médecin, infirmier, pharmacien, livreur)
- Demander des compléments d'information
- Suspendre temporairement un KYC

#### Modération
- Suspendre / bannir un utilisateur (toute catégorie)
- Modérer les avis signalés
- Supprimer un contenu inapproprié

#### Statistiques globales
- Voir **toutes les statistiques** de la plateforme
- Tableaux de bord KPIs (nombre utilisateurs, transactions, revenus)
- Export de données

#### Configuration plateforme
- Configurer les **commissions** plateforme (5% consult, 3% pharma)
- Gérer le catalogue national de médicaments
- Définir les pharmacies de garde officielles
- Gérer les abonnements globaux

#### Gestion établissements
- Créer / modifier / supprimer des établissements
- Valider les admins établissements

#### Financier
- Gérer les **remboursements** et litiges
- Voir tous les paiements et transactions
- Bloquer un paiement (litige)

#### Communication
- Envoyer des notifications globales
- Publier des annonces plateforme
- Communiquer avec les utilisateurs

#### Système
- Accéder aux logs techniques (Sentry)
- Consulter les **audit logs** (qui a fait quoi, quand)
- Gérer les autres super-admins
- Gérer les paramètres système

### Restrictions ❌
- ❌ Voir le contenu détaillé d'un DME sans **raison légale** (audit log obligatoire + responsabilité légale)
- ❌ Modifier une consultation médicale
- ❌ Modifier les notes d'évaluation
- ❌ Supprimer définitivement un DME (anonymisation possible)
- ❌ Agir au nom d'un utilisateur sans son consentement

### Règle d'or
**Ses actions sont TOUTES loggées dans `AuditLog` (responsabilité légale et conformité CDP Sénégal).**

---

## 📊 Matrice résumée des permissions

| Action | Pat | M.Sal | M.Mob | Spé | Inf | Pha | Liv | A.Étab | S.Adm |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Voir son propre DME | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir DME autre patient | ❌ | 🟡¹ | 🟡¹ | 🟡¹ | 🟡¹ | ❌ | ❌ | ❌ | 🟡² |
| Saisir consultation | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Saisir acte infirmier | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Émettre ordonnance | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Délivrer médicament | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Effectuer livraison | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Géoloc mobile | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Téléconsultation | ✅³ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gérer établissement | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gérer stock pharmacie | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Valider KYC | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Voir audit logs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configurer commissions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bouton SOS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modérer avis | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡⁴ | ✅ |
| Voir paiements globaux | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡⁵ | ✅ |

**Légende :**
- ✅ Autorisé
- ❌ Refusé
- 🟡¹ Avec consentement explicite du patient (token QR)
- 🟡² Avec audit log obligatoire + raison légale
- ✅³ En tant que patient, peut participer
- 🟡⁴ Uniquement sur son établissement
- 🟡⁵ Uniquement les paiements de son établissement

**Acronymes :**
- Pat = PATIENT
- M.Sal = MEDECIN_SALARIE
- M.Mob = MEDECIN_LIBERAL_MOBILE
- Spé = SPECIALISTE_CABINET
- Inf = INFIRMIER_DOMICILE
- Pha = PHARMACIEN
- Liv = LIVREUR
- A.Étab = ADMIN_ETABLISSEMENT
- S.Adm = SUPER_ADMIN

---

## 🔐 Règles d'or de l'autorisation

### R1 — Le DME appartient au patient
Aucun professionnel ne peut accéder au DME d'un patient sans son **consentement explicite** (token QR avec durée définie).

### R2 — Tout est loggé
Chaque action sur le DME est enregistrée dans `AuditLog` :
- qui (userId)
- quoi (action)
- sur quoi (resourceType + resourceId)
- quand (timestamp)
- depuis où (ipAddress, userAgent)

### R3 — Pas d'auto-élévation de privilèges
Un PATIENT ne peut PAS devenir MEDECIN sans passer par le processus KYC officiel. Le changement de rôle nécessite l'intervention d'un SUPER_ADMIN.

### R4 — Cloisonnement par établissement
Un ADMIN_ETABLISSEMENT ne voit QUE les données de SON établissement. Pas de cross-établissement.

### R5 — Super-admin = exception loggée
Toutes les actions du SUPER_ADMIN sont loggées avec responsabilité légale, notamment pour la conformité CDP Sénégal.

### R6 — Soft delete uniquement
Aucun utilisateur n'est jamais supprimé définitivement. On utilise `deletedAt` (soft delete) pour préserver l'intégrité des données médicales.

### R7 — KYC obligatoire pour les pros
PATIENT → KYC automatique (OTP).
Tout autre rôle → KYC manuel validé par SUPER_ADMIN.

### R8 — Pas de partage de compte
Chaque utilisateur = un compte unique. Pas de comptes partagés (problème de responsabilité légale).

---

## 🛠️ Implémentation technique RBAC

### Dans Prisma (déjà fait)

```typescript
enum UserRole {
  PATIENT
  MEDECIN_SALARIE
  MEDECIN_LIBERAL_MOBILE
  SPECIALISTE_CABINET
  INFIRMIER_DOMICILE
  PHARMACIEN
  LIVREUR
  ADMIN_ETABLISSEMENT
  SUPER_ADMIN
}
```

### Middleware d'autorisation (déjà fait)

Fichier : `src/middleware/authenticate.ts`

```typescript
// Autoriser certains rôles
router.get(
  '/admin/users',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  handler
);

// Autoriser tous les médecins
router.post(
  '/consultations',
  authenticate,
  authorizeAnyMedecin,
  handler
);

// Autoriser admins (établissement OU super)
router.patch(
  '/establishments/:id',
  authenticate,
  authorizeAnyAdmin,
  handler
);

// Exiger KYC validé
router.post(
  '/prescriptions',
  authenticate,
  authorizeAnyMedecin,
  requireKycApproved,
  handler
);
```

### Pattern recommandé pour vérifier permissions complexes

Quand la permission dépend de **l'ownership** (ex: un patient ne peut modifier QUE son propre profil), créer un middleware spécifique :

```typescript
// Exemple : checkPatientOwnership
export const checkPatientOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requestedPatientId = req.params.patientId;
  const currentUserId = req.user?.userId;
  const currentRole = req.user?.role;

  // Super-admin a accès partout (avec audit log)
  if (currentRole === UserRole.SUPER_ADMIN) {
    await createAuditLog({
      userId: currentUserId,
      action: 'VIEW_PATIENT',
      resourceType: 'PATIENT',
      resourceId: requestedPatientId,
    });
    return next();
  }

  // Le patient lui-même
  if (currentRole === UserRole.PATIENT) {
    const patient = await prisma.patientProfile.findUnique({
      where: { id: requestedPatientId },
    });
    if (patient?.userId !== currentUserId) {
      throw new ForbiddenError('Vous ne pouvez accéder qu\'à votre propre profil');
    }
    return next();
  }

  // Médecin avec consentement
  if (isMedecinRole(currentRole)) {
    const hasAccess = await checkDocumentAccessToken(
      currentUserId,
      requestedPatientId
    );
    if (!hasAccess) {
      throw new ForbiddenError('Aucun consentement actif du patient');
    }
    return next();
  }

  throw new ForbiddenError('Accès non autorisé');
};
```

### Helpers utiles à créer

```typescript
// utils/roles.ts

export const isMedecinRole = (role: UserRole): boolean => {
  return [
    UserRole.MEDECIN_SALARIE,
    UserRole.MEDECIN_LIBERAL_MOBILE,
    UserRole.SPECIALISTE_CABINET,
  ].includes(role);
};

export const canPrescribe = (role: UserRole): boolean => {
  return isMedecinRole(role);
};

export const canPerformNurseAct = (role: UserRole): boolean => {
  return role === UserRole.INFIRMIER_DOMICILE || isMedecinRole(role);
};

export const isMobileWorker = (role: UserRole): boolean => {
  return [
    UserRole.MEDECIN_LIBERAL_MOBILE,
    UserRole.INFIRMIER_DOMICILE,
    UserRole.LIVREUR,
  ].includes(role);
};

export const isAdmin = (role: UserRole): boolean => {
  return [UserRole.ADMIN_ETABLISSEMENT, UserRole.SUPER_ADMIN].includes(role);
};
```

---

## 📝 Maintenance de ce document

Ce fichier doit être mis à jour à chaque fois que :
- Un nouveau rôle est ajouté
- Une permission change
- Une règle métier d'autorisation est modifiée
- Un nouveau cas d'usage cross-rôles est identifié

**Dernière mise à jour :** 28 mai 2026
**Version :** 1.0
**Auteur :** Baye Tapha Samb

---

**Fin du document ROLES.md**
