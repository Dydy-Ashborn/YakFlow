// POST /.netlify/functions/trial  {email, machine, version}
// Essai gratuit 24 h en libre-service depuis l'écran d'accueil de YakFlow : un essai par ordinateur et par email.
import { createHash } from 'node:crypto';
import { codeId, newCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { DAY, signLicense } from '../lib/licence-locale.mjs';
import { json, smallJson } from '../lib/http.mjs';

// YAKFLOW_TRIAL_IP_V1 : un essai par navigateur, par email ET par adresse IP (30 jours)
const IP_WINDOW = 30 * DAY;
function clientIp(request, context) {
  return String(context?.ip || request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim();
}
const ipKey = (ip) => 'i-' + createHash('sha256').update('yakflow-essai|' + ip).digest('hex').slice(0, 40);


// YAKFLOW_TRIAL_EMAIL_V1 : alias ramenés à la même adresse, emails jetables refusés
const DISPOSABLE = new Set(('yopmail.com yopmail.fr yopmail.net cool.fr.nf jetable.fr.nf nospam.ze.tc nomail.xl.cx mega.zik.dj speed.1s.fr courriel.fr.nf moncourrier.fr.nf monemail.fr.nf monmail.fr.nf '
  + 'mailinator.com guerrillamail.com guerrillamail.net guerrillamail.org guerrillamailblock.com sharklasers.com grr.la pokemail.net spam4.me '
  + 'temp-mail.org temp-mail.io tempmail.com tempmail.net tempmailo.com tempmail.plus tempr.email tmpmail.org tmpmail.net tmails.net '
  + '10minutemail.com 10minutemail.net 10minmail.com 20minutemail.com minuteinbox.com dropmail.me emailondeck.com getnada.com nada.email '
  + 'trashmail.com trashmail.de trashmail.fr mailnesia.com maildrop.cc mohmal.com throwawaymail.com fakeinbox.com mailcatch.com '
  + 'mintemail.com mytemp.email burnermail.io discard.email spamgourmet.com jetable.org mail-temp.com tempinbox.com inboxkitten.com '
  + 'emailfake.com fakemail.net luxusmail.org mailpoof.com 1secmail.com 1secmail.net 1secmail.org esiix.com wwjmp.com xojxe.com yoggm.com '
  + 'crazymailing.com etempmail.net tempail.com mail.tm mailto.plus fexpost.com fexbox.org rover.info chitthi.in byom.de').split(/\s+/));
function canonicalEmail(email) {
  let [user, domain] = email.split('@');
  if (domain === 'googlemail.com') domain = 'gmail.com';
  user = user.split('+')[0];
  if (domain === 'gmail.com') user = user.replace(/\./g, '');
  return user + '@' + domain;
}

export default async function handler(request, context) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Méthode refusée.' }, 405);
  let body;
  try { body = await smallJson(request, 2048); } catch { return json({ ok: false, message: 'Requête invalide.' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase(), machine = String(body.machine ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ ok: false, message: 'Entre une adresse email valide.' }, 400);
  const domain = email.split('@')[1];
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith('.' + d))) return json({ ok: false, message: 'Les adresses email temporaires ne sont pas acceptées pour l’essai. Utilise ton email habituel.' }, 400);
  if (!/^[a-f0-9]{32,64}$/.test(machine)) return json({ ok: false, message: 'Identifiant d’ordinateur invalide. Mets YakFlow à jour.' }, 400);
  try {
    const db = licenses().firestore, trials = db.collection('yakflowTrials');
    const ip = clientIp(request, context);
    const byMachine = trials.doc('m-' + machine), byEmail = trials.doc('e-' + codeId(canonicalEmail(email))), byIp = ip ? trials.doc(ipKey(ip)) : null;
    const now = Date.now(), expiresAt = new Date(now + DAY).toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode(), id = codeId(code);
      try {
        const out = await db.runTransaction(async (tx) => {
          const [m, e, i] = await Promise.all([tx.get(byMachine), tx.get(byEmail), byIp ? tx.get(byIp) : null]);
          if (m.exists || e.exists) return { used: true };
          if (i && i.exists && now - Date.parse(i.data().at || 0) < IP_WINDOW) return { used: true };
          tx.create(licenses().doc(id), { type: 'trial', email, active: true, createdAt: new Date(now).toISOString(), expiresAt, machine, machineBoundAt: new Date(now).toISOString(), note: 'Essai libre-service' });
          tx.create(byMachine, { email, at: new Date(now).toISOString() });
          tx.create(byEmail, { machine, at: new Date(now).toISOString() });
          if (byIp) tx.set(byIp, { at: new Date(now).toISOString() });
          return { used: false };
        });
        if (out.used) return json({ ok: false, message: 'L’essai gratuit a déjà été utilisé sur ce navigateur, avec cet email ou depuis cette connexion Internet. Abonne-toi pour continuer.' }, 409);
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
