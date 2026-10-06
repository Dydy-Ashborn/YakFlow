import { timingSafeEqual } from 'node:crypto';
import { codeId, newCode, normalizeCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { json, smallJson } from '../lib/http.mjs';

function isAdmin(request) {
  const expected = process.env.YAKFLOW_ADMIN_SECRET ?? '';
  const supplied = request.headers.get('X-Yakflow-Admin') ?? '';
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (b.length < 32 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ message: 'Méthode refusée.' }, 405);
  if (!isAdmin(request)) return json({ message: 'Accès administrateur refusé.' }, 401);
  try {
    const body = await smallJson(request);
    const action = String(body.action ?? 'create');
    const store = licenses();
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const type = body.type === 'trial' ? 'trial' : body.type === 'premium' ? 'premium' : '';
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
      if (action === 'deactivate') await ref.update({ active: false, deactivatedAt: new Date().toISOString() });
      return json({ email: snap.data().email, type: snap.data().type, active: action === 'deactivate' ? false : snap.data().active, expiresAt: snap.data().expiresAt });
    }
    if (action === 'deactivate-email') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: 'Email invalide.' }, 400);
      const snap = await store.where('email', '==', email).limit(30).get();
      const premium = snap.docs.filter(doc => doc.data().type === 'premium' && doc.data().active === true);
      if (!premium.length) return json({ message: 'Aucun code premium actif pour cet email.' }, 404);
      const batch = store.firestore.batch();
      for (const doc of premium) batch.update(doc.ref, { active: false, deactivatedAt: new Date().toISOString() });
      await batch.commit();
      return json({ email, deactivated: premium.length });
    }
    return json({ message: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('admin-license:', error.message);
    return json({ message: 'Opération impossible. Vérifie la configuration Firebase.' }, 503);
  }
}
