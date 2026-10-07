import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { codeId, newCode, normalizeCode } from '../lib/license-core.mjs';
import { forgetLicense, licenses } from '../lib/firebase.mjs';
import { json, smallJson } from '../lib/http.mjs';

function isAdmin(request) {
  const expected = process.env.YAKFLOW_ADMIN_SECRET ?? '';
  const supplied = request.headers.get('X-Yakflow-Admin') ?? '';
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (b.length < 32 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// YAKFLOW_ADMIN_CORS_V14 : le site d'administration séparé (autre dépôt, autre domaine) appelle cette fonction.
// Origines autorisées : variable Netlify YAKFLOW_ADMIN_ORIGINS (ex. https://yakflow-admin.netlify.app), séparées par des virgules.
function corsHeaders(request) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = String(process.env.YAKFLOW_ADMIN_ORIGINS ?? '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Yakflow-Admin',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export default async function handler(request) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
  const response = await handle(request);
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

async function handle(request) {
  if (request.method !== 'POST') return json({ message: 'Méthode refusée.' }, 405);
  if (!isAdmin(request)) return json({ message: 'Accès administrateur refusé.' }, 401);
  try {
    const body = await smallJson(request);
    const action = String(body.action ?? 'create');
    const store = licenses();
    if (action === 'whoami') return json({ ok: true });
    if (action === 'list') {
      // 100 derniers codes, sans le code lui-même (seule son empreinte est stockée)
      const snap = await store.orderBy('createdAt', 'desc').limit(100).get();
      return json({ items: snap.docs.map((doc) => { const r = doc.data(); return { id: doc.id, email: r.email, type: r.type, active: r.active === true, createdAt: r.createdAt, expiresAt: r.expiresAt ?? null, deactivatedAt: r.deactivatedAt ?? null, note: r.note ?? '', machine: r.machine ? r.machine.slice(0, 8) : '', lastCheckAt: r.lastCheckAt ?? null, validUntil: r.validUntil ?? null, stripe: !!r.stripeSubscriptionId }; }) });
    }
    if (action === 'reset-machine') {
      const id = String(body.id ?? '');
      if (!/^[a-f0-9]{64}$/.test(id)) return json({ message: 'Identifiant invalide.' }, 400);
      const ref = store.doc(id), snap = await ref.get();
      if (!snap.exists) return json({ message: 'Code introuvable.' }, 404);
      await ref.update({ machine: FieldValue.delete(), machineBoundAt: FieldValue.delete(), machineResetAt: new Date().toISOString() });
      return json({ id, email: snap.data().email, reset: true });
    }
    if (action === 'deactivate-id' || action === 'reactivate-id') {
      const id = String(body.id ?? '');
      if (!/^[a-f0-9]{64}$/.test(id)) return json({ message: 'Identifiant invalide.' }, 400);
      const ref = store.doc(id), snap = await ref.get();
      if (!snap.exists) return json({ message: 'Code introuvable.' }, 404);
      if (action === 'deactivate-id') await ref.update({ active: false, deactivatedAt: new Date().toISOString() });
      else await ref.update({ active: true, deactivatedAt: null });
      await forgetLicense(id);
      return json({ id, email: snap.data().email, active: action === 'reactivate-id' });
    }
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const type = ['trial', 'premium', 'owner'].includes(body.type) ? body.type : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !type) return json({ message: 'Email ou type de code invalide.' }, 400);
      const createdAt = new Date();
      const expiresAt = type === 'trial' ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = newCode();
        const record = {
          type, email, active: true, createdAt: createdAt.toISOString(), expiresAt,
          note: String(body.note ?? '').slice(0, 300),
        };
        try {
          await store.doc(codeId(code)).create(record);
          await forgetLicense(codeId(code));
          return json({ code, email, type, createdAt: record.createdAt, expiresAt });
        } catch (error) {
          if (error.code !== 6) throw error;
        }
      }
      return json({ message: 'Impossible de générer un code unique.' }, 500);
    }
    if (action === 'deactivate' || action === 'lookup') {
      const code = normalizeCode(body.code);
      if (!/^YKF[A-Z2-9]{20}$/.test(code)) return json({ message: 'Format de code invalide.' }, 400);
      const ref = store.doc(codeId(code));
      const snap = await ref.get();
      if (!snap.exists) return json({ message: 'Code introuvable.' }, 404);
      if (action === 'deactivate') { await ref.update({ active: false, deactivatedAt: new Date().toISOString() }); await forgetLicense(codeId(code)); }
      return json({ email: snap.data().email, type: snap.data().type, active: action === 'deactivate' ? false : snap.data().active, expiresAt: snap.data().expiresAt });
    }
    if (action === 'deactivate-email') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: 'Email invalide.' }, 400);
      const snap = await store.where('email', '==', email).limit(30).get();
      const premium = snap.docs.filter(doc => doc.data().type !== 'trial' && doc.data().type !== 'owner' && doc.data().active === true);
      if (!premium.length) return json({ message: 'Aucun code premium actif pour cet email.' }, 404);
      const batch = store.firestore.batch();
      for (const doc of premium) batch.update(doc.ref, { active: false, deactivatedAt: new Date().toISOString() });
      await batch.commit();
      for (const doc of premium) await forgetLicense(doc.id);
      return json({ email, deactivated: premium.length });
    }
    return json({ message: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('admin-license:', error.code, error.message);
    return json({ message: firebaseHint(error) }, 503);
  }
}

// YAKFLOW_FIREBASE_DIAG_V14 : message précis réservé à l'admin (déjà authentifié par la clé secrète)
function firebaseHint(error) {
  const m = String(error?.message ?? ''), c = error?.code;
  if (/FIREBASE_SERVICE_ACCOUNT_JSON manque/.test(m)) return 'Firebase : la variable FIREBASE_SERVICE_ACCOUNT_JSON est absente sur Netlify (ou le site n’a pas été redéployé après son ajout).';
  if (error instanceof SyntaxError || /JSON/.test(m)) return 'Firebase : FIREBASE_SERVICE_ACCOUNT_JSON n’est pas un JSON valide. Colle le contenu complet du fichier .json du compte de service, de { à }.';
  if (/Projet Firebase inattendu/.test(m)) return 'Firebase : le compte de service appartient à un autre projet que yakflow-e4d30.';
  if (/private key|PEM|DECODER|asn1/i.test(m)) return 'Firebase : la clé privée du compte de service est abîmée (retours à la ligne). Recolle le fichier .json tel quel.';
  if (c === 5 || /NOT_FOUND|does not exist/i.test(m)) return 'Firebase : aucune base Firestore dans le projet yakflow-e4d30. Crée-la dans la console Firebase (Firestore Database, mode natif).';
  if (c === 7 || /PERMISSION_DENIED|permission/i.test(m)) return 'Firebase : le compte de service n’a pas le droit d’écrire dans Firestore. Donne-lui le rôle « Cloud Datastore User » (ou génère la clé depuis Paramètres du projet > Comptes de service).';
  if (c === 16 || /UNAUTHENTICATED|invalid_grant|revoked/i.test(m)) return 'Firebase : la clé du compte de service est refusée (supprimée ou expirée). Génère une nouvelle clé privée et remplace la variable.';
  if (c === 8 || /RESOURCE_EXHAUSTED|quota/i.test(m)) return 'Firebase : quota gratuit Firestore dépassé pour aujourd’hui (50 000 lectures/jour). Il se remet à zéro vers 9 h (heure de Paris). Le cache de licence V16 évite que ça se reproduise.';
  if (c === 9 || /FAILED_PRECONDITION|Datastore Mode/i.test(m)) return 'Firebase : Firestore est en mode Datastore ou un index manque. Il faut une base Firestore en mode natif.';
  return 'Firebase : opération impossible (' + (c ?? 'erreur') + ' — ' + m.slice(0, 160) + ').';
}
