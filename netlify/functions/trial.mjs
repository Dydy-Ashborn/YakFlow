// POST /.netlify/functions/trial  {email, machine, version}
// Essai gratuit 24 h en libre-service depuis l'écran d'accueil de YakFlow : un essai par ordinateur et par email.
import { codeId, newCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { DAY, signLicense } from '../lib/licence-locale.mjs';
import { json, smallJson } from '../lib/http.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Méthode refusée.' }, 405);
  let body;
  try { body = await smallJson(request, 2048); } catch { return json({ ok: false, message: 'Requête invalide.' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase(), machine = String(body.machine ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ ok: false, message: 'Entre une adresse email valide.' }, 400);
  if (!/^[a-f0-9]{32,64}$/.test(machine)) return json({ ok: false, message: 'Identifiant d’ordinateur invalide. Mets YakFlow à jour.' }, 400);
  try {
    const db = licenses().firestore, trials = db.collection('yakflowTrials');
    const byMachine = trials.doc('m-' + machine), byEmail = trials.doc('e-' + codeId(email));
    const now = Date.now(), expiresAt = new Date(now + DAY).toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode(), id = codeId(code);
      try {
        const out = await db.runTransaction(async (tx) => {
          const [m, e] = await Promise.all([tx.get(byMachine), tx.get(byEmail)]);
          if (m.exists || e.exists) return { used: true };
          tx.create(licenses().doc(id), { type: 'trial', email, active: true, createdAt: new Date(now).toISOString(), expiresAt, machine, machineBoundAt: new Date(now).toISOString(), note: 'Essai libre-service' });
          tx.create(byMachine, { email, at: new Date(now).toISOString() });
          tx.create(byEmail, { machine, at: new Date(now).toISOString() });
          return { used: false };
        });
        if (out.used) return json({ ok: false, message: 'L’essai gratuit a déjà été utilisé sur cet ordinateur ou avec cet email. Abonne-toi pour continuer.' }, 409);
        const until = now + DAY;
        const token = signLicense({ v: 1, id, m: machine, t: 'trial', u: until, i: now, e: email });
        return json({ ok: true, code, token, type: 'trial', until });
      } catch (error) { if (error.code !== 6) throw error; }
    }
    return json({ ok: false, message: 'Impossible de créer l’essai. Réessaie.' }, 500);
  } catch (error) {
    console.error('trial:', error.code, error.message);
    return json({ ok: false, temp: true, message: 'Essai momentanément indisponible. Réessaie dans quelques minutes.' }, 503);
  }
}
