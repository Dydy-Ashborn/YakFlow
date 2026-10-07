// YAKFLOW_LICENCE_LOCALE_V1 : licences de la version locale (vendue). Un appel par client et par mois.
import { createECDH, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import Stripe from 'stripe';

export const DAY = 24 * 60 * 60 * 1000;
const MANUAL_PERIOD = 31 * DAY, PAST_DUE_GRACE = 3 * DAY, OWNER_PERIOD = 3650 * DAY;

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Clé de signature ECDSA P-256 : variable Netlify LICENSE_SIGNING_KEY (43 caractères, la partie privée « d »).
let keyObject = null;
function signingKey() {
  if (keyObject) return keyObject;
  const d = String(process.env.LICENSE_SIGNING_KEY ?? '').trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(d)) throw new Error('LICENSE_SIGNING_KEY manque ou est invalide dans les variables Netlify.');
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(d, 'base64url'));
  const pub = ecdh.getPublicKey(); // 04 || x || y
  keyObject = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  return keyObject;
}

export function signLicense(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = sign('sha256', body, { key: signingKey(), dsaEncoding: 'ieee-p1363' });
  return b64u(body) + '.' + b64u(sig);
}

let stripeClient = null;
export function stripe() {
  const key = String(process.env.STRIPE_SECRET_KEY ?? '').trim();
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}
const periodEnd = (sub) => (sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? 0) * 1000;

// Jusqu'à quand cette copie peut tourner sans revenir. until = 0 : refusée.
export async function validUntil(record, now) {
  if (!record || record.active !== true) return { until: 0, message: 'Ce code est désactivé. Contacte le support YakFlow.' };
  if (record.type === 'owner') return { until: now + OWNER_PERIOD };
  if (record.type === 'trial') {
    const end = Date.parse(record.expiresAt || '') || 0;
    return end > now ? { until: end } : { until: 0, message: 'Ton essai YakFlow est terminé. Abonne-toi pour continuer.' };
  }
  if (record.stripeSubscriptionId) {
    const s = stripe();
    if (!s) return { until: now + MANUAL_PERIOD };
    const sub = await s.subscriptions.retrieve(record.stripeSubscriptionId);
    if (['active', 'trialing'].includes(sub.status)) return { until: Math.max(periodEnd(sub), now + DAY) };
    if (sub.status === 'past_due') return { until: now + PAST_DUE_GRACE };
    return { until: 0, message: 'Ton abonnement YakFlow est terminé. Réabonne-toi pour continuer.' };
  }
  if (record.expiresAt) {
    const end = Date.parse(record.expiresAt) || 0;
    return end > now ? { until: Math.min(end, now + MANUAL_PERIOD) } : { until: 0, message: 'Ce code a expiré.' };
  }
  return { until: now + MANUAL_PERIOD };
}

// Vérifie une licence signée (en-tête X-Yakflow-Token), sans aucune lecture Firestore.
const PUBLIC_KEY = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: 'HHa1M8_6PFwWynyMX96HgfOGhWCK1Uktq0Vcjn7HcKM', y: 'rMI-Y3kGNf8wSuOTHaQDpWpbMGHnfy838ogn8kEARRk' }, format: 'jwk' });
export function verifyToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const raw = Buffer.from(body, 'base64url');
    if (!verify('sha256', raw, { key: PUBLIC_KEY, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))) return null;
    const lic = JSON.parse(raw.toString('utf8'));
    return lic && lic.u && Date.now() < lic.u + 3 * DAY ? lic : null;
  } catch { return null; }
}
