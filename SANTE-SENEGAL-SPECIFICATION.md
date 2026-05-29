# 🏥 SANTÉ SÉNÉGAL — Document de Spécification

> **Plateforme nationale tout-en-un pour l'écosystème santé sénégalais**

**Version :** 1.0
**Date :** 28 mai 2026
**Auteur :** Baye Tapha Samb
**Status :** Phase 0 — Fondations

---

## 📋 Table des matières

1. [Vision & Mission](#1-vision--mission)
2. [Problématiques résolues](#2-problématiques-résolues)
3. [Acteurs du système (Rôles)](#3-acteurs-du-système-rôles)
4. [Modules fonctionnels](#4-modules-fonctionnels)
5. [User Stories détaillées](#5-user-stories-détaillées)
6. [Parcours utilisateurs (User Flows)](#6-parcours-utilisateurs-user-flows)
7. [Règles métier critiques](#7-règles-métier-critiques)
8. [Architecture technique](#8-architecture-technique)
9. [Sécurité & Conformité](#9-sécurité--conformité)
10. [Modèle économique](#10-modèle-économique)
11. [Roadmap & Phases](#11-roadmap--phases)
12. [Risques & Mitigation](#12-risques--mitigation)

---

## 1. Vision & Mission

### Vision
Devenir l'**infrastructure numérique de référence** pour la santé au Sénégal, en connectant tous les acteurs (patients, médecins, établissements, pharmacies) sur une plateforme unique, fiable et accessible.

### Mission
Permettre à chaque Sénégalais d'accéder à des soins de qualité **rapidement**, **à proximité** et **en toute simplicité**, qu'il soit en ville ou en zone rurale.

### Valeurs
- **Accessibilité** : fonctionne sur smartphone bas de gamme et connexion 3G
- **Inclusivité** : français + wolof, illettrés via interface vocale (futur)
- **Confiance** : sécurité des données médicales irréprochable
- **Innovation** : médecin libéral mobile + pharmacie virtuelle = innovation africaine

---

## 2. Problématiques résolues

| Problème actuel | Solution Santé Sénégal |
|---|---|
| Longues files d'attente dans hôpitaux | Prise de RDV en ligne avec créneaux |
| Dossiers médicaux papier perdus/incomplets | DME centralisé accessible partout |
| Ordonnances illisibles ou perdues | Ordonnances numériques signées |
| Difficulté trouver un médecin la nuit/weekend | Médecins libéraux mobiles géolocalisés |
| Médicaments introuvables (rupture stock) | Pharmacie virtuelle avec stock temps réel |
| Pharmacies de garde inconnues | Localisation pharmacies ouvertes 24/7 |
| Pas de suivi des rappels (vaccins, médicaments) | Notifications SMS automatiques |
| Paiements en espèces uniquement | Wave / Orange Money intégrés |
| Pas de coordination entre médecins | DME partagé entre praticiens autorisés |

---

## 3. Acteurs du système (Rôles)

### 3.1 PATIENT
**Description :** Citoyen utilisant la plateforme pour ses soins
**Permissions :**
- Créer/modifier son profil
- Consulter son DME complet
- Prendre/annuler RDV
- Demander un médecin libéral mobile
- Consulter ses ordonnances
- Commander médicaments
- Effectuer paiements
- Donner notes/avis sur praticiens

### 3.2 MÉDECIN SALARIÉ (rattaché à un établissement)
**Description :** Médecin exerçant dans un hôpital, clinique, poste ou centre de santé
**Permissions :**
- Voir ses RDV du jour
- Consulter le DME du patient (avec consentement)
- Ajouter consultations, diagnostics, prescriptions
- Émettre ordonnances numériques
- Demander examens complémentaires
- Référer le patient à un confrère

### 3.3 MÉDECIN LIBÉRAL MOBILE ⭐
**Description :** Médecin indépendant qui se déplace au domicile des patients
**Permissions :**
- Activer/désactiver sa disponibilité géolocalisée
- Définir son rayon de déplacement (5km, 10km, 20km)
- Accepter/refuser une demande de consultation à domicile
- Fixer ses tarifs (consultation + déplacement)
- Naviguer vers le patient (intégration GPS)
- Saisir consultation et ordonnance sur place
- Gérer son agenda

### 3.4 SPÉCIALISTE EN CABINET
**Description :** Médecin spécialiste recevant en cabinet privé
**Permissions :**
- Identique au médecin salarié
- + Gestion de son cabinet (horaires, secrétariat)
- + Tarifs de consultation personnalisés

### 3.5 INFIRMIER À DOMICILE
**Description :** Infirmier proposant des soins à domicile (injections, pansements, prélèvements)
**Permissions :**
- Voir demandes de soins infirmiers
- Géolocalisation comme médecin libéral
- Enregistrer actes infirmiers dans DME

### 3.6 PHARMACIEN
**Description :** Responsable d'une pharmacie partenaire
**Permissions :**
- Gérer stock médicaments en temps réel
- Recevoir ordonnances numériques
- Valider/refuser commandes
- Marquer pharmacie en garde (24/7)
- Gérer livraisons

### 3.7 LIVREUR
**Description :** Coursier qui livre médicaments à domicile
**Permissions :**
- Voir commandes disponibles
- Accepter livraison
- Tracking GPS livré au patient
- Confirmer livraison

### 3.8 ADMIN ÉTABLISSEMENT
**Description :** Administrateur d'un hôpital/clinique/poste de santé
**Permissions :**
- Gérer le personnel médical de l'établissement
- Configurer horaires/services
- Statistiques de l'établissement
- Facturation

### 3.9 SUPER-ADMIN PLATEFORME
**Description :** Équipe Santé Sénégal
**Permissions :**
- Validation des inscriptions médecins/pharmacies (vérification diplômes)
- Modération
- Gestion abonnements
- Statistiques globales
- Support utilisateurs

---

## 4. Modules fonctionnels

### MODULE 1 — Authentification & Profil
- Inscription patient (téléphone + OTP SMS)
- Inscription professionnel de santé (téléphone + vérification ordre des médecins)
- Connexion (téléphone + mot de passe OU OTP)
- Récupération de mot de passe
- Gestion profil (photo, infos personnelles, contacts d'urgence)
- KYC pour médecins (upload diplôme, carte ordre, CNI)

### MODULE 2 — Dossier Médical Électronique (DME)
- Informations générales (groupe sanguin, allergies, antécédents)
- Historique des consultations
- Examens & analyses (avec PDFs/images)
- Vaccinations
- Ordonnances reçues
- Hospitalisations
- Documents annexes
- Partage temporaire avec un médecin (token QR)

### MODULE 3 — Rendez-vous
- Recherche médecin/établissement (filtres : spécialité, ville, langue, prix, note)
- Affichage créneaux disponibles
- Réservation RDV (présentiel ou téléconsultation)
- Confirmation par SMS
- Rappels J-1 et H-2
- Annulation/Reprogrammation
- Liste d'attente automatique

### MODULE 4 — Médecin Libéral Mobile ⭐
- Géolocalisation des médecins disponibles
- Filtres (spécialité, distance, prix, note)
- Demande de consultation à domicile
- Estimation prix + temps d'arrivée
- Acceptation par médecin
- Tracking temps réel du médecin (style Uber)
- Consultation sur place (saisie DME)
- Paiement post-consultation
- Notation mutuelle

### MODULE 5 — Téléconsultation
- Vidéo call sécurisé (WebRTC)
- Chat intégré
- Partage d'écran (résultats d'analyses)
- Enregistrement consultation (avec consentement)
- Ordonnance numérique générée

### MODULE 6 — Ordonnances Numériques
- Génération par médecin (avec signature électronique)
- Format normalisé (médicament, posologie, durée)
- QR code unique anti-fraude
- Envoi automatique au patient
- Transmission aux pharmacies sélectionnées
- Historique des ordonnances
- Renouvellement automatique pour maladies chroniques

### MODULE 7 — Pharmacie Virtuelle ⭐
- Catalogue médicaments (base nationale)
- Recherche par nom commercial ou DCI (molécule)
- Stock temps réel par pharmacie
- Pharmacies de garde (carte 24/7)
- Comparaison prix
- Commande directe depuis ordonnance
- Livraison à domicile (option)
- Retrait en pharmacie (option)
- Alertes ruptures + alternatives

### MODULE 8 — Livraison Médicaments
- Système de matching pharmacie ↔ livreur
- Tracking GPS livreur
- Notifications étapes (préparée, en route, livrée)
- Preuve de livraison (photo + signature)
- Évaluation livreur

### MODULE 9 — Paiements
- Wave Business API (priorité — leader local)
- Orange Money API
- Free Money API
- Cartes bancaires (Stripe) pour diaspora
- Wallet interne (crédit Santé Sénégal)
- Facturation établissements
- Splits automatiques (médecin / plateforme / pharmacie)

### MODULE 10 — Notifications
- SMS (rappels RDV, ordonnances, livraisons)
- Push notifications (PWA)
- Email (récap mensuel, factures)
- WhatsApp (futur — via WhatsApp Business API)
- Préférences utilisateur (canaux, langues)

### MODULE 11 — Géolocalisation
- Cartes interactives (Mapbox)
- Établissements de santé (filtres types)
- Pharmacies (filtres garde 24/7)
- Médecins libéraux disponibles
- Itinéraires (voiture, taxi, marche)

### MODULE 12 — Avis & Notation
- Notation médecins (5 étoiles + commentaire)
- Notation pharmacies
- Notation livreurs
- Modération des avis (anti-spam, anti-diffamation)
- Réponse du praticien aux avis

### MODULE 13 — Dashboard & Statistiques
- Pour patients : suivi santé personnel
- Pour médecins : nombre consultations, revenus, notes
- Pour établissements : flux patients, performance
- Pour super-admin : KPIs globaux

### MODULE 14 — Urgences
- Bouton SOS sur l'app
- Appel automatique SAMU (1515)
- Géolocalisation envoyée aux secours
- Carte des hôpitaux d'urgence les plus proches
- Contacts d'urgence du patient prévenus automatiquement

### MODULE 15 — Mode Offline
- DME consultable offline (cache)
- Création RDV en file d'attente (sync au retour)
- Ordonnances téléchargeables PDF
- Synchronisation intelligente

---

## 5. User Stories détaillées

### 5.1 PATIENT — User Stories

#### US-P01 : Inscription
> En tant que **patient**, je veux **m'inscrire avec mon numéro de téléphone** afin de **créer mon dossier santé sans avoir besoin d'email**.

**Critères d'acceptation :**
- Saisir numéro téléphone sénégalais (+221)
- Recevoir OTP par SMS (6 chiffres, valide 5 min)
- Compléter profil (nom, prénom, date naissance, sexe, ville)
- Choisir langue (FR/WO)
- Accepter CGU + politique de confidentialité

#### US-P02 : Prise de RDV
> En tant que **patient**, je veux **prendre rendez-vous avec un médecin** afin d'**éviter les files d'attente à l'hôpital**.

**Critères d'acceptation :**
- Filtrer par spécialité, ville, prix, langue
- Voir les créneaux disponibles
- Réserver en 3 clics maximum
- Recevoir SMS de confirmation
- Recevoir rappel J-1 et H-2

#### US-P03 : Demander un médecin à domicile (URGENT)
> En tant que **patient malade**, je veux **demander un médecin à mon domicile maintenant** afin de **recevoir des soins sans me déplacer**.

**Critères d'acceptation :**
- Bouton "Médecin à domicile" en évidence
- Saisir motif (urgent / non-urgent)
- Voir liste médecins disponibles à proximité (rayon 5-20km)
- Sélectionner médecin avec prix affiché
- Attendre acceptation (< 2 min)
- Suivre arrivée en temps réel sur carte
- Payer après consultation

#### US-P04 : Consulter mon DME
> En tant que **patient**, je veux **accéder à tout mon historique médical** afin de le **partager avec un médecin lors d'une consultation**.

**Critères d'acceptation :**
- Voir toutes les consultations passées
- Voir toutes les ordonnances
- Voir tous les examens (avec PDFs)
- Générer un QR code à partager au médecin (accès temporaire 1h)
- Télécharger DME en PDF

#### US-P05 : Commander un médicament
> En tant que **patient**, je veux **commander mes médicaments depuis mon ordonnance** afin de les **recevoir chez moi**.

**Critères d'acceptation :**
- Voir ordonnance reçue
- Voir pharmacies ayant le médicament en stock
- Comparer prix et délais de livraison
- Choisir pharmacie + livraison à domicile
- Payer en ligne
- Suivre livraison

### 5.2 MÉDECIN LIBÉRAL — User Stories

#### US-M01 : Activer ma disponibilité
> En tant que **médecin libéral**, je veux **activer mon statut "disponible"** afin de **recevoir des demandes de consultations à domicile**.

**Critères d'acceptation :**
- Bouton ON/OFF en haut de l'app
- Définir rayon de déplacement (5, 10, 20 km)
- Définir tarif consultation + tarif déplacement
- Voir nombre de patients potentiels dans la zone

#### US-M02 : Accepter une demande
> En tant que **médecin libéral**, je veux **recevoir une notification de demande** afin de **l'accepter ou la refuser rapidement**.

**Critères d'acceptation :**
- Notification push sonore
- Voir : nom patient, motif, distance, prix
- 60 secondes pour accepter (sinon proposée à un autre médecin)
- Si accepté : itinéraire GPS automatique vers patient

#### US-M03 : Saisir une consultation
> En tant que **médecin**, je veux **saisir mes observations dans le DME** afin de **garder une trace pour le patient**.

**Critères d'acceptation :**
- Formulaire structuré (motif, examen, diagnostic, traitement)
- Possibilité dicter (speech-to-text)
- Joindre photos (lésions, etc.)
- Générer ordonnance en parallèle
- Sauvegarde automatique anti-perte

### 5.3 PHARMACIEN — User Stories

#### US-PH01 : Recevoir une commande
> En tant que **pharmacien**, je veux **recevoir les ordonnances numériques** afin de **préparer les commandes**.

**Critères d'acceptation :**
- Notification push commande reçue
- Voir détails ordonnance + patient
- Vérifier stock (auto-décrément)
- Valider ou demander substitution
- Choisir : retrait ou livraison

#### US-PH02 : Gérer mon stock
> En tant que **pharmacien**, je veux **mettre à jour mes stocks en temps réel** afin que **les patients ne commandent pas de médicaments indisponibles**.

**Critères d'acceptation :**
- Saisie manuelle simple
- Import CSV (gros stocks)
- Alertes seuil bas
- API future avec logiciels pharmacie existants

### 5.4 LIVREUR — User Stories

#### US-L01 : Prendre une livraison
> En tant que **livreur**, je veux **voir les livraisons disponibles** afin de **gagner ma vie**.

**Critères d'acceptation :**
- Liste filtrée par distance
- Voir : adresse pharmacie, adresse patient, prix
- Accepter en 1 clic
- Itinéraire GPS

---

## 6. Parcours utilisateurs (User Flows)

### 6.1 Flow Critique #1 : "Je suis malade à 23h, je veux un médecin"

```
1. Patient ouvre app → Écran d'accueil
2. Tap sur "Médecin à domicile maintenant"
3. App demande géolocalisation
4. Saisie rapide : motif + urgence
5. Liste médecins disponibles (5km) → 3 médecins affichés
6. Patient choisit Dr. Diop (15 000 FCFA, 12 min)
7. Notification envoyée au Dr. Diop
8. Dr. Diop accepte (45 sec)
9. Patient voit Dr. Diop sur la carte → "En route, arrivée dans 12 min"
10. Dr. Diop arrive → notification "Le médecin est arrivé"
11. Consultation sur place
12. Dr. Diop saisit DME + ordonnance sur sa tablette
13. Patient reçoit ordonnance numérique
14. Patient paie via Wave (15 000 FCFA)
15. Notation mutuelle
16. Optionnel : patient commande médicaments via app
17. Pharmacie de garde livre dans 30 min
```

### 6.2 Flow Critique #2 : "RDV avec gynécologue"

```
1. Patient → "Prendre RDV"
2. Filtres : Gynécologue, Dakar, Femme, Wolof
3. Liste de 12 gynécologues
4. Choix Dr. Sow (Clinique Pasteur, 25 000 FCFA, ★ 4.8)
5. Voir créneaux : jeudi 14h, vendredi 10h, lundi 16h
6. Sélection vendredi 10h
7. Confirmation + paiement acompte (Wave)
8. SMS confirmation
9. Jeudi 10h → SMS rappel "Demain 10h chez Dr. Sow"
10. Vendredi 8h → SMS rappel "Dans 2h"
11. Patient se rend à la clinique
12. Check-in via QR code à l'accueil
13. Consultation
14. Dr. Sow met à jour DME
15. Ordonnance numérique envoyée
16. Notation post-consultation
```

### 6.3 Flow Critique #3 : "Pharmacie de garde dimanche"

```
1. Patient → "Pharmacies"
2. Filtre "Ouvertes maintenant" + "À proximité"
3. Carte avec 3 pharmacies de garde dans un rayon de 5km
4. Choix Pharmacie de la Patte d'Oie
5. Recherche médicament : "Doliprane 1000mg"
6. Voir : en stock, 2500 FCFA, livraison 30 min
7. Commande + paiement
8. Notification "Pharmacie prépare"
9. Notification "Livreur en route"
10. Tracking GPS livreur
11. Livraison + signature digitale
```

---

## 7. Règles métier critiques

### 7.1 Règles d'authentification

- **R1** : Tout numéro de téléphone doit être validé par OTP avant création du compte
- **R2** : Un médecin ne peut prendre de RDV qu'après validation manuelle de son diplôme par l'équipe Santé Sénégal (KYC)
- **R3** : Un pharmacien doit avoir une autorisation pharmacie scannée + vérifiée
- **R4** : Sessions JWT de 1h + refresh token de 30 jours

### 7.2 Règles DME

- **R5** : Le DME appartient au patient. Aucun médecin ne peut y accéder sans consentement explicite
- **R6** : Le patient peut donner accès temporaire à un médecin via QR code (durée : 1h, 24h, 7j, illimité)
- **R7** : Les modifications du DME sont historisées (qui, quand, quoi) — audit log immuable
- **R8** : Aucune donnée médicale n'est jamais supprimée (RGPD-like : anonymisation possible)

### 7.3 Règles RDV

- **R9** : Un RDV peut être annulé sans frais jusqu'à 24h avant
- **R10** : Entre 24h et 2h avant : 50% de l'acompte retenu
- **R11** : Moins de 2h avant ou no-show : 100% retenu
- **R12** : Un patient avec 3 no-show consécutifs est bloqué 30 jours

### 7.4 Règles Médecin Libéral Mobile

- **R13** : Le matching se fait par algorithme : disponibilité + distance + note + temps de réponse moyen
- **R14** : Le médecin a 60 secondes pour accepter sinon la demande passe au suivant
- **R15** : Annulation patient après acceptation médecin = pénalité 50% du tarif
- **R16** : Annulation médecin = pénalité sur sa note + indisponibilité 1h

### 7.5 Règles Pharmacie

- **R17** : Le stock affiché doit être à jour à ±15 minutes
- **R18** : Une pharmacie qui annonce un médicament inexistant est suspendue
- **R19** : Substitution générique = consentement patient obligatoire
- **R20** : Médicaments soumis à ordonnance = vérification ordonnance numérique obligatoire

### 7.6 Règles Paiement

- **R21** : Commission plateforme = 5% sur consultations, 3% sur pharmacie
- **R22** : Paiement médecin J+1 (libéral) ou J+15 (établissement)
- **R23** : Litige paiement = blocage des fonds 48h pour médiation
- **R24** : Remboursement automatique si médecin annule

### 7.7 Règles Urgences

- **R25** : Bouton SOS appelle directement le SAMU (1515) + envoie géolocalisation
- **R26** : Pour les urgences vitales, l'app ne se substitue pas aux secours

---

## 8. Architecture technique

### 8.1 Stack Backend

```
Node.js 20 LTS
├── Express 4 (HTTP framework)
├── TypeScript 5 (typage)
├── Prisma 5 (ORM PostgreSQL)
├── PostgreSQL 16 (base de données)
├── Redis 7 (cache + sessions + matching)
├── Socket.io 4 (temps réel)
├── Bull (job queue : SMS, emails, rappels)
├── JWT + bcrypt (auth)
├── Zod (validation)
├── Winston (logging)
└── Jest (tests)
```

### 8.2 Stack Frontend (PWA)

```
React 18
├── Vite 5 (bundler)
├── TypeScript 5
├── TailwindCSS 3 + shadcn/ui
├── Zustand (state)
├── React Query (data fetching)
├── React Router v6
├── Mapbox GL JS (cartes)
├── Workbox (offline PWA)
├── i18next (français/wolof)
├── React Hook Form + Zod
└── Vitest (tests)
```

### 8.3 Services externes

| Service | Usage | Coût estimé |
|---|---|---|
| Twilio | SMS internationaux fallback | Variable |
| Orange SMS API | SMS Sénégal | 10-15 FCFA/SMS |
| Cloudinary | Stockage images/PDFs | Free tier puis $89/mois |
| Mapbox | Cartes + géocoding | Free jusqu'à 50k loads/mois |
| Wave Business | Paiements | Commission 1% |
| Orange Money API | Paiements | Commission 1.5% |
| Firebase FCM | Push notifications | Gratuit |
| Sentry | Monitoring erreurs | Free tier |
| Plausible | Analytics privacy-friendly | $9/mois |

### 8.4 Infrastructure

```
Production
├── Backend : VPS Hetzner CX22 (4€/mois) ou Railway
├── DB : Supabase PostgreSQL (free puis $25/mois)
├── Redis : Upstash (free tier)
├── Frontend : Vercel (gratuit)
└── CDN : Cloudflare (gratuit)

Dev
├── Local PostgreSQL 16
├── Local Redis
└── ngrok pour webhooks
```

### 8.5 Architecture en couches

```
┌─────────────────────────────────────────┐
│         CLIENTS (PWA, Web, Mobile)      │
└─────────────────┬───────────────────────┘
                  │
                  │ HTTPS / WSS
                  │
┌─────────────────▼───────────────────────┐
│         API Gateway (Express)           │
│  ┌──────────┬──────────┬─────────────┐  │
│  │  REST    │ Socket.io│   Webhooks  │  │
│  └────┬─────┴────┬─────┴──────┬──────┘  │
│       │          │            │         │
│  ┌────▼─────┐ ┌─▼────────┐ ┌─▼──────┐  │
│  │  Auth    │ │  Real    │ │ External│  │
│  │Middleware│ │  Time    │ │  APIs   │  │
│  └────┬─────┘ └─┬────────┘ └─┬──────┘  │
└───────┼─────────┼────────────┼─────────┘
        │         │            │
┌───────▼─────────▼────────────▼─────────┐
│         BUSINESS LAYER                  │
│  Services : Auth, RDV, DME, Pharmacie  │
│            Matching, Paiement, Notif    │
└───────┬─────────┬────────────┬─────────┘
        │         │            │
┌───────▼─────────▼────────────▼─────────┐
│          DATA LAYER                     │
│  ┌──────────┐ ┌──────┐ ┌──────────┐    │
│  │PostgreSQL│ │Redis │ │Cloudinary│    │
│  └──────────┘ └──────┘ └──────────┘    │
└─────────────────────────────────────────┘
```

---

## 9. Sécurité & Conformité

### 9.1 Sécurité des données

- **Chiffrement transit** : HTTPS/TLS 1.3 partout
- **Chiffrement repos** : AES-256 sur DB + fichiers Cloudinary
- **Mots de passe** : bcrypt avec salt 12 rounds
- **JWT** : signés HS256, rotation refresh tokens
- **Données sensibles DME** : chiffrement applicatif additionnel (champs DM)
- **2FA optionnel** pour médecins et admins
- **Audit log immuable** : toutes actions sur DME tracées

### 9.2 Conformité

- **CDP Sénégal** : déclaration Commission de Protection des Données Personnelles
- **Code de déontologie médicale** : respect du secret médical
- **HDS** (Hébergement Données Santé) : viser certification HDS française moyen terme
- **CGU & Politique de confidentialité** : explicites en FR + WO

### 9.3 Sauvegarde & DRP

- Backup quotidien automatique DB → S3 (chiffré)
- Rétention 30 jours
- Tests de restauration mensuels
- RTO : 4h, RPO : 24h

---

## 10. Modèle économique

### 10.1 Sources de revenus

| Source | Détail | Estimation revenus an 1 |
|---|---|---|
| Abonnement médecins libéraux | 10 000 FCFA/mois | 200 médecins × 10k × 12 = 24M FCFA |
| Abonnement cliniques | 50 000 FCFA/mois | 30 cliniques × 50k × 12 = 18M FCFA |
| Commission consultations | 5% par RDV payé en ligne | Variable |
| Commission pharmacie | 3% par commande | Variable |
| Commission livraison | 500 FCFA par livraison | Variable |
| Téléconsultation premium | 2 000 FCFA/mois patient | Variable |
| Pub établissements (futur) | Sponsoring search | À étudier |

### 10.2 Coûts opérationnels (mensuel)

| Poste | Coût |
|---|---|
| Infrastructure (cloud) | ~50 000 FCFA |
| SMS (10 000 SMS/mois) | ~150 000 FCFA |
| Services tiers (Mapbox, Cloudinary, etc.) | ~100 000 FCFA |
| Équipe (2 devs + 1 ops) | ~3M FCFA |
| Marketing | ~500 000 FCFA |
| **TOTAL** | **~3,8M FCFA/mois** |

### 10.3 Stratégie de pricing

- **Patients** : 100% gratuit (acquisition massive)
- **Médecins libéraux** : 1 mois d'essai gratuit
- **Cliniques** : tarif dégressif selon nombre médecins
- **Diaspora** : option premium pour gérer santé famille au Sénégal

---

## 11. Roadmap & Phases

### Phase 0 — Fondations ✅ (en cours)
- [x] Document de spécification
- [ ] Schéma de base de données complet
- [ ] Architecture détaillée
- [ ] Setup environnement dev

### Phase 1 — Backend Core (semaines 2-5)
- [ ] Setup Node.js + Express + TypeScript + Prisma
- [ ] Authentification multi-rôles + JWT + RBAC
- [ ] CRUD utilisateurs (patients, médecins, etc.)
- [ ] CRUD établissements
- [ ] Module DME (base)
- [ ] Tests unitaires

### Phase 2 — Modules métier (semaines 6-10)
- [ ] Module RDV complet
- [ ] Ordonnances numériques
- [ ] SMS via Twilio/Orange
- [ ] Paiements Wave/OM
- [ ] Notifications

### Phase 3 — Innovation (semaines 11-16)
- [ ] WebSockets temps réel
- [ ] Géolocalisation médecins libéraux
- [ ] Algorithme matching
- [ ] Pharmacie virtuelle + stocks
- [ ] Module livraison

### Phase 4 — Frontend PWA (semaines 17-22)
- [ ] App patient
- [ ] Dashboard médecin
- [ ] Dashboard pharmacien
- [ ] Dashboard admin établissement
- [ ] Super-admin

### Phase 5 — Polish & Tests (semaines 23-24+)
- [ ] Tests E2E (Playwright)
- [ ] Audit sécurité
- [ ] Optimisation performance
- [ ] Mode offline robuste
- [ ] Documentation utilisateur
- [ ] Préparation lancement pilote

---

## 12. Risques & Mitigation

| Risque | Impact | Probabilité | Mitigation |
|---|---|---|---|
| Faible adoption médecins | 🔴 Élevé | 🟡 Moyenne | Partenariat ordre des médecins, 6 mois gratuits early adopters |
| Connectivité internet faible | 🟡 Moyen | 🔴 Élevée | Mode offline robuste, fallback SMS |
| Litiges médicaux (responsabilité) | 🔴 Élevé | 🟡 Moyenne | CGU strictes, assurance RC pro, disclaimer médecin |
| Fuite données médicales | 🔴 Critique | 🟡 Moyenne | Chiffrement, audit, formation équipe, bug bounty |
| Concurrence (acteur national/intl) | 🟡 Moyen | 🟡 Moyenne | First mover advantage, focus local, prix bas |
| Réglementation santé qui change | 🟡 Moyen | 🟡 Moyenne | Veille juridique, conseil avocat santé |
| Difficulté paiements (échecs Wave/OM) | 🟡 Moyen | 🟡 Moyenne | Multi-providers, wallet interne fallback |
| Bugs critiques en production | 🔴 Élevé | 🟢 Faible | Tests automatisés, staging, rollback rapide |

---

## 📌 Notes finales

Ce document est **vivant**. Il sera mis à jour à chaque sprint de développement.

**Prochaine action :** Création du **schéma de base de données complet** (`schema.prisma`).

---

**Fin du document de spécification — Santé Sénégal v1.0**
