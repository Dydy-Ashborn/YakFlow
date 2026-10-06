import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { checkLicense } from '../lib/firebase.mjs';
import { codeId } from '../lib/license-core.mjs';
import { json, smallJson } from '../lib/http.mjs';
import { getFirestore } from 'firebase-admin/firestore';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const media = () => getStore({ name: 'yakflow-media', consistency: 'strong' });
const account = owner => getFirestore().collection('yakflowAccounts').doc(owner);
const jobs = (owner, kind) => account(owner).collection(kind === 'grok' ? 'grokJobs' : 'chatJobs');
const workers = (owner, kind) => account(owner).collection(kind === 'grok' ? 'grokWorkers' : 'chatWorkers');
const jobRef = (owner, kind, id) => jobs(owner, kind).doc(hash(id));
const payloadKey = (owner, kind, id) => `${owner}/${kind}/${hash(id)}/payload`;
const resultKey = (owner, kind, id) => `${owner}/${kind}/${hash(id)}/result`;
const chunkKey = (owner, id, n) => `${owner}/grok/${hash(id)}/chunk-${n}`;
const maxBody = 5_000_000;

async function bodyJson(request) { return smallJson(request, maxBody); }
async function workerStatus(owner, kind) {
  const snapshot = await workers(owner, kind).limit(30).get();
  const current = Date.now();
  return snapshot.docs.map(doc => doc.data()).filter(item => current - (item.seenAt || 0) < 30_000);
}
async function heartbeat(owner, kind, worker, info = '') {
  if (!worker || worker.length > 100) return;
  await workers(owner, kind).doc(hash(worker)).set({ seenAt: Date.now(), info: String(info).slice(0, 200) });
}
async function waiting(owner, kind) {
  const snapshot = await jobs(owner, kind).where('st', '==', 'attente').limit(40).get();
  return snapshot.docs.sort((a, b) => (a.data().createdAt || 0) - (b.data().createdAt || 0));
}
async function expireIfStale(snapshot, kind) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data();
  if (data.st !== 'en cours' || Date.now() - (data.claimedAt || 0) <= 30 * 60_000) return data;
  const update = {
    st: kind === 'grok' ? 'echec' : 'incertain',
    error: 'Le pont navigateur ne répond plus depuis 30 minutes. Vérifie son onglet avant de relancer.',
    finishedAt: Date.now(),
  };
  await snapshot.ref.update(update);
  return { ...data, ...update };
}
async function publicJob(owner, kind, id) {
  return JSON.parse(await media().get(payloadKey(owner, kind, id)) || 'null');
}

async function run(request) {
  const state = await checkLicense(request.headers.get('X-Yakflow-License'));
  if (!state.valid) return json({ detail: state.message }, 403);
  const owner = codeId(request.headers.get('X-Yakflow-License'));
  const url = new URL(request.url);
  const match = url.pathname.match(/\/(?:cloud-bridge\/)?(bridge|grok)\/([a-z-]+)$/);
  if (!match) return json({ detail: 'Action inconnue.' }, 404);
  const [, kind, action] = match;
  const id = url.searchParams.get('id') || '';
  const worker = url.searchParams.get('worker') || '';
  const info = url.searchParams.get('info') || '';
  const ref = id ? jobRef(owner, kind, id) : null;
  const store = media();

  if (action === 'status' && request.method === 'GET') {
    const live = await workerStatus(owner, kind);
    if (kind === 'grok') {
      const pending = await waiting(owner, kind);
      return json({ alive: live.length > 0, workers: live.length, pending: pending.length, running: 0 });
    }
    const job = ref ? await ref.get() : null;
    const data = await expireIfStale(job, kind);
    const output = { protocol: 2, alive: live.length > 0, workers: live.length, info: live[0]?.info || '' };
    if (data) Object.assign(output, { st: data.st, error: data.error || '', pos: 0,
      data: data.st === 'fini' ? await store.get(resultKey(owner, kind, id)) : null });
    return json(output);
  }
  if (action === 'job' && kind === 'grok' && request.method === 'GET') {
    const snap = await ref.get();
    if (!snap.exists) return json({ detail: 'Travail Grok introuvable.' }, 404);
    const data = await expireIfStale(snap, kind);
    return json({ id, st: data.st, worker: data.worker || '', error: data.error || '', pos: 0, chunks: data.chunks || 0 });
  }
  if (action === 'push' && request.method === 'POST') {
    const data = await bodyJson(request);
    if (!data?.id || !data?.prompt || (kind === 'grok' && !data.image)) return json({ detail: 'Travail invalide.' }, 400);
    const jid = String(data.id).slice(0, 200);
    const same = await jobRef(owner, kind, jid).get();
    const fingerprint = hash(JSON.stringify(data));
    if (same.exists && same.data().fingerprint === fingerprint && ['attente', 'en cours', 'fini'].includes(same.data().st)) {
      return json({ ok: true, deja: true, st: same.data().st });
    }
    await store.set(payloadKey(owner, kind, jid), JSON.stringify(data));
    await jobRef(owner, kind, jid).set({ id: jid, st: 'attente', fingerprint, createdAt: Date.now(), worker: '', error: '' });
    return json({ ok: true, pos: 1 });
  }
  if (action === 'forget' && request.method === 'POST') {
    if (ref) {
      const snap = await ref.get();
      if (snap.exists) {
        await ref.set({ st: 'oublie', forgottenAt: Date.now() }, { merge: true });
        if (['fini', 'echec'].includes(snap.data().st)) {
          await Promise.allSettled([store.delete(payloadKey(owner, kind, id)), store.delete(resultKey(owner, kind, id))]);
        }
      }
    }
    return json({ ok: true });
  }
  if (['hello', 'heartbeat'].includes(action) && request.method === 'POST') {
    await heartbeat(owner, kind, worker, info); return json({ ok: true });
  }
  if (action === 'peek' && kind === 'bridge' && request.method === 'GET') {
    await heartbeat(owner, kind, worker, info);
    const list = await waiting(owner, kind);
    return json({ job: list.length ? await publicJob(owner, kind, list[0].data().id) : null });
  }
  if (action === 'take' && request.method === 'POST') {
    if (!worker) return json({ detail: 'Onglet inconnu.' }, 400);
    await heartbeat(owner, kind, worker, info);
    for (const candidate of await waiting(owner, kind)) {
      const claimed = await getFirestore().runTransaction(async transaction => {
        const fresh = await transaction.get(candidate.ref);
        if (fresh.data()?.st !== 'attente') return false;
        transaction.update(candidate.ref, { st: 'en cours', worker, claimedAt: Date.now() });
        return true;
      });
      if (claimed) return json({ job: await publicJob(owner, kind, candidate.data().id) });
    }
    return json({ job: null });
  }
  if (action === 'result' && kind === 'bridge' && request.method === 'POST') {
    const data = await bodyJson(request);
    if (!data?.id) return json({ detail: 'Travail inconnu.' }, 400);
    const r = jobRef(owner, kind, data.id), snap = await r.get();
    if (!snap.exists) return json({ detail: 'Travail inconnu.' }, 404);
    if (snap.data().worker && snap.data().worker !== worker) return json({ detail: 'Autre onglet propriétaire.' }, 409);
    if (snap.data().st === 'oublie') return json({ ok: true, ignore: true });
    if (data.data) {
      await store.set(resultKey(owner, kind, data.id), String(data.data));
      await r.update({ st: 'fini', finishedAt: Date.now(), error: '' });
    } else await r.update({ st: 'echec', finishedAt: Date.now(), error: String(data.error || 'Erreur ChatGPT').slice(0, 500) });
    return json({ ok: true });
  }
  if (action === 'fail' && kind === 'grok' && request.method === 'POST') {
    const data = await bodyJson(request), r = jobRef(owner, kind, data.id);
    const snap = await r.get();if (!snap.exists) return json({ detail: 'Travail inconnu.' }, 404);
    if (snap.data().worker && snap.data().worker !== worker) return json({ detail: 'Autre onglet propriétaire.' }, 409);
    await r.update({ st: 'echec', error: String(data.error || 'Erreur Grok').slice(0, 500), finishedAt: Date.now() });
    return json({ ok: true });
  }
  if (action === 'result-chunk' && kind === 'grok' && request.method === 'POST') {
    const part = Number(url.searchParams.get('part')), total = Number(url.searchParams.get('total'));
    if (!id || !Number.isInteger(part) || part < 0 || !Number.isInteger(total) || total < 1 || total > 100 || part >= total) return json({ detail: 'Fragment invalide.' }, 400);
    const snap = await ref.get();if (!snap.exists || snap.data().worker !== worker) return json({ detail: 'Travail non attribué à cet onglet.' }, 403);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 3_500_000) return json({ detail: 'Fragment trop volumineux.' }, 413);
    const bytes = await request.arrayBuffer();if (bytes.byteLength > 3_500_000) return json({ detail: 'Fragment trop volumineux.' }, 413);
    await store.set(chunkKey(owner, id, part), bytes);
    await ref.set({ chunks: total }, { merge: true });
    return json({ ok: true });
  }
  if (action === 'result-complete' && kind === 'grok' && request.method === 'POST') {
    const snap = await ref.get();if (!snap.exists || snap.data().worker !== worker) return json({ detail: 'Travail non attribué à cet onglet.' }, 403);
    const total = snap.data().chunks || 0;if (!total) return json({ detail: 'Aucun fragment vidéo.' }, 400);
    for (let part = 0; part < total; part++) if (!(await store.getWithMetadata(chunkKey(owner, id, part)))) return json({ detail: 'Fragment vidéo manquant.' }, 400);
    await ref.update({ st: 'fini', finishedAt: Date.now() });return json({ ok: true, chunks: total });
  }
  if (action === 'file' && kind === 'grok' && request.method === 'GET') {
    const part = Number(url.searchParams.get('part'));
    const snap = await ref.get();if (!snap.exists || snap.data().st !== 'fini') return json({ detail: 'Vidéo non disponible.' }, 404);
    if (!Number.isInteger(part) || part < 0 || part >= snap.data().chunks) return json({ detail: 'Fragment inconnu.' }, 400);
    const bytes = await store.get(chunkKey(owner, id, part), { type: 'arrayBuffer' });
    if (!bytes) return json({ detail: 'Fragment manquant.' }, 404);
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
  }
  if (action === 'ack' && kind === 'grok' && request.method === 'POST') {
    const snap = await ref.get();if (!snap.exists || snap.data().st !== 'fini') return json({ detail: 'Vidéo non disponible.' }, 404);
    const keys = Array.from({ length: snap.data().chunks || 0 }, (_, part) => chunkKey(owner, id, part));
    keys.push(payloadKey(owner, kind, id));
    await Promise.allSettled(keys.map(key => store.delete(key)));
    await ref.update({ st: 'recu', receivedAt: Date.now() });
    return json({ ok: true });
  }
  return json({ detail: 'Action inconnue.' }, 404);
}

export default async function handler(request) {
  try { return await run(request); }
  catch (error) { console.error('cloud-bridge:', error.message); return json({ detail: 'Pont en ligne indisponible.' }, 503); }
}
