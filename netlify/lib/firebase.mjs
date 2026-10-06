import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { codeId, licenseState, normalizeCode } from './license-core.mjs';

function app() {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON manque dans les variables Netlify.');
  const account = JSON.parse(json.trim());
  if (typeof account.private_key === 'string') account.private_key = account.private_key.replace(/\\n/g, '\n');
  if (account.project_id !== 'yakflow-e4d30') throw new Error('Projet Firebase inattendu.');
  return initializeApp({ credential: cert(account), projectId: account.project_id });
}

export function licenses() {
  return getFirestore(app()).collection('yakflowLicenses');
}

export async function checkLicense(code) {
  const value = normalizeCode(code);
  if (!/^YKF[A-Z2-9]{20}$/.test(value)) return { valid: false, message: 'Code invalide.' };
  const snap = await licenses().doc(codeId(value)).get();
  return licenseState(snap.exists ? snap.data() : null);
}
