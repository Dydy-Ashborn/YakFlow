import { createHash, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codeId(value) {
  return createHash('sha256').update(normalizeCode(value)).digest('hex');
}

export function newCode() {
  const bytes = randomBytes(20);
  const raw = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `YKF-${raw.match(/.{5}/g).join('-')}`;
}

export function licenseState(record, at = Date.now()) {
  if (!record || record.active !== true) return { valid: false, message: 'Code invalide ou désactivé.' };
  if (record.expiresAt && Date.parse(record.expiresAt) <= at) {
    return { valid: false, message: 'Ce code d’essai a expiré.' };
  }
  return { valid: true, type: record.type, expiresAt: record.expiresAt ?? null };
}
