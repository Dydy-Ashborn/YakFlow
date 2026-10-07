// YAKFLOW_BRIDGE_BLOBS_V16 : le pont en ligne (ChatGPT / Grok) ne stocke plus rien dans Firestore.
// Avant : chaque signal de vie et chaque « y a-t-il du travail ? » faisait des lectures/écritures Firestore
// (toutes les 2 à 10 s par onglet) et épuisait le quota gratuit. Tout l'état vit maintenant dans Netlify Blobs.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { checkLicense } from '../lib/firebase.mjs';
import { codeId } from '../lib/license-core.mjs';
import { json, smallJson } from '../lib/http.mjs';

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
const media = () => getStore({ name: 'yakflow-media', consistency: 'strong' });
const state = () => getStore({ name: 'yakflow-bridge', consistency: 'strong' });
const payloadKey = (owner, kind, id) => `${owner}/${kind}/${hash(id)}/payload`;
const resultKey = (owner, kind, id) => `${owner}/${kind}/${hash(id)}/result`;
const chunkKey = (owner, id, n) => `${owner}/grok/${hash(id)}/chunk-${n}`;
const jobKey = (owner, kind, id) => `${owner}/${kind}/job/${hash(id)}`;
const queuePrefix = (owner, kind) => `${owner}/${kind}/q/`;
const workersKey = (owner, kind) => `${owner}/${kind}/workers`;
const maxBody = 5_000_000;
const ALIVE_MS = 60_000;      // un onglet est « vivant » s'il a donné signe de vie depuis moins d'une minute
const BEAT_MIN_MS = 20_000;   // on n'écrit pas le signal de vie plus souvent que toutes les 20 s

async function bodyJson(request) { return smallJson(request, maxBody); }

async function getJob(owner, kind, id) {
  const r = await state().getWithMetadata(jobKey(owner, kind, id), { type: 'json' });
  return r ? { data: r.data, etag: r.etag } : null;
}
async function patchJob(owner, kind, id, patch) {
  const cur = (await getJob(owner, kind, id))?.data || {};
  const next = { ...cur, ...patch };
  await state().setJSON(jobKey(owner, kind, id), next);
  return next;
}

async function workerMap(owner, kind) {
  const r = await state().getWithMetadata(workersKey(owner, kind), { type: 'json' });
  return { map: (r && r.data) || {}, etag: r?.etag };
}
async function workerStatus(owner, kind) {
  const { map } = await workerMap(owner, kind);
  const now = Date.now();
  return Object.values(map).filter((w) => now - (w.seenAt || 0) < ALIVE_MS);
}
async function heartbeat(owner, kind, worker, info = '') {
  if (!worker || worker.length > 100) return;
  const id = hash(worker).slice(0, 24);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { map, etag } = await workerMap(owner, kind);
    const now = Date.now();
    if (map[id] && now - map[id].seenAt < BEAT_MIN_MS && map[id].info === String(info).slice(0, 200)) return;
    for (const [k, w] of Object.entries(map)) if (now - (w.seenAt || 0) > 10 * 60_000) delete map[k];   // ménage
    map[id] = { seenAt: now, info: String(info).slice(0, 200) };
    const res = etag ? await state().setJSON(workersKey(owner, kind), map, { onlyIfMatch: etag })
                     : await state().setJSON(workersKey(owner, kind), map, { onlyIfNew: true });
    if (res.modified !== false) return;
  }
}

async function waiting(owner, kind) {
  const { blobs } = await state().list({ prefix: queuePrefix(owner, kind) });
  return blobs.map((b) => b.key).sort();
}
async function expireIfStale(owner, kind, id, data) {
  if (!data) return null;
  if (data.st !== 'en cours' || Date.now() - (data.claimedAt || 0) <= 30 * 60_000) return data;
  return patchJob(owner, kind, id, {
    st: kind === 'grok' ? 'echec' : 'incertain',
    error: 'Le pont navigateur ne répond plus depuis 30 minutes. Vérifie son onglet avant de relancer.',
    finishedAt: Date.now(),
  });
}
async function publicJob(owner, kind, id) {
  return JSON.parse(await media().get(payloadKey(owner, kind, id)) || 'null');
}
async function dropQueue(data) { if (data?.qKey) await state().delete(data.qKey).catch(() => {}); }

async function run(request) {
  const license = request.headers.get('X-Yakflow-License');
  const lic = await checkLicense(license);
  if (!lic.valid) return json({ detail: lic.message }, 403);
  const owner = codeId(license);
  const url = new URL(request.url);
  const match = url.pathname.match(/\/(?:cloud-bridge\/)?(bridge|grok)\/([a-z-]+)$/);
  if (!match) return json({ detail: 'Action inconnue.' }, 404);
  const [, kind, action] = match;
  const id = url.searchParams.get('id') || '';
  const worker = url.searchParams.get('worker') || '';
  const info = url.searchParams.get('info') || '';
  const store = media();

  if (action === 'status' && request.method === 'GET') {
    const live = await workerStatus(owner, kind);
    if (kind === 'grok') {
      const pending = await waiting(owner, kind);
      return json({ alive: live.length > 0, workers: live.length, pending: pending.length, running: 0 });
    }
    const output = { protocol: 2, alive: live.length > 0, workers: live.length, info: live[0]?.info || '' };
    if (id) {
      const data = await expireIfStale(owner, kind, id, (await getJob(owner, kind, id))?.data);
      if (data) Object.assign(output, { st: data.st, error: data.error || '', pos: 0,
        data: data.st === 'fini' ? await store.get(resultKey(owner, kind, id)) : null });
    }
    return json(output);
  }
  if (action === 'job' && kind === 'grok' && request.method === 'GET') {
    const cur = await getJob(owner, kind, id);
    if (!cur) return json({ detail: 'Travail Grok introuvable.' }, 404);
    const data = await expireIfStale(owner, kind, id, cur.data);
    return json({ id, st: data.st, worker: data.worker || '', error: data.error || '', pos: 0, chunks: data.chunks || 0 });
  }
  if (action === 'push' && request.method === 'POST') {
    const data = await bodyJson(request);
    if (!data?.id || !data?.prompt || (kind === 'grok' && !data.image)) return json({ detail: 'Travail invalide.' }, 400);
    const jid = String(data.id).slice(0, 200);
    const same = (await getJob(owner, kind, jid))?.data;
    const fingerprint = hash(JSON.stringify(data));
    if (same && same.fingerprint === fingerprint && ['attente', 'en cours', 'fini'].includes(same.st)) return json({ ok: true, deja: true, st: same.st });
    await dropQueue(same);
    const createdAt = Date.now();
    const qKey = queuePrefix(owner, kind) + String(createdAt).padStart(15, '0') + '-' + hash(jid).slice(0, 16);
    await store.set(payloadKey(owner, kind, jid), JSON.stringify(data));
    await state().setJSON(jobKey(owner, kind, jid), { id: jid, st: 'attente', fingerprint, createdAt, worker: '', error: '', qKey });
    await state().set(qKey, jid);
    return json({ ok: true, pos: 1 });
  }
  if (action === 'forget' && request.method === 'POST') {
    if (id) {
      const data = (await getJob(owner, kind, id))?.data;
      if (data) {
        await dropQueue(data);
        await patchJob(owner, kind, id, { st: 'oublie', forgottenAt: Date.now() });
        if (['fini', 'echec'].includes(data.st)) await Promise.allSettled([store.delete(payloadKey(owner, kind, id)), store.delete(resultKey(owner, kind, id))]);
      }
    }
    return json({ ok: true });
  }
  if (['hello', 'heartbeat'].includes(action) && request.method === 'POST') {
    await heartbeat(owner, kind, worker, info); return json({ ok: true });
  }
  if (action === 'peek' && kind === 'bridge' && request.method === 'GET') {
    await heartbeat(owner, kind, worker, info);
    for (const qKey of await waiting(owner, kind)) {
      const jid = await state().get(qKey);
      const data = jid ? (await getJob(owner, kind, jid))?.data : null;
      if (!data || data.st !== 'attente') { await state().delete(qKey).catch(() => {}); continue; }
      return json({ job: await publicJob(owner, kind, jid) });
    }
    return json({ job: null });
  }
  if (action === 'take' && request.method === 'POST') {
    if (!worker) return json({ detail: 'Onglet inconnu.' }, 400);
    await heartbeat(owner, kind, worker, info);
    for (const qKey of await waiting(owner, kind)) {
      const jid = await state().get(qKey);
      const cur = jid ? await getJob(owner, kind, jid) : null;
      if (!cur || cur.data.st !== 'attente') { await state().delete(qKey).catch(() => {}); continue; }
      // attribution atomique : l'écriture n'aboutit que si personne n'a modifié le travail entre-temps
      const res = await state().setJSON(jobKey(owner, kind, jid), { ...cur.data, st: 'en cours', worker, claimedAt: Date.now() }, { onlyIfMatch: cur.etag });
      if (res.modified === false) continue;
      await state().delete(qKey).catch(() => {});
      return json({ job: await publicJob(owner, kind, jid) });
    }
    return json({ job: null });
  }
  if (action === 'result' && kind === 'bridge' && request.method === 'POST') {
    const data = await bodyJson(request);
    if (!data?.id) return json({ detail: 'Travail inconnu.' }, 400);
    const cur = (await getJob(owner, kind, data.id))?.data;
    if (!cur) return json({ detail: 'Travail inconnu.' }, 404);
    if (cur.worker && cur.worker !== worker) return json({ detail: 'Autre onglet propriétaire.' }, 409);
    if (cur.st === 'oublie') return json({ ok: true, ignore: true });
    if (data.data) {
      await store.set(resultKey(owner, kind, data.id), String(data.data));
      await patchJob(owner, kind, data.id, { st: 'fini', finishedAt: Date.now(), error: '' });
    } else await patchJob(owner, kind, data.id, { st: 'echec', finishedAt: Date.now(), error: String(data.error || 'Erreur ChatGPT').slice(0, 500) });
    return json({ ok: true });
  }
  if (action === 'fail' && kind === 'grok' && request.method === 'POST') {
    const data = await bodyJson(request);
    const cur = (await getJob(owner, kind, data.id))?.data;
    if (!cur) return json({ detail: 'Travail inconnu.' }, 404);
    if (cur.worker && cur.worker !== worker) return json({ detail: 'Autre onglet propriétaire.' }, 409);
    await patchJob(owner, kind, data.id, { st: 'echec', error: String(data.error || 'Erreur Grok').slice(0, 500), finishedAt: Date.now() });
    return json({ ok: true });
  }
  if (action === 'result-chunk' && kind === 'grok' && request.method === 'POST') {
    const part = Number(url.searchParams.get('part')), total = Number(url.searchParams.get('total'));
    if (!id || !Number.isInteger(part) || part < 0 || !Number.isInteger(total) || total < 1 || total > 100 || part >= total) return json({ detail: 'Fragment invalide.' }, 400);
    const cur = (await getJob(owner, kind, id))?.data;
    if (!cur || cur.worker !== worker) return json({ detail: 'Travail non attribué à cet onglet.' }, 403);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 3_500_000) return json({ detail: 'Fragment trop volumineux.' }, 413);
    const bytes = await request.arrayBuffer(); if (bytes.byteLength > 3_500_000) return json({ detail: 'Fragment trop volumineux.' }, 413);
    await store.set(chunkKey(owner, id, part), bytes);
    if (cur.chunks !== total) await patchJob(owner, kind, id, { chunks: total });
    return json({ ok: true });
  }
  if (action === 'result-complete' && kind === 'grok' && request.method === 'POST') {
    const cur = (await getJob(owner, kind, id))?.data;
    if (!cur || cur.worker !== worker) return json({ detail: 'Travail non attribué à cet onglet.' }, 403);
    const total = cur.chunks || 0; if (!total) return json({ detail: 'Aucun fragment vidéo.' }, 400);
    for (let part = 0; part < total; part++) if (!(await store.getMetadata(chunkKey(owner, id, part)))) return json({ detail: 'Fragment vidéo manquant.' }, 400);
    await patchJob(owner, kind, id, { st: 'fini', finishedAt: Date.now() }); return json({ ok: true, chunks: total });
  }
  if (action === 'file' && kind === 'grok' && request.method === 'GET') {
    const part = Number(url.searchParams.get('part'));
    const cur = (await getJob(owner, kind, id))?.data;
    if (!cur || cur.st !== 'fini') return json({ detail: 'Vidéo non disponible.' }, 404);
    if (!Number.isInteger(part) || part < 0 || part >= cur.chunks) return json({ detail: 'Fragment inconnu.' }, 400);
    const bytes = await store.get(chunkKey(owner, id, part), { type: 'arrayBuffer' });
    if (!bytes) return json({ detail: 'Fragment manquant.' }, 404);
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
  }
  if (action === 'ack' && kind === 'grok' && request.method === 'POST') {
    const cur = (await getJob(owner, kind, id))?.data;
    if (!cur || cur.st !== 'fini') return json({ detail: 'Vidéo non disponible.' }, 404);
    const keys = Array.from({ length: cur.chunks || 0 }, (_, part) => chunkKey(owner, id, part));
    keys.push(payloadKey(owner, kind, id));
    await Promise.allSettled(keys.map((key) => store.delete(key)));
    await patchJob(owner, kind, id, { st: 'recu', receivedAt: Date.now() });
    return json({ ok: true });
  }
  return json({ detail: 'Action inconnue.' }, 404);
}

export default async function handler(request) {
  try { return await run(request); }
  catch (error) { console.error('cloud-bridge:', error.message); return json({ detail: 'Pont en ligne indisponible.' }, 503); }
}
