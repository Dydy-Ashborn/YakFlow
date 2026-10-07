// GET /.netlify/functions/claim?session_id=cs_...  (page /merci après paiement Stripe)
// Crée le code du client une seule fois par paiement, puis le réaffiche si la page est rechargée.
import { codeId, newCode } from '../lib/license-core.mjs';
import { licenses } from '../lib/firebase.mjs';
import { stripe } from '../lib/licence-locale.mjs';
import { json } from '../lib/http.mjs';

export default async function handler(request) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return json({ ok: false, message: 'Lien de confirmation invalide.' }, 400);
  try {
    const db = licenses().firestore, checkouts = db.collection('yakflowCheckout');
    const known = await checkouts.doc(sessionId).get();
    if (known.exists) return json({ ok: true, code: known.data().code, email: known.data().email });
    const s = stripe();
    if (!s) return json({ ok: false, message: 'Paiement non configuré (STRIPE_SECRET_KEY).' }, 503);
    const session = await s.checkout.sessions.retrieve(sessionId);
    if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) return json({ ok: false, message: 'Paiement pas encore confirmé. Recharge la page dans un instant.' }, 402);
    const email = String(session.customer_details?.email || session.customer_email || '').toLowerCase();
    const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode();
      try {
        const out = await db.runTransaction(async (tx) => {
          const again = await tx.get(checkouts.doc(sessionId));
          if (again.exists) return again.data();
          tx.create(licenses().doc(codeId(code)), { type: subscription ? 'premium' : 'lifetime', email, active: true, createdAt: new Date().toISOString(), expiresAt: null, stripeSubscriptionId: subscription, stripeCustomerId: customer, stripeSessionId: sessionId, note: 'Stripe · paiement automatique' });
          const rec = { code, email, createdAt: new Date().toISOString() };
          tx.create(checkouts.doc(sessionId), rec);
          return rec;
        });
        return json({ ok: true, code: out.code, email: out.email });
      } catch (error) { if (error.code !== 6) throw error; }
    }
    return json({ ok: false, message: 'Impossible de créer ton code. Écris au support avec ton reçu Stripe.' }, 500);
  } catch (error) {
    console.error('claim:', error.code, error.message);
    return json({ ok: false, message: 'Confirmation momentanément indisponible. Recharge la page dans une minute.' }, 503);
  }
}
