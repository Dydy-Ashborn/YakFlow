import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStore } from '@netlify/blobs';
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

// YAKFLOW_LICENSE_CACHE_V16 : chaque appel du pont / des proxys vérifiait le code dans Firestore (1 lecture à chaque fois,
// toutes les 2 à 10 s) et épuisait le quota gratuit de 50 000 lectures/jour. On garde le résultat en cache :
// mémoire de l'instance (10 min) puis Netlify Blobs (15 min pour un code valide, 1 min pour un code refusé).
const MEM = new Map();
const OK_TTL = 15 * 60 * 1000, KO_TTL = 60 * 1000, MEM_TTL = 10 * 60 * 1000;
const cache = () => { try { return getStore({ name: 'yakflow-license-cache' }); } catch { return null; } };

async function readRecord(id) {
  const snap = await licenses().doc(id).get();
  return snap.exists ? snap.data() : null;
}

export async function checkLicense(code, { fresh = false } = {}) {
  const value = normalizeCode(code);
  if (!/^YKF[A-Z2-9]{20}$/.test(value)) return { valid: false, message: 'Code invalide.' };
  // YAKFLOW_OWNER_CODES_V16 : codes du propriétaire (variable Netlify YAKFLOW_OWNER_CODES, séparés par des virgules).
  // Toujours valides, sans lecture Firestore : l'accès d'Ash ne dépend ni du quota ni d'une panne Firebase.
  const owners = String(process.env.YAKFLOW_OWNER_CODES ?? '').split(',').map(normalizeCode).filter((c) => /^YKF[A-Z2-9]{20}$/.test(c));
  if (owners.includes(value)) return { valid: true, type: 'premium', expiresAt: null, owner: true };
  const id = codeId(value), now = Date.now();
  if (!fresh) {
    const m = MEM.get(id);
    if (m && now - m.at < MEM_TTL && now - m.at < (m.state.valid ? OK_TTL : KO_TTL)) return licenseState(m.record, now);
    const store = cache();
    if (store) {
      try {
        const b = await store.get(id, { type: 'json' });
        if (b && now - b.at < (b.record && b.record.active === true ? OK_TTL : KO_TTL)) { MEM.set(id, { at: b.at, record: b.record, state: licenseState(b.record, now) }); return licenseState(b.record, now); }
      } catch { /* cache indisponible : on lit Firestore */ }
    }
  }
  const record = await readRecord(id);
  const state = licenseState(record, now);
  MEM.set(id, { at: now, record, state });
  const store = cache();
  if (store) { try { await store.setJSON(id, { at: now, record }); } catch { /* sans gravité */ } }
  return state;
}

// À appeler quand l'admin active / désactive un code, pour que le changement soit pris en compte tout de suite.
export async function forgetLicense(id) {
  MEM.delete(id);
  const store = cache();
  if (store) { try { await store.delete(id); } catch { /* sans gravité */ } }
}
