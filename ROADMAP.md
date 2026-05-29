# 🗺️ ROADMAP.md — Liste détaillée des modules

> Ordre de construction strict. Ne pas dévier sans raison forte.

---

## 📦 Module 1 : Authentification ✅ FAIT

Voir `PROJECT-STATE.md` pour détails.

---

## 📦 Module 2 : Utilisateurs & Profils (PROCHAIN)

**Dépendances :** Module 1

**Objectifs :**
- Gestion profil utilisateur
- Upload photo (Cloudinary)
- Contacts d'urgence

**Endpoints :**
```
GET    /users/me
PATCH  /users/me
POST   /users/me/photo
DELETE /users/me/photo
GET    /users/:id
DELETE /users/me

GET    /users/me/emergency-contacts
POST   /users/me/emergency-contacts
PATCH  /users/me/emergency-contacts/:id
DELETE /users/me/emergency-contacts/:id
```

**Estimation :** 1-2 jours

---

## 📦 Module 3 : Établissements

**Dépendances :** Module 1, 2

**Objectifs :**
- CRUD établissements
- Recherche géolocalisée

**Endpoints :**
```
GET    /establishments
GET    /establishments/nearby
GET    /establishments/:id
POST   /establishments      (admin)
PATCH  /establishments/:id  (admin)
DELETE /establishments/:id  (super-admin)
```

**Estimation :** 1-2 jours

---

## 📦 Module 4 : Médecins

**Dépendances :** Module 1, 2, 3

**Objectifs :**
- Annuaire médecins
- KYC (upload diplômes)
- Toggle disponibilité libérale mobile
- Planning hebdomadaire

**Endpoints :**
```
GET    /medecins
GET    /medecins/nearby
GET    /medecins/:id
PATCH  /medecins/me
POST   /medecins/me/documents
POST   /medecins/me/mobile/toggle
POST   /medecins/me/location
GET    /medecins/me/schedule
POST   /medecins/me/schedule

POST   /admin/medecins/:id/approve-kyc
POST   /admin/medecins/:id/reject-kyc
```

**Estimation :** 2-3 jours

---

## 📦 Module 5 : DME (Dossier Médical)

**Dépendances :** Module 1, 2, 4

**Objectifs :**
- Accès patient à son DME
- Partage temporaire via token QR
- Audit log obligatoire

**Endpoints :**
```
GET    /medical-records/me
GET    /medical-records/:patientId
PATCH  /medical-records/me
POST   /medical-records/me/allergies
POST   /medical-records/me/chronic-conditions
POST   /medical-records/me/documents
POST   /medical-records/me/share-token
GET    /medical-records/access/:token
DELETE /medical-records/me/share-tokens/:id
```

**Estimation :** 2-3 jours

---

## 📦 Module 6 : Rendez-vous

**Dépendances :** Module 1, 2, 3, 4

**Objectifs :**
- Prise de RDV (présentiel + téléconsultation)
- Gestion créneaux disponibles
- Annulation, reprogrammation

**Endpoints :**
```
GET    /appointments/me
GET    /appointments/me/upcoming
POST   /appointments
GET    /appointments/:id
PATCH  /appointments/:id/cancel
PATCH  /appointments/:id/reschedule
POST   /appointments/:id/check-in
POST   /appointments/:id/start
POST   /appointments/:id/end

GET    /medecins/:id/availability
```

**Estimation :** 3-4 jours

---

## 📦 Module 7 : Médecin libéral mobile ⭐

**Dépendances :** Module 1, 2, 4, 6, **Socket.io**

**Objectifs :**
- L'INNOVATION : matching patient ↔ médecin libéral en temps réel
- Tracking GPS style Uber

**Endpoints :**
```
POST   /home-visits
GET    /home-visits/me
GET    /home-visits/:id
POST   /home-visits/:id/accept
POST   /home-visits/:id/reject
POST   /home-visits/:id/start-trip
POST   /home-visits/:id/arrived
POST   /home-visits/:id/complete
PATCH  /home-visits/:id/cancel
```

**WebSocket events :**
- `home-visit:new-request` (vers médecins disponibles)
- `home-visit:accepted` (vers patient)
- `home-visit:tracking` (position médecin temps réel)
- `home-visit:status-change`

**Estimation :** 5-7 jours (le plus complexe)

---

## 📦 Module 8 : Consultations

**Dépendances :** Module 5, 6, 7

**Objectifs :**
- Enregistrer consultations dans le DME
- Saisie médecin (motif, diagnostic, traitement)

**Endpoints :**
```
POST   /consultations
GET    /consultations/:id
PATCH  /consultations/:id

GET    /patients/:id/consultations
```

**Estimation :** 2 jours

---

## 📦 Module 9 : Ordonnances numériques

**Dépendances :** Module 8

**Objectifs :**
- Génération ordonnance après consultation
- Signature électronique
- QR code anti-fraude
- PDF téléchargeable

**Endpoints :**
```
POST   /prescriptions
GET    /prescriptions/me
GET    /prescriptions/:id
GET    /prescriptions/:id/pdf
GET    /prescriptions/:id/qr
POST   /prescriptions/:id/cancel
```

**Estimation :** 3 jours

---

## 📦 Module 10 : Médicaments & Pharmacies

**Dépendances :** Module 1, 3

**Objectifs :**
- Catalogue médicaments national
- Pharmacies + stocks temps réel
- Pharmacies de garde

**Endpoints :**
```
GET    /medications
GET    /medications/:id
GET    /medications/search/availability

GET    /pharmacies
GET    /pharmacies/nearby
GET    /pharmacies/on-duty
GET    /pharmacies/:id
GET    /pharmacies/:id/stock
POST   /pharmacies/me/stock
```

**Estimation :** 3-4 jours

---

## 📦 Module 11 : Commandes pharmacie

**Dépendances :** Module 9, 10

**Objectifs :**
- Commander médicaments depuis ordonnance
- Gestion par pharmacien

**Endpoints :**
```
POST   /pharmacy-orders
GET    /pharmacy-orders/me
GET    /pharmacy-orders/:id
POST   /pharmacy-orders/:id/accept
POST   /pharmacy-orders/:id/refuse
POST   /pharmacy-orders/:id/ready
POST   /pharmacy-orders/:id/complete
PATCH  /pharmacy-orders/:id/cancel
```

**Estimation :** 3 jours

---

## 📦 Module 12 : Livraison

**Dépendances :** Module 11, **Socket.io**

**Objectifs :**
- Matching livreurs
- Tracking GPS livraison

**Endpoints :**
```
GET    /deliveries/available
POST   /deliveries/:id/accept
POST   /deliveries/:id/picked-up
POST   /deliveries/:id/delivered
POST   /deliveries/:id/failed
GET    /deliveries/:id/tracking
```

**WebSocket events :** `delivery:tracking`, `delivery:status`

**Estimation :** 3-4 jours

---

## 📦 Module 13 : Paiements

**Dépendances :** Tous les modules avec paiement (RDV, ordonnances, livraisons)

**Objectifs :**
- Intégrer Wave + Orange Money
- Wallet interne
- Webhooks providers
- Splits automatiques

**Endpoints :**
```
POST   /payments/initiate
POST   /payments/wave/webhook
POST   /payments/orange-money/webhook
GET    /payments/me
GET    /payments/:id
POST   /payments/:id/refund

GET    /wallet/me
GET    /wallet/me/transactions
POST   /wallet/me/withdraw
```

**Estimation :** 5-7 jours

---

## 📦 Module 14 : Notifications

**Dépendances :** Tous les modules, **Bull**

**Objectifs :**
- SMS, push, in-app
- Préférences utilisateur
- CRON rappels RDV J-1, H-2

**Endpoints :**
```
GET    /notifications/me
PATCH  /notifications/me/:id/read
PATCH  /notifications/me/read-all
GET    /notifications/me/settings
PATCH  /notifications/me/settings
```

**Jobs Bull :** `send-sms`, `send-push`, `send-email`, `rdv-reminders`

**Estimation :** 3-4 jours

---

## 📦 Module 15 : Urgences (SOS)

**Dépendances :** Module 14

**Objectifs :**
- Bouton SOS
- Alerte SAMU + contacts d'urgence

**Endpoints :**
```
POST   /sos/alert
GET    /sos/me
POST   /sos/:id/resolve
```

**Estimation :** 1-2 jours

---

## 📦 Module 16 : Avis & Notation

**Dépendances :** Module 4, 6, 11, 12

**Objectifs :**
- Notation médecins, pharmacies, livreurs
- Modération
- Réponse aux avis

**Endpoints :**
```
POST   /reviews
GET    /reviews/target/:userId
GET    /reviews/me/received
POST   /reviews/:id/respond
POST   /admin/reviews/:id/moderate
```

**Estimation :** 2 jours

---

## 📦 Module 17 : Audit & Conformité

**Dépendances :** Tous les modules

**Objectifs :**
- Middleware d'audit automatique sur DME
- Consultation logs (super-admin)

**Endpoints :**
```
GET    /admin/audit-logs
```

**Estimation :** 1-2 jours

---

## 📦 Module 18 : Statistiques & Dashboards

**Dépendances :** Tous les modules

**Objectifs :**
- KPIs personnels, par établissement, plateforme
- Données pour dashboards frontend

**Endpoints :**
```
GET    /stats/me
GET    /stats/establishment/:id
GET    /stats/global
```

**Estimation :** 2-3 jours

---

## 📦 Module 19 : Téléconsultation vidéo

**Dépendances :** Module 6

**Objectifs :**
- Intégrer WebRTC
- Chat pendant l'appel
- Enregistrement avec consentement

**À étudier :** Twilio Video, Daily.co, Jitsi Meet.

**Estimation :** 3-5 jours

---

## 📦 Module 20 : Mode offline & sync (Frontend)

**Dépendances :** Frontend démarré

**Objectifs :**
- DME consultable offline
- Files d'attente d'actions
- Sync intelligente au retour de connexion

**Estimation :** 3-4 jours

---

## 🎯 Estimation globale

| Phase | Modules | Estimation |
|---|---|---|
| 1.1 — Auth | Module 1 | ✅ Fait |
| 1.2 — Users | Module 2 | 1-2 jours |
| 1.3 — Établissements | Module 3 | 1-2 jours |
| 1.4 — Médecins | Module 4 | 2-3 jours |
| 1.5 — DME | Module 5 | 2-3 jours |
| 2.1 — RDV | Module 6 | 3-4 jours |
| 2.2 — Médecin mobile ⭐ | Module 7 | 5-7 jours |
| 2.3 — Consultations | Module 8 | 2 jours |
| 2.4 — Ordonnances | Module 9 | 3 jours |
| 3.1 — Médicaments | Module 10 | 3-4 jours |
| 3.2 — Commandes | Module 11 | 3 jours |
| 3.3 — Livraison | Module 12 | 3-4 jours |
| 4.1 — Paiements | Module 13 | 5-7 jours |
| 4.2 — Notifications | Module 14 | 3-4 jours |
| 5.1 — SOS | Module 15 | 1-2 jours |
| 5.2 — Avis | Module 16 | 2 jours |
| 5.3 — Audit | Module 17 | 1-2 jours |
| 5.4 — Stats | Module 18 | 2-3 jours |
| 6.1 — Vidéo | Module 19 | 3-5 jours |

**TOTAL backend :** ~45-65 jours de dev (2-3 mois en plein temps)

**Frontend PWA :** +60-90 jours

**Tests, optimisation, polish :** +30 jours

**Total projet complet :** ~6-9 mois de dev intensif.

---

## 📌 Règles d'or

1. **Ne pas sauter de modules** — chaque dépend du précédent
2. **Tester** chaque module avant de passer au suivant
3. **Commiter** régulièrement (1 commit par sous-tâche)
4. **Mettre à jour `PROJECT-STATE.md`** à chaque module terminé
5. **Demander à Baye** si quelque chose n'est pas clair
