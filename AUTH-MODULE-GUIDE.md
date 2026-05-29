# 🔐 Module Auth - Guide de test

Module d'authentification complet pour Santé Sénégal.

## 📦 Installation des nouveaux fichiers

1. **Décompresse le ZIP** dans le dossier de ton backend, **par-dessus** les fichiers existants. Les fichiers à ajouter/remplacer :

```
src/
├── types/
│   └── express.d.ts                    ← NOUVEAU
├── utils/
│   ├── jwt.ts                          ← NOUVEAU
│   ├── password.ts                     ← NOUVEAU
│   └── otp.ts                          ← NOUVEAU
├── services/
│   ├── sms.service.ts                  ← NOUVEAU
│   ├── otp.service.ts                  ← NOUVEAU
│   └── auth.service.ts                 ← NOUVEAU
├── validators/
│   └── auth.validators.ts              ← NOUVEAU
├── middleware/
│   └── authenticate.ts                 ← NOUVEAU
├── controllers/
│   └── auth.controller.ts              ← NOUVEAU
└── routes/
    ├── index.ts                        ← REMPLACE l'existant
    └── auth.routes.ts                  ← NOUVEAU
```

2. **Redémarre le serveur** (Ctrl+C puis `npm run dev`)

## 🧪 Tests des endpoints

Tu peux tester avec **Postman**, **Insomnia**, ou **curl** directement.

Base URL : `http://localhost:3000/api/v1`

---

### 1️⃣ Envoyer un OTP

```bash
POST /auth/otp/send
Content-Type: application/json

{
  "phoneNumber": "+221770000099",
  "purpose": "REGISTRATION"
}
```

**Réponse attendue (200) :**
```json
{
  "success": true,
  "data": {
    "success": true,
    "expiresIn": 300,
    "message": "Code OTP envoyé par SMS"
  },
  "message": "Code OTP envoyé par SMS"
}
```

✨ **En mode DEV**, le code OTP s'affiche dans **ta console serveur** comme ceci :

```
═══════════════════════════════════════════════════════
📱 SMS [MODE DEV - non envoyé]
   À      : +221770000099
   Message: [Santé Sénégal] Votre code de vérification est : 123456...
═══════════════════════════════════════════════════════
```

Note bien le code à 6 chiffres.

---

### 2️⃣ Inscrire un patient

```bash
POST /auth/register/patient
Content-Type: application/json

{
  "phoneNumber": "+221770000099",
  "password": "MotDePasse2026!",
  "firstName": "Test",
  "lastName": "Patient",
  "preferredLanguage": "FR",
  "otpCode": "123456"
}
```

⚠️ **Remplace `123456`** par le vrai code que tu as vu dans la console.

**Réponse attendue (201) :**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "phoneNumber": "+221770000099",
      "firstName": "Test",
      "lastName": "Patient",
      "role": "PATIENT",
      "kycStatus": "APPROVED",
      ...
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "Inscription patient réussie"
}
```

**Sauvegarde** l'`accessToken` et le `refreshToken` pour la suite.

---

### 3️⃣ Se connecter (avec un compte existant)

Tu peux utiliser un compte du seed, par exemple **Fatou Diop** :

```bash
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+221771111111",
  "password": "Patient2026!"
}
```

**Réponse attendue (200) :**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "message": "Connexion réussie"
}
```

---

### 4️⃣ Récupérer son profil

```bash
GET /auth/me
Authorization: Bearer eyJhbGc...
```

Réponse complète avec patientProfile, medicalRecord, wallet, etc.

---

### 5️⃣ Refresh token (rotation)

```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

→ Retourne un NOUVEAU access + refresh token. L'ancien refresh devient invalide.

---

### 6️⃣ Inscription médecin

```bash
POST /auth/register/medecin
Content-Type: application/json

{
  "phoneNumber": "+221780009999",
  "password": "MotDePasse2026!",
  "firstName": "Dr",
  "lastName": "Test",
  "role": "MEDECIN_LIBERAL_MOBILE",
  "licenseNumber": "CNOM-SN-TEST-001",
  "otpCode": "123456"
}
```

⚠️ Envoie d'abord un OTP au `+221780009999` avant.

📝 **Note** : Le compte sera créé avec `kycStatus: PENDING` — c'est normal, les médecins doivent être vérifiés manuellement.

---

### 7️⃣ Changer son mot de passe

```bash
POST /auth/change-password
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "currentPassword": "Patient2026!",
  "newPassword": "NouveauMDP2026!"
}
```

---

### 8️⃣ Réinitialiser son mot de passe (mot de passe oublié)

**Étape 1** : Envoyer un OTP de type RESET_PASSWORD

```bash
POST /auth/otp/send
{
  "phoneNumber": "+221771111111",
  "purpose": "RESET_PASSWORD"
}
```

**Étape 2** : Reset avec le code reçu

```bash
POST /auth/reset-password
{
  "phoneNumber": "+221771111111",
  "otpCode": "123456",
  "newPassword": "Recouvre2026!"
}
```

---

### 9️⃣ Logout

```bash
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

→ Réponse 204 No Content. Le refresh token est révoqué.

---

### 🔟 Logout de tous les appareils

```bash
POST /auth/logout-all
Authorization: Bearer eyJ...
```

---

## 🐛 Cas d'erreur à tester

### ❌ OTP invalide
```bash
POST /auth/register/patient
{ ..., "otpCode": "000000" }
```
→ 400 : "Code OTP incorrect"

### ❌ Mot de passe faible
```bash
POST /auth/register/patient
{ ..., "password": "abc" }
```
→ 422 : Liste des règles non respectées

### ❌ Numéro invalide
```bash
POST /auth/otp/send
{ "phoneNumber": "123456" }
```
→ 422 : "Numéro de téléphone sénégalais invalide"

### ❌ Sans token sur route protégée
```bash
GET /auth/me
```
→ 401 : "Token d'authentification manquant"

### ❌ Token expiré
→ 401 : "Token expiré"

### ❌ Numéro déjà utilisé
→ 409 : "Ce numéro de téléphone est déjà utilisé"

### ❌ Rate limiting (essayer 6 fois en 15 min)
→ 429 : "Trop de tentatives"

---

## 📋 Checklist de validation

Coche au fur et à mesure que tu testes :

- [ ] Envoyer un OTP affiche bien le code dans la console
- [ ] Inscription patient fonctionne avec le bon OTP
- [ ] Login Fatou Diop (+221771111111 / Patient2026!) fonctionne
- [ ] GET /auth/me avec token retourne les infos de Fatou
- [ ] GET /auth/me sans token retourne 401
- [ ] Refresh token génère bien de nouveaux tokens
- [ ] L'ancien refresh token ne marche plus après refresh
- [ ] Inscription médecin retourne kycStatus PENDING
- [ ] Logout révoque bien le refresh token

---

## 💡 Astuce Postman

Crée une **collection "Santé Sénégal"** avec :

1. **Variables d'environnement** :
   - `baseUrl` = `http://localhost:3000/api/v1`
   - `accessToken` = (vide au début)
   - `refreshToken` = (vide au début)

2. Dans la requête **Login**, ajoute un **Script onglet "Tests"** :
   ```javascript
   const data = pm.response.json();
   if (data.data?.accessToken) {
     pm.environment.set('accessToken', data.data.accessToken);
     pm.environment.set('refreshToken', data.data.refreshToken);
   }
   ```

3. Dans les routes protégées, mets dans l'header :
   ```
   Authorization: Bearer {{accessToken}}
   ```

Comme ça, dès que tu te logges, le token est mémorisé pour toutes les requêtes suivantes 🚀

---

**Tu es prêt à tester !** Lance ton serveur et vas-y.
