// POST /.netlify/functions/licence  {code, machine, version}
// Activation (1re fois : le code est lié à l'ordinateur) puis renouvellement mensuel d'une copie locale de YakFlow.
import { FieldValue } from 'firebase-admin/firestore';
import { codeId, normalizeCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { signLicense, validUntil } from '../lib/licence-locale.mjs';
import { json, smallJson } from '../lib/http.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Méthode refusée.' }, 405);
  let body;
  try { body = await smallJson(request, 2048); } catch { return json({ ok: false, message: 'Requête invalide.' }, 400); }
  const code = normalizeCode(body.code), machine = String(body.machine ?? '');
  if (!/^YKF[A-Z2-9]{20}$/.test(code)) return json({ ok: false, message: 'Code invalide. Vérifie qu’il commence par YKF-.' }, 400);
  if (!/^[a-f0-9]{32,64}$/.test(machine)) return json({ ok: false, message: 'Identifiant d’ordinateur invalide. Mets YakFlow à jour.' }, 400);
  try {
    const id = codeId(code), ref = licenses().doc(id), now = Date.now();
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, message: 'Code inconnu. Vérifie qu’il est bien recopié.' }, 403);
    const record = snap.data();
    if (record.machine && record.machine !== machine) return json({ ok: false, message: 'Ce code est déjà activé sur un autre ordinateur ou navigateur. Pour changer, contacte le support YakFlow.' }, 409);
    const { until, message } = await validUntil(record, now);
    if (!until) return json({ ok: false, message }, 403);
    const update = { lastCheckAt: new Date(now).toISOString(), validUntil: new Date(until).toISOString(), checks: FieldValue.increment(1), appVersion: String(body.version ?? '').slice(0, 20) };
    if (!record.machine) {
      const bound = await ref.firestore.runTransaction(async (tx) => {
        const cur = (await tx.get(ref)).data();
        if (cur.machine && cur.machine !== machine) return false;
        tx.update(ref, { ...update, machine, machineBoundAt: new Date(now).toISOString() });
        return true;
      });
      if (!bound) return json({ ok: false, message: 'Ce code vient d’être activé sur un autre ordinateur ou navigateur.' }, 409);
    } else await ref.update(update);
    const token = signLicense({ v: 1, id, m: machine, t: record.type, u: until, i: now, e: record.email || '' });
    return json({ ok: true, token, type: record.type, until });
  } catch (error) {
    console.error('licence:', error.code, error.message);
    return json({ ok: false, temp: true, message: 'Vérification momentanément indisponible. Réessaie dans quelques minutes.' }, 503);
  }
}
