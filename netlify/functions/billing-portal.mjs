// YAKFLOW_STRIPE_BILLING_PORTAL_V1
// Opens a personal Stripe Billing Portal for the Stripe customer bound to an activated YakFlow licence.
// Never trust an email, customer ID or return URL supplied by the browser.
import { codeId, normalizeCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { stripe, verifyToken } from '../lib/licence-locale.mjs';
import { json, smallJson } from '../lib/http.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ message: 'Méthode refusée.' }, 405);
  let body;
  try { body = await smallJson(request, 2048); }
  catch { return json({ message: 'Requête invalide.' }, 400); }
  const code = normalizeCode(body.code);
  const machine = String(body.machine ?? '');
  const token = request.headers.get('X-Yakflow-Token') ?? '';
  const lic = verifyToken(token);
  if (!/^YKF[A-Z2-9]{20}$/.test(code) || !/^[a-f0-9]{32,64}$/.test(machine)
      || !lic || lic.id !== codeId(code) || lic.m !== machine || lic.u <= Date.now()) {
    return json({ message: 'Réactive ta licence YakFlow pour gérer ton abonnement.' }, 403);
  }
  try {
    const snap = await licenses().doc(lic.id).get();
    if (!snap.exists) return json({ message: 'Licence introuvable.' }, 404);
    const r = snap.data();
    if (!r.active || !r.machine || r.machine !== machine) {
      return json({ message: 'Licence inactive ou non liée à ce navigateur.' }, 403);
    }
    if (!r.stripeCustomerId || !r.stripeSubscriptionId) {
      return json({ message: 'Ce code n’est pas lié à un abonnement Stripe. Pour un code offert ou manuel, il n’y a aucun prélèvement à résilier depuis YakFlow.' }, 409);
    }
    const client = stripe();
    if (!client) return json({ message: 'Stripe n’est pas configuré sur YakFlow.' }, 503);
    // Validate the stored subscription really belongs to the stored customer.
    const sub = await client.subscriptions.retrieve(r.stripeSubscriptionId);
    const subCustomer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (subCustomer !== r.stripeCustomerId) return json({ message: 'Association abonnement/client incorrecte. Contacte le support.' }, 409);
    const configured = String(process.env.YAKFLOW_SITE_URL || '').trim();
    const origin = configured ? new URL(configured).origin : new URL(request.url).origin;
    if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
      return json({ message: 'Adresse publique YakFlow non sécurisée. Configure YAKFLOW_SITE_URL.' }, 503);
    }
    const args = { customer: r.stripeCustomerId, return_url: origin + '/studio.html' };
    const portalConfig = String(process.env.STRIPE_PORTAL_CONFIGURATION_ID || '').trim();
    if (portalConfig) args.configuration = portalConfig;
    const session = await client.billingPortal.sessions.create(args);
    return json({ ok: true, url: session.url });
  } catch (e) {
    console.error('billing-portal:', e.type || e.code || 'error', e.message);
    return json({ message: 'Impossible d’ouvrir Stripe. Vérifie que le portail client est activé dans Stripe, puis réessaie.' }, 503);
  }
}
