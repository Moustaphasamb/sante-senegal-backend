import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Génère un code OTP de 6 chiffres aléatoire et sécurisé
 */
export const generateOtpCode = (): string => {
  // crypto.randomInt est cryptographiquement sécurisé
  const code = crypto.randomInt(0, 1000000);
  return code.toString().padStart(6, '0');
};

/**
 * Hash un code OTP pour stockage en DB (jamais en clair)
 */
export const hashOtpCode = async (code: string): Promise<string> => {
  return bcrypt.hash(code, 10);
};

/**
 * Vérifie un code OTP en clair contre son hash
 */
export const verifyOtpCode = async (
  code: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(code, hash);
};

/**
 * Normalise un numéro de téléphone sénégalais.
 * Accepte différents formats :
 * - 771234567       → +221771234567
 * - +221771234567   → +221771234567
 * - 221771234567    → +221771234567
 * - 00221771234567  → +221771234567
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
  // Retirer espaces, tirets, parenthèses
  let normalized = phoneNumber.replace(/[\s\-()]/g, '');

  // Cas : commence par 00
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.substring(2);
  }

  // Cas : commence par 221 (sans +)
  if (normalized.startsWith('221') && !normalized.startsWith('+221')) {
    normalized = '+' + normalized;
  }

  // Cas : commence directement par 7 (numéro sénégalais sans indicatif)
  if (/^[7][0-9]{8}$/.test(normalized)) {
    normalized = '+221' + normalized;
  }

  return normalized;
};

/**
 * Vérifie qu'un numéro est bien un numéro sénégalais valide
 * Formats acceptés après normalisation : +221[7][0-9]{8}
 */
export const isValidSenegalPhoneNumber = (phoneNumber: string): boolean => {
  const normalized = normalizePhoneNumber(phoneNumber);
  return /^\+221[7][0-9]{8}$/.test(normalized);
};
