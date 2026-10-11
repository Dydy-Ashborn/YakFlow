// ==UserScript==
// @name         YakFlow Connect
// @namespace    https://yakflow.netlify.app/
// @version      3.3.1
// @description  Un seul script pour YakFlow : relie l'onglet YakFlow à ChatGPT (images) et à Grok Imagine (animation), directement dans ton navigateur.
// @author       YakFlow
// @updateURL    https://yakflow.netlify.app/yakflow-connect.user.js
// @downloadURL  https://yakflow.netlify.app/yakflow-connect.user.js
// @match        https://yakflow.netlify.app/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://grok.com/imagine*
// @match        https://grok.com/supergrok/imagine*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      apihub.agnes-ai.com
// @connect      apihub.agnes-ai.cn
// @connect      agnes-ai.com
// @connect      agnes-ai.cn
// @connect      agnes-ai.space
// @connect      myqcloud.com
// @connect      grok.com
// @connect      x.ai
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  const CONNECT_VERSION = '3.3.1';
  /* =====================================================================
     HUB : la file de travail des ponts, dans le navigateur (stockage Tampermonkey partagé entre onglets).
     Remplace le serveur : l'onglet YakFlow dépose les images/clips à faire, les onglets ChatGPT/Grok
     les prennent et rendent le résultat. Aucune requête vers un serveur.
     ===================================================================== */
  const P = 'yf2:';
  const now = () => Date.now();
  /* YAKFLOW_KEEPAWAKE_V1 : Chrome ralentit fortement les onglets en arrière-plan (minuteries une fois par minute,
     onglet gelé) : le pont semblait figé tant qu'on ne cliquait pas sur l'onglet. Les attentes passent par un
     Worker (non ralenti), et l'onglet ChatGPT / Grok reste actif (son inaudible + verrou Web Lock). */
  let timerWorker = null, twSeq = 0; const twPend = new Map();
  try {
    const src = 'onmessage=function(e){setTimeout(function(){postMessage(e.data[0])},e.data[1])}';
    timerWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    timerWorker.onmessage = (e) => { const f = twPend.get(e.data); if (f) { twPend.delete(e.data); f(); } };
    timerWorker.onerror = () => { timerWorker = null; };
  } catch (_) { timerWorker = null; }
  const wakeSleep = (ms) => new Promise((r) => {
    let done = false; const fin = () => { if (!done) { done = true; r(); } };
    setTimeout(fin, ms + (timerWorker ? 1500 : 0));   // filet de sécurité si le Worker est bloqué
    if (timerWorker) { const id = ++twSeq; twPend.set(id, fin); try { timerWorker.postMessage([id, ms]); } catch (_) { twPend.delete(id); } }
  });
  const sleep = wakeSleep;
  let awakeCtx = null;
  function keepAwake() {
    const start = () => {
      try {
        if (!awakeCtx) { awakeCtx = new (window.AudioContext || window.webkitAudioContext)(); const o = awakeCtx.createOscillator(), g = awakeCtx.createGain(); o.frequency.value = 30; g.gain.value = 0.001; o.connect(g); g.connect(awakeCtx.destination); o.start(); }
        if (awakeCtx.state !== 'running') awakeCtx.resume().catch(() => {});
      } catch (_) {}
    };
    start();
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, start, { capture: true }));
    setInterval(start, 30000);
    try { if (navigator.locks) navigator.locks.request('yakflow-awake-' + Math.random().toString(36).slice(2), () => new Promise(() => {})); } catch (_) {}
  }
  const awake = () => !!(awakeCtx && awakeCtx.state === 'running');
  const get = (k, d = null) => { const v = GM_getValue(P + k, null); return v == null ? d : v; };
  const set = (k, v) => GM_setValue(P + k, v);
  const del = (k) => GM_deleteValue(P + k);
  const keys = (pre) => GM_listValues().filter((k) => k.startsWith(P + pre)).map((k) => k.slice(P.length));
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + s.length.toString(36); };
  const ALIVE_MS = 60000;
  const jk = (kind, id) => kind + ':job:' + fnv(String(id));
  const pk = (kind, id) => kind + ':payload:' + fnv(String(id));
  const rk = (kind, id) => kind + ':result:' + fnv(String(id));
  // v3.2.1 : un JPEG de plusieurs Mo dans UNE valeur GM pouvait disparaître ou bloquer
  // le retour Studio. Morcelage, vérification avant commit et compatibilité anciens résultats.
  const IMG_PART_SIZE = 180000;
  function storeLarge(key, str) {
    if (typeof str !== 'string' || !str.startsWith('data:image/') || str.length < 1000)
      throw new Error('Image absente ou invalide pour transfert');
    const count = Math.ceil(str.length / IMG_PART_SIZE);
    if (count > 150) throw new Error('Image trop volumineuse pour le pont (' + str.length + ' caractères)');
    const old = get(key);
    for (let i = 0; i < count; i++) {
      const piece = str.slice(i * IMG_PART_SIZE, (i + 1) * IMG_PART_SIZE);
      set(key + ':part:' + i, piece);
      if (get(key + ':part:' + i) !== piece) throw new Error('Stockage Tampermonkey incomplet, morceau ' + (i + 1));
    }
    // La métadonnée de validation est écrite en dernier : pas de faux résultat « fini ».
    set(key, { kind: 'yf-large-v1', count, size: str.length, hash: fnv(str) });
    if (readLarge(key) !== str) throw new Error('Résultat écrit mais non relisible dans Tampermonkey');
    if (old && old.kind === 'yf-large-v1' && old.count > count)
      for (let i = count; i < old.count; i++) del(key + ':part:' + i);
  }
  function readLarge(key) {
    const meta = get(key);
    if (typeof meta === 'string') return meta;  // résultat antérieur à 3.2.1
    if (!meta || meta.kind !== 'yf-large-v1' || !Number.isInteger(meta.count) || meta.count < 1 || meta.count > 150) return null;
    const pieces = [];
    for (let i = 0; i < meta.count; i++) {
      const part = get(key + ':part:' + i);
      if (typeof part !== 'string') return null;
      pieces.push(part);
    }
    const str = pieces.join('');
    return str.length === meta.size && fnv(str) === meta.hash ? str : null;
  }
  function deleteLarge(key) {
    const meta = get(key);
    if (meta && meta.kind === 'yf-large-v1') for (let i = 0; i < meta.count; i++) del(key + ':part:' + i);
    del(key);
  }
  const ck = (id, n) => 'grok:chunk:' + fnv(String(id)) + ':' + n;
  const qk = (kind) => kind + ':queue';
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  function beat(kind, worker, info) {
    if (!worker) return;
    set(kind + ':w:' + fnv(worker), { seenAt: now(), info: String(info || '').slice(0, 200) });
    monoOwner(kind, worker, true);
  }
  function alive(kind) {
    const out = [];
    for (const k of keys(kind + ':w:')) { const w = get(k); if (!w || now() - w.seenAt > 10 * 60000) { del(k); continue; } if (now() - w.seenAt < ALIVE_MS) out.push(w); }
    return out;
  }
  // Un seul onglet producteur par service. La propriété expire seulement après
  // deux minutes sans battement ; une génération active renouvelle son bail.
  // Les autres onglets peuvent rester ouverts mais ne prennent aucun travail.
  function monoOwner(kind, worker, acquire = false) {
    if (!worker || worker === 'studio') return false;
    const key = kind + ':single-worker-v1', current = get(key);
    if (current && current.worker !== worker && now() - current.seenAt < 120000) return false;
    if (!acquire && (!current || current.worker !== worker)) return false;
    set(key, { worker, seenAt: now() });
    return true;
  }
  function job(kind, id) {
    const j = get(jk(kind, id));
    // Un rendu ChatGPT peut dépasser 30 minutes. Tant que son onglet envoie son
    // heartbeat, ne surtout pas transformer un résultat attendu en « incertain ».
    const workerBeat = j && j.worker ? get(kind + ':w:' + fnv(j.worker)) : null;
    const lastContact = Math.max(j?.claimedAt || 0, workerBeat?.seenAt || 0);
    if (j && j.st === 'en cours' && now() - lastContact > 30 * 60000) {
      Object.assign(j, { st: kind === 'grok' ? 'echec' : 'incertain', error: 'L’onglet ' + (kind === 'grok' ? 'Grok' : 'ChatGPT') + ' ne répond plus depuis 30 minutes. Vérifie-le avant de relancer.', finishedAt: now() });
      set(jk(kind, id), j);
    }
    return j;
  }
  const saveJob = (kind, id, patch) => { const j = { ...(get(jk(kind, id)) || {}), ...patch }; set(jk(kind, id), j); return j; };
  const queue = (kind) => get(qk(kind), []);
  function waiting(kind) { return queue(kind).filter((id) => { const j = job(kind, id) || {}; return j.st === 'attente' && !(j.blockedUntil > now()); }); }
  function dropChunks(id, total) { for (let n = 0; n < (total || 100); n++) { if (get(ck(id, n)) == null && n >= (total || 0)) break; del(ck(id, n)); } }
  async function claim(kind, id, worker) {
    const k = kind + ':claim:' + fnv(String(id)), cur = get(k);
    if (cur && cur.w !== worker && now() - cur.t < 15000) return false;   // YAKFLOW_CONNECT_302 : arbitrage de 15 s seulement
    set(k, { w: worker, t: now() });
    await sleep(250 + Math.random() * 250);
    const back = get(k);
    return !!(back && back.w === worker);
  }
  function housekeeping() {
    for (const kind of ['bridge', 'grok']) {
      const q = queue(kind).filter((id) => { const j = get(jk(kind, id)); return j && ['attente', 'en cours', 'fini'].includes(j.st) && now() - (j.createdAt || 0) < 24 * 3600 * 1000; });
      set(qk(kind), q);
      for (const k of keys(kind + ':job:')) { const j = get(k); if (!j || now() - (j.createdAt || 0) > 24 * 3600 * 1000) { if (j) { del(pk(kind, j.id)); if (kind === 'bridge') deleteLarge(rk(kind, j.id)); else del(rk(kind, j.id)); if (kind === 'grok') dropChunks(j.id, j.chunks); del(kind + ':claim:' + fnv(String(j.id))); } del(k); } }
    }
  }

  // hub(kind, méthode, "action?param=…", corps, onglet) -> { status, json } ou { status, buf }
  async function hub(kind, method, path, body, worker) {
    const u = new URL(path.replace(/^\/?(bridge|grok)\//, ''), 'https://hub.local/');
    const action = u.pathname.replace(/^\//, ''), q = u.searchParams;
    const id = q.get('id') || '', info = q.get('info') || '';
    worker = q.get('worker') || worker || '';
    const ok = (json) => ({ status: 200, json }), err = (status, detail) => ({ status, json: { detail } });

    if (action === 'status' && method === 'GET') {
      const live = alive(kind);
      const owner = get(kind + ':single-worker-v1');
      const singleLive = owner && now() - owner.seenAt < 120000 ? live.slice(0, 1) : [];
      if (kind === 'grok') return ok({ alive: singleLive.length > 0, workers: singleLive.length, pending: waiting(kind).length, running: 0 });
      const out = { protocol: 2, alive: singleLive.length > 0, workers: singleLive.length, info: singleLive[0] ? singleLive[0].info : '' };
      const pz = get('bridge:pause'); if (pz && now() < pz.until) Object.assign(out, { pauseUntil: pz.until, pauseWhy: pz.why || '', info: 'En pause jusqu’à ' + new Date(pz.until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' : ' + (pz.why || 'limite ChatGPT') });
      if (id) { const j = job(kind, id); if (j) {
        const data = j.st === 'fini' ? readLarge(rk(kind, id)) : null;
        const payload = get(pk(kind, id));
        Object.assign(out, { st: j.st === 'fini' && !data ? 'incertain' : j.st,
          error: j.st === 'fini' && !data ? 'Image enregistrée mais illisible dans le stockage Tampermonkey : récupération manuelle nécessaire.' : (j.error || ''),
          pos: 0, data, promptSig: payload?.prompt ? fnv(String(payload.prompt)) : '' });
      } }
      return ok(out);
    }
    if (action === 'job' && kind === 'grok' && method === 'GET') {
      const j = job(kind, id); if (!j) return err(404, 'Travail Grok introuvable.');
      return ok({ id, st: j.st, worker: j.worker || '', error: j.error || '', pos: 0, chunks: j.chunks || 0 });
    }
    if (action === 'push' && method === 'POST') {
      const d = body || {};
      if (!d.id || !d.prompt || (kind === 'grok' && !d.image)) return err(400, 'Travail invalide.');
      const jid = String(d.id).slice(0, 200), fp = fnv(JSON.stringify(d)), same = job(kind, jid);
      if (same && same.fingerprint === fp && ['attente', 'en cours', 'fini', 'incertain'].includes(same.st)) return ok({ ok: true, deja: true, st: same.st });
      // v3.2.3 : ne pas remplacer une tâche encore en cours ou une image pas encore
      // enregistrée dans YakFlow. Sinon un ancien rendu peut écraser le nouveau.
      if (kind === 'bridge' && same && ['en cours', 'fini', 'incertain'].includes(same.st))
        return err(409, 'Image précédente encore en cours ou récupérable : attendre sa réception automatique avant de changer le prompt.');
      set(pk(kind, jid), d);
      set(jk(kind, jid), { id: jid, st: 'attente', fingerprint: fp, createdAt: now(), worker: '', error: '' });
      del(kind + ':claim:' + fnv(jid));
      set(qk(kind), queue(kind).filter((x) => x !== jid).concat(jid));
      return ok({ ok: true, pos: waiting(kind).length });
    }
    if (action === 'reload' && method === 'POST') { set(kind + ':reloadAt', now()); return ok({ ok: true }); }
    if (action === 'forget' && method === 'POST') {
      const j = job(kind, id);
      if (j) {
        // v3.2.3 : le Studio peut changer de statut ou être réimporté pendant
        // qu'une image ChatGPT est calculée. Dans ce cas il NE PEUT PAS annuler
        // le rendu déjà envoyé : on préserve sa tâche et le résultat futur.
        if (kind === 'bridge' && j.st === 'en cours') {
          saveJob(kind, id, { detachedAt: now() });
          return ok({ ok: true, preserved: true, st: 'en cours' });
        }
        saveJob(kind, id, { st: 'oublie', forgottenAt: now() });
        set(qk(kind), queue(kind).filter((x) => x !== id));
        if (['fini', 'echec', 'attente'].includes(j.st)) { del(pk(kind, id)); if (kind === 'bridge') deleteLarge(rk(kind, id)); else del(rk(kind, id)); if (kind === 'grok') dropChunks(id, j.chunks); }
      }
      return ok({ ok: true });
    }
    if (action === 'ack' && kind === 'bridge' && method === 'POST') {
      // L'ACK est envoyé SEULEMENT APRÈS écriture de l'image et du projet dans IndexedDB.
      const j = job(kind, id);
      if (!j || j.st === 'recu') return ok({ ok: true, deja: true });
      if (j.st !== 'fini') return err(409, 'Image non prête : impossible de confirmer sa réception.');
      del(pk(kind, id)); deleteLarge(rk(kind, id));
      saveJob(kind, id, { st: 'recu', receivedAt: now(), error: '' });
      set(qk(kind), queue(kind).filter((x) => x !== id));
      return ok({ ok: true, received: true });
    }
    if (['hello', 'heartbeat'].includes(action) && method === 'POST') { beat(kind, worker, info); return ok({ ok: true }); }
    if (action === 'peek' && kind === 'bridge' && method === 'GET') {
      beat(kind, worker, info);
      if (!monoOwner(kind, worker, true)) return ok({ job: null, singleWorker: true });
      const jid = waiting(kind)[0];
      return ok({ job: jid ? get(pk(kind, jid)) : null });
    }
    if (action === 'take' && method === 'POST') {
      if (!worker) return err(400, 'Onglet inconnu.');
      beat(kind, worker, info);
      if (!monoOwner(kind, worker, true)) return ok({ job: null, singleWorker: true });
      for (const jid of waiting(kind)) {
        if (!(await claim(kind, jid, worker))) continue;
        const j = job(kind, jid); if (!j || j.st !== 'attente') continue;
        saveJob(kind, jid, { st: 'en cours', worker, claimedAt: now() });
        return ok({ job: get(pk(kind, jid)) });
      }
      return ok({ job: null });
    }
    if (action === 'result' && kind === 'bridge' && method === 'POST') {
      const d = body || {}; const j = job(kind, d.id);
      if (!j) return err(404, 'Travail inconnu.');
      if (j.worker && j.worker !== worker) return err(409, 'Autre onglet propriétaire.');
      // Récupération des images déjà perdues par v3.2.2 : une commande 'forget'
      // envoyée trop tôt ne doit pas empêcher de stocker une image réellement produite.
      // On accepte même une livraison tardive d'un travail 'oublie' par l'ancien pont.
      if (j.st === 'oublie' && !d.data) return ok({ ok: true, ignore: true });
      if (d.data) {
        // 3.2.2 : transport identique au pont originel qui remontait les images.
        // Le mécanisme de protection v3.2.1 conserve, à part, une sauvegarde fragmentée
        // AVANT cette opération, donc une coupure n'entraîne aucune nouvelle génération.
        try {
          const value = String(d.data);
          if (!value.startsWith('data:image/') || value.length < 1000) throw new Error('résultat image non valide');
          set(rk(kind, d.id), value);
          const back = get(rk(kind, d.id));
          if (back !== value) throw new Error('résultat non relisible');
        } catch (e) { return err(507, 'Transfert image impossible : ' + e.message); }
        saveJob(kind, d.id, { st: 'fini', finishedAt: now(), error: '' });
      }
      else saveJob(kind, d.id, { st: d.incertain ? 'incertain' : 'echec', finishedAt: now(), error: String(d.error || 'Erreur ChatGPT').slice(0, 500) });
      return ok({ ok: true });
    }
    // YAKFLOW_RELEASE_V1 : l'onglet rend le travail à la file (limite passagère), sans le compter comme un échec
    if (action === 'release' && method === 'POST') {
      const d = body || {}; const j = job(kind, d.id);
      if (!j) return err(404, 'Travail inconnu.');
      if (j.worker && j.worker !== worker) return err(409, 'Autre onglet propriétaire.');
      if (j.st === 'en cours') { saveJob(kind, d.id, { st: 'attente', worker: '', claimedAt: 0, blockedUntil: Math.max(now(), +(d.until || 0)) }); del(kind + ':claim:' + fnv(String(d.id))); }
      return ok({ ok: true });
    }
    if (action === 'fail' && kind === 'grok' && method === 'POST') {
      const d = body || {}; const j = job(kind, d.id);
      if (!j) return err(404, 'Travail inconnu.');
      if (j.worker && j.worker !== worker) return err(409, 'Autre onglet propriétaire.');
      saveJob(kind, d.id, { st: 'echec', error: String(d.error || 'Erreur Grok').slice(0, 500), finishedAt: now() });
      return ok({ ok: true });
    }
    if (action === 'result-chunk' && kind === 'grok' && method === 'POST') {
      const part = Number(q.get('part')), total = Number(q.get('total')), j = job(kind, id);
      if (!id || !Number.isInteger(part) || part < 0 || !Number.isInteger(total) || total < 1 || total > 100 || part >= total) return err(400, 'Fragment invalide.');
      if (!j || j.worker !== worker) return err(403, 'Travail non attribué à cet onglet.');
      set(ck(id, part), b64(body));
      if (j.chunks !== total) saveJob(kind, id, { chunks: total });
      return ok({ ok: true });
    }
    if (action === 'result-complete' && kind === 'grok' && method === 'POST') {
      const j = job(kind, id);
      if (!j || j.worker !== worker) return err(403, 'Travail non attribué à cet onglet.');
      const total = j.chunks || 0; if (!total) return err(400, 'Aucun fragment vidéo.');
      for (let n = 0; n < total; n++) if (get(ck(id, n)) == null) return err(400, 'Fragment vidéo manquant.');
      saveJob(kind, id, { st: 'fini', finishedAt: now() });
      return ok({ ok: true, chunks: total });
    }
    if (action === 'file' && kind === 'grok' && method === 'GET') {
      const part = Number(q.get('part')), j = job(kind, id);
      if (!j || j.st !== 'fini') return err(404, 'Vidéo non disponible.');
      if (!Number.isInteger(part) || part < 0 || part >= j.chunks) return err(400, 'Fragment inconnu.');
      const s = get(ck(id, part)); if (s == null) return err(404, 'Fragment manquant.');
      return { status: 200, buf: unb64(s) };
    }
    if (action === 'ack' && kind === 'grok' && method === 'POST') {
      const j = job(kind, id);
      if (!j || j.st !== 'fini') return err(404, 'Vidéo non disponible.');
      dropChunks(id, j.chunks); del(pk(kind, id));
      saveJob(kind, id, { st: 'recu', receivedAt: now() });
      set(qk(kind), queue(kind).filter((x) => x !== id));
      return ok({ ok: true });
    }
    return err(404, 'Action inconnue.');
  }

  /* =====================================================================
     ONGLET YAKFLOW : répond aux demandes de la page (window.postMessage)
     ===================================================================== */

  /* =====================================================================
     RELAIS AGNES : l'appel part de la connexion de l'utilisateur (Agnes bloque Cloudflare, erreur 1015).
     Exige une licence YakFlow signée et valide.
     ===================================================================== */
  const PUB = { kty: 'EC', crv: 'P-256', x: 'HHa1M8_6PFwWynyMX96HgfOGhWCK1Uktq0Vcjn7HcKM', y: 'rMI-Y3kGNf8wSuOTHaQDpWpbMGHnfy838ogn8kEARRk' };
  const AGNES_PATHS = ['POST /v1/images/generations', 'POST /v1/videos', 'GET /agnesapi'];
  const MEDIA_HOSTS = ['.agnes-ai.cn', '.agnes-ai.com', '.agnes-ai.space', '.myqcloud.com'];
  let pubKey = null;
  const b64u = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (x.length % 4)) % 4)), (c) => c.charCodeAt(0));
  async function tokenOk(tok) {
    try {
      const [body, sig] = String(tok || '').split('.');
      if (!body || !sig) return false;
      pubKey = pubKey || await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, b64u(sig), b64u(body)))) return false;
      const lic = JSON.parse(new TextDecoder().decode(b64u(body)));
      return !!(lic && lic.u && Date.now() < lic.u + 3 * 864e5);
    } catch (_) { return false; }
  }
  const mediaOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && MEDIA_HOSTS.some((h) => x.hostname.toLowerCase().endsWith(h)); } catch (_) { return false; } };
  function gmReq(o) {
    return new Promise((res) => GM_xmlhttpRequest({ ...o,
      onload: (r) => res(r), onerror: () => res({ status: 599, responseText: '{"detail":"réseau : Agnes injoignable"}', responseHeaders: '' }),
      ontimeout: () => res({ status: 599, responseText: '{"detail":"délai dépassé chez Agnes"}', responseHeaders: '' }) }));
  }
  const header = (r, name) => { const m = String(r.responseHeaders || '').match(new RegExp('^' + name + ':\\s*(.*)$', 'im')); return m ? m[1].trim() : ''; };
  async function agnesRelay(d) {
    if (!(await tokenOk(d.token))) return { status: 403, text: '{"detail":"Licence YakFlow invalide ou expirée. Recharge YakFlow."}', ctype: 'application/json' };
    if (d.kind === 'dl') {
      if (!mediaOk(d.url)) return { status: 400, ctype: 'application/json' };
      const r = await gmReq({ method: 'GET', url: d.url, responseType: 'arraybuffer', timeout: 300000 });
      if (r.finalUrl && !mediaOk(r.finalUrl)) return { status: 400, ctype: 'application/json' };
      return { status: r.status, ctype: header(r, 'content-type') || 'application/octet-stream', buf: r.status < 400 ? r.response : undefined };
    }
    const path = String(d.path || ''), base = path.split('?')[0];
    if (!AGNES_PATHS.includes(String(d.method) + ' ' + base)) return { status: 404, text: '{"detail":"Opération Agnes non autorisée."}', ctype: 'application/json' };
    let r;
    for (const origin of ['https://apihub.agnes-ai.com', 'https://apihub.agnes-ai.cn']) {
      r = await gmReq({ method: d.method, url: origin + path, headers: { Authorization: d.auth || '', 'Content-Type': 'application/json' }, data: d.body, timeout: 120000 });
      if (!([404, 405].includes(r.status) && base === '/v1/images/generations')) break;
    }
    return { status: r.status, text: r.responseText || '', ctype: header(r, 'content-type') || 'application/json', retryAfter: header(r, 'retry-after') };
  }

  function runStudio() {
    housekeeping();
    const hello = () => window.postMessage({ __yf: 'hello', version: CONNECT_VERSION, caps: ['agnes'] }, '*');
    window.addEventListener('message', async (e) => {
      // YAKFLOW_CONNECT_301 : dans Tampermonkey, « window » est un bac à sable : on filtre par origine, pas par source
      if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
      const d = e.data;
      if (d.__yf === 'ping') return hello();
      if (d.__yf === 'agnes') { const r = await agnesRelay(d); const m = { __yf: 'res', rid: d.rid, ...r }; try { window.postMessage(m, '*', r.buf ? [r.buf] : []); } catch (_) { window.postMessage(m, '*'); } return; }
      if (d.__yf !== 'req') return;
      let r;
      try { r = await hub(d.kind === 'grok' ? 'grok' : 'bridge', d.method || 'GET', String(d.path || ''), d.body, 'studio'); }
      catch (err) { r = { status: 500, json: { detail: String((err && err.message) || err) } }; }
      window.postMessage({ __yf: 'res', rid: d.rid, status: r.status, json: r.json, buf: r.buf }, '*', r.buf ? [r.buf] : []);
    });
    hello();
    setInterval(housekeeping, 30 * 60000);
  }

  function runChatGPT() {
  const VERSION = '2.1.3';
  // Un identifiant par chargement d'onglet : les conversations restent indépendantes.
  // YAKFLOW_CONNECT_303 : identifiant stable par onglet (survit au rechargement entre deux images) : un onglet = un worker
  const WORKER = sessionStorage.getItem('yakflowChatWorker') || ('chat-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()));
  sessionStorage.setItem('yakflowChatWorker', WORKER);
  const withWorker = (path) => path + (path.includes('?') ? '&' : '?') + 'worker=' + encodeURIComponent(WORKER);
  keepAwake();
  const PAGE_T0 = Date.now(); let busySince = 0;
  // Version 3.1.0 : ne bloque pas toute la file pour une limite de TELEVERSEMENT.
  // Les scènes ne nécessitant pas de nouvelles pièces jointes peuvent encore être produites.
  del('bridge:pause');
  const dbg = (m, o) => { try { console.log('[Pont]', m, o || ''); } catch (e) { /* rien */ } };
  // YAKFLOW_CONNECT_REFS_V1 : une conversation peut produire plusieurs images.
  // Les fiches identiques déjà jointes dans CE chat n'ont plus besoin d'être téléversées.
  const REF_SESSION_KEY = 'yf-connect-refs-v2'; // Mémoire versionnée : anciennes associations non vérifiées ignorées.
  const ACTIVE_KEY = 'yf-connect-active-v1';
  const PENDING_IMAGE_KEY = 'yf-connect-image-to-deliver-v2:' + fnv(WORKER);
  const OLD_PENDING_IMAGE_KEY = 'yf-connect-image-to-deliver-v1';
  const ECONOMY_KEY = 'yf-connect-reuse-approved-character-references';
  const QUALITY_KEY = 'yf-connect-quality-first-v320';
  const REFRESH_AFTER_TURNS = 3; // Réattacher une fiche après trois images intermédiaires.
  const isFaceCritical = (job) => /\b(?:gros plan|close[ -]?up|close portrait|portrait|visage en gros plan|face in close|tight shot|close shot|extreme close|tête et épaules|tete et epaules)\b/i.test(String(job?.prompt || '').slice(0, 1700));
  function loadRefSession() {
    let c; try { c = JSON.parse(sessionStorage.getItem(REF_SESSION_KEY) || 'null'); } catch (_) {}
    if (!c || !c.refs || !Array.isArray(c.refs)) c = { path: '', refs: [], sent: 0, uploaded: 0, reused: 0 };
    const path = location.pathname;
    const inChat = /^\/(?:c|g)\//.test(path);
    if ((inChat && c.path && c.path !== path) || (!inChat && c.path && !hasConversation()))
      c = { path: '', refs: [], sent: 0, uploaded: 0, reused: 0 };
    if (inChat && !c.path) c.path = path;
    try { sessionStorage.setItem(REF_SESSION_KEY, JSON.stringify(c)); } catch (_) {}
    return c;
  }
  function saveRefSession(c) { try { if (/^\/(?:c|g)\//.test(location.pathname)) c.path = location.pathname; sessionStorage.setItem(REF_SESSION_KEY, JSON.stringify(c)); } catch (_) {} }
  const isPersistentSheet = (r) => /^(?:ref-\d+-)?fiche(?:-serie)?-/i.test(String(r.name || ''));
  const refFingerprint = (r) => fnv(String(r.data || ''));
  // QUALITÉ PRIORITAIRE : les gros plans reçoivent TOUJOURS la fiche en pièce jointe.
  // Sur les plans courants, la réutilisation est limitée à un petit nombre de messages.
  // La référence de scène / image de fin est TOUJOURS jointe séparément.
  function refPlan(refs, job) {
    const mem = loadRefSession(), reuseOn = GM_getValue(ECONOMY_KEY, true);
    const qualityOn = GM_getValue(QUALITY_KEY, true);
    const importantFace = qualityOn && isFaceCritical(job);
    // V3.2.4 : une fiche de CHANGEMENT DE TENUE doit recevoir une pièce jointe
    // physique de sa BASE canonique, jamais un renvoi textuel vers un ancien tour.
    // Même exigence pour Léo, personnage principal dont le visage dérivait.
    const changingOutfit = /CANON IDENTITY LOCK|FIRST ATTACH THE APPROVED|Change OUTFIT ONLY|nouvelle tenue|new outfit|identity variation/i.test(String(job?.prompt || ''));
    const uploads = [], mapping = [], newly = [];
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i], hash = refFingerprint(r);
      const characterIsLeo = /fiche-serie-money-farm-leo(?:-tenue-[a-z0-9-]+)?\.jpg$/i.test(String(r.name || '')) || /fiche-serie-money-farm-leo(?:-tenue-[a-z0-9-]+)?/i.test(String(r.name || ''));
      // Ne jamais promettre 'FIRST attached' si la fiche P1 a en réalité été omise.
      const mustAttach = changingOutfit || characterIsLeo || importantFace;
      const old = reuseOn && !mustAttach && isPersistentSheet(r) && mem.refs.find(x => x.hash === hash);
      const isFresh = old && Number.isInteger(old.attachedAt) && (mem.sent - old.attachedAt) <= REFRESH_AFTER_TURNS;
      const canReuse = !!old && !mustAttach && (!qualityOn || isFresh);
      if (canReuse) {
        mapping.push('RÉFÉRENCE ' + (i + 1) + ' = fiche canonique ' + old.name + ' déjà jointe dans cette conversation (message YakFlow ' + old.job + '). UTILISER cette image EXACTE ; ne jamais substituer une autre version du personnage.');
      } else {
        uploads.push(r);
        newly.push({ hash, name: r.name });
        mapping.push('RÉFÉRENCE ' + (i + 1) + ' = fichier ' + r.name + ' joint DIRECTEMENT à CE message.');
      }
    }
    const suffix = refs.length ? '\n\nYAKFLOW — ORDRE IMMUTABLE DES RÉFÉRENCES :\n' + mapping.join('\n') + '\nFIRST/SECOND désignent ces numéros. Les personnages conservent STRICTEMENT la structure de visage, museau, oreilles et proportions de leur fiche canonique. Les images produites antérieurement ne doivent jamais remplacer ces références.' : '';
    return { uploads, newly, suffix, mem, original: refs, importantFace, qualityOn };
  }
  GM_registerMenuCommand('YakFlow Connect · réutilisation des fiches (ON/OFF)', () => { const v = !GM_getValue(ECONOMY_KEY, true); GM_setValue(ECONOMY_KEY, v); alert('Réutilisation des fiches approuvées : ' + (v ? 'ON' : 'OFF')); });
  GM_registerMenuCommand('YakFlow Connect · QUALITÉ PRIORITAIRE (ON/OFF)', () => { const v = !GM_getValue(QUALITY_KEY, true); GM_setValue(QUALITY_KEY, v); alert('Qualité prioritaire : ' + (v ? 'ON (gros plans : références directes ; autres : réinsertion fréquente)' : 'OFF (économie maximale, davantage de risque de dérive)')); });
  GM_registerMenuCommand('YakFlow Connect · effacer les références de ce chat', () => { sessionStorage.removeItem(REF_SESSION_KEY); alert('Références locales effacées ; prochaine demande : envoi des fichiers.' ); });
  GM_registerMenuCommand('YakFlow Connect · état des pièces jointes', () => { const c = loadRefSession(); const total = (c.uploaded || 0) + (c.reused || 0); const pct = total ? Math.round((c.reused || 0) * 100 / total) : 0; alert(c.sent + ' images demandées dans ce chat.\n' + (c.uploaded || 0) + ' fichiers joints ; ' + (c.reused || 0) + ' références réutilisées (' + pct + '% économisées).\n' + c.refs.length + ' fiches mémorisées.\nQualité prioritaire : ' + (GM_getValue(QUALITY_KEY, true) ? 'ON' : 'OFF') + '.'); });
  const K_ON = 'pont_actif', K_PID = 'pont_pid';
  let busy = false, info = 'en attente', lastErr = '';

  /* ---------- liaison avec le serveur du studio ---------- */
  // YAKFLOW_CONNECT : plus de serveur, la file est dans le navigateur (hub)
  function call(method, path, body) {
    return hub('bridge', method, path, body, WORKER).then((r) => (r.status < 400 ? r.json : Promise.reject(new Error((r.json && r.json.detail) || ('HTTP ' + r.status)))));
  }

  /* ---------- outils page (repris de la Régie) ---------- */
  function isVisible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function dataUrlToFile(dataUrl, name) {
    const parts = dataUrl.split(','), mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg', bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }
  async function blobToJpegDataUrl(blob) {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.95); // Qualité vidéo : moins d'artefacts JPEG, mêmes dimensions.
  }
  function gmFetchBlob(url) {
    return new Promise((res, rej) => GM_xmlhttpRequest({ method: 'GET', url, responseType: 'blob',
      onload: (r) => (r.status < 400 ? res(r.response) : rej(new Error('HTTP ' + r.status))), onerror: () => rej(new Error('téléchargement refusé')) }));
  }
  async function fetchBlob(url) {
    try { const r = await fetch(url, { credentials: 'include' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.blob(); }
    catch (e) { if (url.startsWith('blob:') || url.startsWith('data:')) throw e; return gmFetchBlob(url); }
  }
  // empreinte 8x8 (niveaux de gris) pour reconnaître une fiche jointe renvoyée par erreur à la place de l'image générée
  async function bitmapOf(src) { return createImageBitmap(src instanceof Blob ? src : await (await fetch(src)).blob()); }
  function hashOf(bmp) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data, v = [];
    for (let i = 0; i < 64; i++) v.push(d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
    const m = v.reduce((a, b) => a + b, 0) / 64; return v.map((x) => (x > m ? 1 : 0));
  }
  const hashDist = (a, b) => a.reduce((n, x, i) => n + (x !== b[i] ? 1 : 0), 0);
  // l'image reçue est-elle bien la nouvelle image demandée (bon format, pas une des fiches jointes) ?
  async function checkResult(blob, job, refHashes) {
    const bmp = await createImageBitmap(blob);
    const portrait = bmp.height > bmp.width * 1.15, landscape = bmp.width > bmp.height * 1.15;
    if (/9:16/.test(job.prompt) && !/3:2/.test(job.prompt) && landscape) return 'format paysage reçu au lieu d\'une image verticale (sans doute une fiche jointe)';
    if (/3:2/.test(job.prompt) && !/9:16/.test(job.prompt) && portrait) return 'image verticale reçue au lieu d\'une fiche horizontale (sans doute une autre image de la conversation)';
    const h = hashOf(bmp);
    if (refHashes.some((r) => hashDist(h, r) <= 6)) return 'ChatGPT a renvoyé une des images jointes, pas une nouvelle image';
    return '';
  }
  function findPromptField() {
    const pm = document.querySelector('#prompt-textarea');
    if (pm && isVisible(pm)) return pm;
    const c = [...document.querySelectorAll('textarea, [contenteditable="true"]')].filter((el) => !el.closest('#pont-agnes') && isVisible(el));
    return c.length ? c[c.length - 1] : null;
  }
  function findFileInput() { const i = [...document.querySelectorAll('input[type="file"]')]; return i.find((x) => !x.accept || /image|\*/.test(x.accept)) || i[0] || null; }
  // vignettes des fichiers joints dans la zone de saisie
  function attachedCount() {
    const form = (findPromptField() || document.body).closest('form') || document.querySelector('form');
    if (!form) return 0;
    const imgs = [...form.querySelectorAll('img, [style*="background-image"]')].filter((i) => { const r = i.getBoundingClientRect(); return r.width > 16 && r.height > 16; }).length;
    const removes = form.querySelectorAll('button[aria-label*="Remove" i], button[aria-label*="Supprimer" i], button[aria-label*="Retirer" i], [data-testid*="attachment" i]').length;
    return Math.max(imgs, removes);
  }
  /* YAKFLOW_DRAFT_AUTOHEAL_331
     Le brouillon ChatGPT peut garder des vignettes YakFlow après un import partiel.
     Les boutons sont dans [data-composer-attachments], pas dans l'historique.
     Ne retirer QUE nos fichiers `ref-<n>-...`, pas les pièces jointes personnelles.
     Ne JAMAIS agir pendant l'envoi, la génération ou la récupération d'une image.
  */
  const YF_DRAFT_REF = /^(?:supprimer|remove|retirer|delete)\s+ref-\d+-/i;
  const draftRepair = { failures: 0, retryAt: 0, removed: 0 };
  function composerAttachmentControls() {
    // La nouvelle interface place les boutons "Supprimer ref-1-..." dans ce conteneur.
    // Restriction au COMPOSER : n'effacer aucune image de l'historique.
    const f = findPromptField();
    const form = f?.closest('form') || null;
    const containers = [...document.querySelectorAll('[data-composer-attachments]')]
      .filter(el => !form || form.contains(el));
    if (!containers.length && form) containers.push(form);
    const found = new Set();
    for (const parent of containers) for (const b of parent.querySelectorAll('button[aria-label]')) {
      if (!isVisible(b)) continue;
      const name = b.getAttribute('aria-label') || '';
      if (/^(?:supprimer|remove|retirer|delete)\s+/i.test(name)) found.add(b);
    }
    return [...found];
  }
  function yakFlowDraftButtons() {
    return composerAttachmentControls().filter(b => YF_DRAFT_REF.test(b.getAttribute('aria-label') || ''));
  }
  async function clearYakFlowDraft() {
    if (busy || generating() || chatgptBusy()) return false;
    if (Date.now() < draftRepair.retryAt) return false;
    const controls = composerAttachmentControls();
    const ours = controls.filter(b => YF_DRAFT_REF.test(b.getAttribute('aria-label') || ''));
    if (!ours.length) return false; // Aucune preuve que les autres fichiers viennent de YakFlow.
    // Ne jamais nettoyer des fichiers pendant qu'une génération / un envoi est actif.
    // Le verrou local empêche une deuxième opération du pont pendant la réparation.
    busy = true;
    try {
      say('Nettoyage automatique des références YakFlow bloquées…');
      let removed = 0;
      // Prendre à nouveau les boutons après chaque clic : React peut reconstruire le DOM.
      for (let n = 0; n < 20; n++) {
        if (chatgptBusy() || generating()) throw new Error('ChatGPT a repris une génération ; nettoyage suspendu');
        const b = yakFlowDraftButtons()[0];
        if (!b) break;
        if (b.disabled) throw new Error('Bouton de suppression indisponible');
        const label = b.getAttribute('aria-label') || '';
        b.click();
        const gone = await waitFor(() => !b.isConnected || !yakFlowDraftButtons().some(x => x === b), 7000, 250);
        if (!gone) throw new Error('La vignette « ' + label.slice(0, 70) + ' » reste dans le brouillon');
        removed++;
        await sleep(350);
      }
      if (yakFlowDraftButtons().length) throw new Error('Trop de références résiduelles');
      draftRepair.removed += removed;
      draftRepair.failures = 0;
      draftRepair.retryAt = 0;
      lastErr = '';
      say('Brouillon YakFlow nettoyé (' + removed + ' référence(s)) · reprise automatique');
      dbg('brouillon automatiquement nettoyé', { removed, total: draftRepair.removed });
      return removed > 0;
    } catch (e) {
      draftRepair.failures++;
      draftRepair.retryAt = Date.now() + Math.min(5 * 60000, 10000 * 2 ** Math.min(draftRepair.failures - 1, 5));
      lastErr = 'Nettoyage automatique réessaiera : ' + (e.message || String(e));
      say('Brouillon bloqué · nouvelle tentative automatique');
      return false;
    } finally { busy = false; }
  }
  async function attachAndCheck(files, field) {
    const before = attachedCount(), want = before + files.length;
    const viaInput = () => {
      const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
      const input = findFileInput(); if (!input) return false;
      input.files = dt.files; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const viaPaste = () => {
      const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
      const el = findPromptField() || field; el.focus();
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true;
    };
    const viaDrop = () => {
      const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
      const el = (findPromptField() || field).closest('form') || findPromptField() || field;
      for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
      return true;
    };
    for (const m of [viaInput, viaPaste, viaDrop]) {
      try { if (!m()) continue; } catch (e) { continue; }
      if (await waitFor(() => attachedCount() >= want, 15000, 500)) return true;
    }
    return false;
  }
  async function attachFiles(files, field) {
    if (!files.length) return true;
    const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
    const input = findFileInput();
    if (input) {
      try { input.files = dt.files; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      catch (e) { /* collage */ }
    }
    if (field) { field.focus(); field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; }
    return false;
  }
  function insertText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA') {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true })); return;
    }
    document.execCommand('selectAll', false, null);
    if (!document.execCommand('insertText', false, text)) { el.textContent = text; el.dispatchEvent(new InputEvent('input', { bubbles: true })); }
  }
  /* Le prompt doit vraiment être dans la zone de texte : on vérifie, et on essaie plusieurs méthodes
     (l'onglet ChatGPT est souvent en arrière-plan, où execCommand ne marche pas toujours). */
  const fieldText = (el) => (el ? (el.value != null && el.tagName === 'TEXTAREA' ? el.value : el.innerText || el.textContent || '') : '');
  const hasPrompt = (text) => { const f = findPromptField(); const t = fieldText(f).replace(/\s+/g, ' '); return !!f && t.includes(text.replace(/\s+/g, ' ').slice(0, 60)); };
  async function setPrompt(text) {
    const methods = [
      (el) => insertText(el, text),
      (el) => { el.focus(); const dt = new DataTransfer(); dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); },
      (el) => { if (el.tagName === 'TEXTAREA') { insertText(el, text); return; }
        const p = document.createElement('p'); p.textContent = text; el.replaceChildren(p);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); },
    ];
    for (let round = 0; round < 2; round++) {
      for (const m of methods) {
        const el = findPromptField(); if (!el) return false;
        if (hasPrompt(text)) return true;
        try { m(el); } catch (e) { /* méthode suivante */ }
        await sleep(700);
        if (hasPrompt(text)) return true;
      }
    }
    return hasPrompt(text);
  }
  async function waitFor(fn, timeout, every) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await sleep(every || 500); } return null; }
  function generatedImages() {
    return [...document.querySelectorAll('main img')].filter((img) => {
      if (!img.complete || img.naturalWidth < 400) return false;
      const role = img.closest('[data-message-author-role]'); if (role && role.getAttribute('data-message-author-role') === 'user') return false;
      const turn = img.closest('[data-turn]'); if (turn && turn.getAttribute('data-turn') === 'user') return false;
      const item = img.closest('[data-local-conversation-item-target-ids]');
      if (item && /user/i.test(item.querySelector('h4[data-conversation-role]')?.getAttribute('data-conversation-role') || '')) return false;
      if (img.closest('[data-chatgpt-search-unit-key$=":user"], [aria-label*="Pièce jointe" i], [aria-label*="attachment" i]') || /pi[èe]ce jointe|attachment/i.test(img.alt || '')) return false;
      return !img.closest('form');
    });
  }
  const imgSrc = (img) => img.currentSrc || img.src;
  /* Nouvelle interface ChatGPT : pas de data-message-author-role. Les messages sont des blocs
     [data-local-conversation-item-target-ids] avec un titre masqué h4[data-conversation-role]. */
  const ITEM_SEL = '[data-local-conversation-item-target-ids], [data-message-author-role], [data-turn]';
  const hasConversation = () => !!document.querySelector('[data-message-author-role], [data-turn], [data-conversation-role], [data-local-conversation-item-target-ids], [data-chatgpt-search-unit-key], [data-chatgpt-search-message-ids]');
  let sentPrompt = '';
  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  // le bloc du message que NOUS venons d'envoyer (retrouvé par son texte : fiable quelle que soit l'interface)
  function userItem() {
    // v3.2.2 : chaque résultat doit être associé au message utilisateur exact.
    // La nouvelle interface ChatGPT utilise souvent un h4[data-conversation-role=user].
    // On commence par tous les véritables messages USER, jamais par un texte
    // repris dans la réponse de l'assistant ou dans une carte de galerie.
    const root = document.querySelector('main') || document.body;
    const snip = norm(sentPrompt).slice(0, 45); if (!snip) return null;
    const candidates = [...root.querySelectorAll('[data-message-author-role="user"], [data-turn="user"], [data-local-conversation-item-target-ids]')]
      .filter(el => {
        if (el.matches('[data-local-conversation-item-target-ids]')) {
          const h = el.querySelector('h4[data-conversation-role]');
          const role = h?.getAttribute('data-conversation-role') || '';
          if (role && !/user/i.test(role)) return false;
          if (!h && el.querySelector('[data-message-author-role="assistant"], [data-turn="assistant"]')) return false;
        }
        return norm(el.innerText || el.textContent).includes(snip.slice(0, 30));
      });
    if (candidates.length) return candidates[candidates.length - 1];
    // Compatibilité de l'ancien pont pour les versions ChatGPT sans rôle explicite.
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n, hit = null;
    while ((n = w.nextNode())) if (n.parentElement && !n.parentElement.closest('form') && norm(n.nodeValue).includes(snip.slice(0, 30))) {
      const candidate = n.parentElement.closest(ITEM_SEL);
      if (candidate && (candidate.matches('[data-message-author-role="user"], [data-turn="user"]') ||
          /user/i.test(candidate.querySelector('h4[data-conversation-role]')?.getAttribute('data-conversation-role') || ''))) hit = candidate;
    }
    return hit;
  }
  function findGeneratedImage() {
    const all = generatedImages();
    const gal = all.filter((img) => img.closest('[data-testid="generated-image-gallery"], [data-testid="generated-image-preview"]') || /image g[ée]n[ée]r[ée]e|generated image/i.test(img.alt || ''));
    const i = gal.length ? gal : all;   // la vraie image générée a le texte alternatif « Image générée N »
    // on ne prend que ce qui est APRÈS le dernier message envoyé (les fiches jointes sont dans ce message)
    const users = document.querySelectorAll('[data-message-author-role="user"], [data-turn="user"]');
    const lastUser = userItem() || (users.length ? users[users.length - 1] : null);
    let after = lastUser ? i.filter((img) => !lastUser.contains(img) && (lastUser.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING)) : i;
    // Conversation RÉUTILISÉE : ne JAMAIS se rabattre sur une ancienne image d'un tour précédent.
    // En l'absence d'image après le dernier prompt, on attend le résultat de ce prompt.
    return after.length ? after[after.length - 1] : null;
  }
  function findSendButton() {
    const sel = 'button[data-testid="send-button"], button#composer-submit-button, button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
    return [...document.querySelectorAll(sel)].find((b) => isVisible(b)) || null;
  }
  const chatgptBusy = () => !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Arrêter" i]');
  function lastAssistant() {
    const m = document.querySelectorAll('[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"]');
    return m.length ? m[m.length - 1] : null;
  }
  function lastAssistantText() { const m = lastAssistant(); return m ? m.innerText || '' : ''; }
  // YAKFLOW_ATTACH_LIMIT_V1 : « Vous avez atteint le nombre maximal de pièces jointes… réessayer à 16:02 »
  // limite du COMPTE ChatGPT : tous les onglets se mettent en pause jusqu'à l'heure indiquée, les images restent en file
  function attachLimit() {
    const re = /nombre maximal de pi[eè]ces jointes|maximum number of (file )?(uploads|attachments)|(file|attachment|upload) limit|limite de (t[ée]l[ée]versement|pi[eè]ces jointes)/i;
    // IMPORTANT : nous réutilisons les conversations. Les anciens messages peuvent citer la limite.
    // Ce n'est une erreur que dans une notification UI, pas dans l'historique des messages.
    const el = [...document.querySelectorAll('[role="alert"], [data-sonner-toast], [role="status"], form [class*="error" i], [class*="toast" i]')]
      .find((e) => !e.closest('[data-message-author-role], [data-turn], [data-local-conversation-item-target-ids]') && isVisible(e) &&
        re.test(e.textContent || '') && (e.textContent || '').length < 500);
    if (!el) return 0;
    const box = (el.closest('div') && el.closest('div').parentElement) || el;
    const txt = box.textContent || el.textContent || '';
    const m = txt.match(/(\d{1,2})\s*[:h]\s*(\d{2})\s*(AM|PM)?/i);
    if (!m) return Date.now() + 60 * 60000;
    let h = +m[1]; const mi = +m[2]; if (m[3]) { if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; }
    const d = new Date(); d.setHours(h, mi, 0, 0);
    // YAKFLOW_ATTACH_STALE_V1 : l'heure annoncée est passée → vieux message resté à l'écran, la limite est levée
    // (avant : on repoussait au lendemain et tout restait bloqué 24 h)
    if (d.getTime() < Date.now() - 60000) { if (Date.now() - d.getTime() < 20 * 3600000) return 0; d.setDate(d.getDate() + 1); }
    return d.getTime() + 60000;
  }
  function attachError() { const until = attachLimit() || Date.now() + 60 * 60000; const e = new Error('limite de pièces jointes ChatGPT, pause jusqu’à ' + new Date(until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })); e.attachUntil = until; return e; }
  const limitReached = () => /(limite.{0,35}(?:images|générations|atteinte)|image generation limit|you.ve reached your (?:image|generation) limit|quota (?:image|génération))/i.test(lastAssistantText());
  // le tour de l'assistant est terminé quand ses boutons d'action (copier, j'aime…) sont apparus
  function turnDone() {
    const m = lastAssistant(); if (!m) return false;
    const turn = m.closest('[data-turn], article, [data-testid^="conversation-turn"]') || m.parentElement;
    return !!(turn && turn.querySelector('[data-testid*="turn-action" i], [data-testid="copy-turn-action-button"], button[aria-label*="Copy" i], button[aria-label*="Copier" i], button[aria-label*="Good response" i], button[aria-label*="Bonne réponse" i]'));
  }
  // ChatGPT ne montre pas toujours le bouton Stop quand il dessine. Mais on ne se fie plus au texte (faux positifs) :
  // bouton Stop, ou indicateur de chargement DANS le dernier message de l'assistant tant que le tour n'est pas terminé.
  // indicateurs de la nouvelle interface : plateau de jeu de chargement, « En cours depuis 1min 29s », pourcentage
  const loadingUi = () => !!document.querySelector('[data-testid*="image-gen-loading" i]') || /En cours depuis\s+\d|Running for\s+\d|Working for\s+\d/i.test((document.querySelector('main') || document.body).innerText || '');
  function generating() {
    if (chatgptBusy() || loadingUi()) return true;
    const m = lastAssistant(); if (!m) return false;
    if (turnDone()) return false;
    const t = (m.innerText || '').slice(-200);
    if (/cr[ée]ation de l.image|creating image|making|almost done|presque/i.test(t) && !generatedImages().length) return true;
    return !!m.querySelector('[data-testid*="image-gen" i], [class*="image-gen" i], [class*="loading-shimmer" i], [class*="result-thinking" i], [aria-busy="true"]');
  }
  // v3.2.2 : detection de production historique + garde-fou pour conversations réutilisées.
  // La nouvelle image doit être apparue APRES le prompt de ce travail ET ne pas faire
  // partie de l'inventaire pris AVANT l'envoi. Aucune décision fondée sur la « dernière
  // image du chat » : ce serait une source de mélange de scènes.
  const newImage = (before) => {
    const anchor = userItem();
    const fresh = generatedImages().filter(img => !before.has(imgSrc(img)) &&
      (!anchor || (!anchor.contains(img) && !!(anchor.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING))));
    if (!fresh.length) return null;
    const gallery = fresh.filter(img => img.closest('[data-testid="generated-image-gallery"], [data-testid="generated-image-preview"]') ||
      /image g[ée]n[ée]r[ée]e|generated image/i.test(img.alt || ''));
    // Stable historical choice: final generated image in the newest assistant turn.
    return (gallery.length ? gallery : fresh).slice(-1)[0];
  };
  const REFUS = /système de sécurité|bloqué la génération|ne (peux|pouvons) pas (générer|créer|t'aider|vous aider)|politique de contenu|règles de contenu|enfreint|n'est pas autorisé|content polic|violat|can't (help|create|generate)|cannot (create|generate)|unable to (create|generate)|safety system/i;
  async function waitNewImage(before, timeout, label, validate) {
    const t0 = Date.now(); let last = null, stable = 0, idle = 0, lastText = '';
    while (Date.now() - t0 < timeout) {
      await sleep(3000);
      const b = generating(), img = newImage(before), src = img ? imgSrc(img) : null, txt = lastAssistantText();
      say((label || 'ChatGPT dessine') + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s');
      if (Math.round((Date.now() - t0) / 1000) % 30 < 3) dbg('attente image', { generating: b, turnDone: turnDone(), image: !!img, stable });
      if (img) {
        if (src === last) stable++; else stable = 0; last = src;
        if ((!b && stable >= 2) || (turnDone() && stable >= 1) || stable >= 6) {
          if (!validate) return img;
          let why = '';
          try { why = await validate(img); } catch (e) { why = ''; }
          if (!why) return img;
          before.add(src); lastErr = why; stable = 0; last = null; draw();   // mauvaise image : on l'ignore et on continue d'attendre
        }
      } else {
        stable = 0; last = null;
        // refus de sécurité de ChatGPT : on le dit tout de suite au studio au lieu d'attendre 5 min pour rien
        if (!b && txt && REFUS.test(txt) && (turnDone() || Date.now() - t0 > 20000)) throw new Error('ChatGPT a refusé l\'image (filtre de sécurité) : ' + txt.replace(/\s+/g, ' ').slice(0, 160));
      }
      if (txt !== lastText) { lastText = txt; idle = 0; }
      if (!img && !b) { idle = idle || Date.now(); if (Date.now() - idle > 5 * 60000) return null; } else idle = 0;
    }
    return null;
  }
  async function postResult(body) {
    for (let i = 0; i < 4; i++) {
      try { return await call('POST', withWorker('/bridge/result'), body); }
      catch (e) { if (/travail inconnu|autre onglet propri[ée]taire|HTTP (?:404|409)/i.test(e.message)) throw e; await sleep(5000); }
    }
    throw new Error('Tampermonkey ne confirme pas l’enregistrement de l’image');
  }
  function pending() {
    const m = get(PENDING_IMAGE_KEY);
    if (m?.chunks) {
      const data = readLarge(PENDING_IMAGE_KEY + ':image');
      return data ? { id: m.id, data } : { id: m.id, corrupt: true };
    }
    if (m?.data) return m;
    // Migration v3.2.0 : ne pas prendre le résultat d'un autre onglet ChatGPT.
    const old = get(OLD_PENDING_IMAGE_KEY), owner = old?.id ? get(jk('bridge', old.id)) : null;
    return old?.data && owner?.worker === WORKER ? old : null;
  }
  function savePending(payload) {
    storeLarge(PENDING_IMAGE_KEY + ':image', payload.data);
    set(PENDING_IMAGE_KEY, { id: payload.id, chunks: true });
  }
  function clearPending() {
    deleteLarge(PENDING_IMAGE_KEY + ':image'); del(PENDING_IMAGE_KEY);
    const old = get(OLD_PENDING_IMAGE_KEY), owner = old?.id ? get(jk('bridge', old.id)) : null;
    if (old && owner?.worker === WORKER) del(OLD_PENDING_IMAGE_KEY);
  }
  async function deliverSavedResult(payload) {
    // Sauvegarder l'image complète AVANT toute tentative de retour vers YakFlow.
    savePending(payload);
    const ack = await postResult(payload);
    if (ack?.ignore) throw new Error('YakFlow ne confirme pas encore la réception : image conservée pour nouvelle tentative automatique.');
    clearPending();
    try { sessionStorage.removeItem(ACTIVE_KEY); } catch (_) {}
    return ack;
  }
  async function recoverSavedResult() {
    const p = pending();
    if (p?.corrupt) { say('Image sauvegardée mais stockage incomplet : récupération manuelle nécessaire'); lastErr = 'Ne relance pas cette image : utilise la récupération manuelle YakFlow Connect.'; return true; }
    if (!p?.id || !p?.data) return false;
    say('Image générée déjà sauvegardée : transfert en cours…');
    try { await deliverSavedResult(p); lastErr = ''; }
    catch (e) { lastErr = 'Image sauvée. Transfert non confirmé : ' + e.message; }
    return true; // Ne pas lancer une nouvelle génération tant que l'ancien résultat est à transférer.
  }
  GM_registerMenuCommand('YakFlow Connect · enregistrer image récupérée sur disque', () => {
    const p = pending();
    if (!p?.data) return alert('Aucun résultat en attente de transfert.');
    const a = document.createElement('a'); a.href = p.data; a.download = 'yakflow-image-recuperee-' + String(p.id).replace(/[^a-z0-9-]/gi,'-') + '.jpg'; document.body.appendChild(a); a.click(); a.remove();
  });
  // Image arrivée après un délai : ne jamais déclencher automatiquement une seconde génération.
  let late = null;
  // Après un rechargement, reprendre AUTOMATIQUEMENT la génération déjà envoyée.
  // Attribution sûre uniquement depuis le message utilisateur correspondant au prompt.
  // Tant que le résultat n'est pas identifié, ne jamais relancer ChatGPT ou mélanger
  // l'image d'un autre tour. Aucun clic requis durant un fonctionnement normal.
  let recoveryBlocked = null;
  try {
    const old = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || 'null');
    if (old && old.id && !pending()) recoveryBlocked = old;
  } catch (_) {}
  async function recoverAfterReload() {
    if (!recoveryBlocked) return false;
    const job = recoveryBlocked;
    // Le résultat peut déjà avoir été correctement remis au pont juste avant
    // le rechargement. Dans ce cas, ne pas reconstituer une image une seconde fois.
    try {
      const state = await call('GET', withWorker('/bridge/status?id=' + encodeURIComponent(job.id)));
      if (state.st === 'fini' && state.data) {
        recoveryBlocked = null;
        sessionStorage.removeItem(ACTIVE_KEY);
        say('Image déjà enregistrée dans le pont ; YakFlow va la récupérer automatiquement.');
        return true;
      }
      if (!state.st || state.st === 'oublie') {
        recoveryBlocked = null;
        sessionStorage.removeItem(ACTIVE_KEY);
        say('Travail clôturé ; retour à la file YakFlow.');
        return true;
      }
    } catch (_) { /* le pont réessaiera lors du prochain passage */ }
    sentPrompt = job.prompt || '';
    const anchor = userItem();
    if (!anchor) { say('Récupération automatique : attente du message ChatGPT de « ' + job.nom + ' »'); return true; }
    const candidates = generatedImages().filter(img => !anchor.contains(img) &&
      !!(anchor.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING));
    const last = candidates[candidates.length - 1];
    if (!last || generating()) { say('Récupération automatique : ChatGPT termine « ' + job.nom + ' »'); return true; }
    // Check the image shape, without guessing the association using a generic gallery.
    let reason = '';
    try { reason = await checkResult(await fetchBlob(imgSrc(last)), { prompt: job.prompt || '' }, []); }
    catch (e) { reason = 'résultat non lisible : ' + e.message; }
    if (reason) { lastErr = 'Image retrouvée non attribuée (' + reason + ')'; return true; }
    busy = true;
    try {
      const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(last)));
      await deliverSavedResult({ id: job.id, data });
      recoveryBlocked = null; lastErr = ''; say('Image récupérée automatiquement après actualisation : ' + job.nom);
    } catch (e) { lastErr = 'Récupération automatique : ' + e.message; }
    finally { busy = false; }
    return true;
  }
  GM_registerMenuCommand('YakFlow Connect · récupérer une image après rechargement', async () => {
    if (!recoveryBlocked) return alert('Aucune génération interrompue à récupérer.');
    const img = findGeneratedImage();
    if (!img) return alert('Aucune image générée visible dans cette conversation. Fais défiler jusqu’au résultat attendu.');
    if (!confirm('ATTENTION : vérifie visuellement que la DERNIÈRE image affichée est bien celle de « ' + recoveryBlocked.nom + ' ». Le pont ne peut pas le prouver après un rechargement. Envoyer cette image à YakFlow ?')) return;
    busy = true;
    try {
      const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img)));
      await deliverSavedResult({ id: recoveryBlocked.id, data });
      recoveryBlocked = null; lastErr = ''; say('Image récupérée manuellement et transmise au Studio.');
    } catch (e) { lastErr = 'Récupération : ' + e.message; }
    finally { busy = false; }
  });
  GM_registerMenuCommand('YakFlow Connect · récupérer une image déjà générée (sans relancer)', async () => {
    const list = keys('bridge:job:').map(k => get(k)).filter(j => j &&
      ['en cours', 'incertain', 'echec'].includes(j.st) && (!j.worker || j.worker === WORKER))
      .sort((a,b) => (b.claimedAt || b.createdAt || 0) - (a.claimedAt || a.createdAt || 0));
    if (!list.length) return alert('Aucune image en attente ou incertaine pour CET onglet.');
    const label = list.slice(0, 8).map((j,i) => (i+1) + ' · ' + j.id + ' · ' + j.st).join('\n');
    const choice = prompt('Sélectionne le NUMÉRO de la génération déjà visible dans ce chat :\n' + label, '1');
    if (choice == null) return;
    const j = list[Number(choice) - 1];
    if (!j) return alert('Numéro inconnu.');
    const img = findGeneratedImage() || generatedImages().slice(-1)[0];
    if (!img) return alert('Aucune image visible ; fais défiler le chat jusqu’au résultat et réessaie.');
    if (!confirm('Vérifie VISUELLEMENT l’image affichée avant validation.\nProjet : ' + j.id +
      '\nScène : ' + (get(pk('bridge', j.id))?.nom || '') +
      '\nUne mauvaise association casserait la cohérence de tes scènes. Transférer la dernière image générée de cette conversation ?')) return;
    busy = true;
    try {
      const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img)));
      const ack = await deliverSavedResult({ id: j.id, data });
      if (ack?.ok) { lastErr=''; say('Image récupérée et disponible pour YakFlow : ' + j.id); alert('Image récupérée dans le pont. Si YakFlow affiche déjà un échec, clique « Relancer img » sur CETTE scène : la copie est déjà stockée, elle ne sera pas générée à nouveau.'); }
    } catch(e) { lastErr = 'Récupération échouée : ' + e.message; alert(lastErr + '\nLa copie reste disponible dans Tampermonkey.'); }
    finally { busy = false; }
  });
  GM_registerMenuCommand('YakFlow Connect · marquer génération interrompue INCERTAINE', async () => {
    if (!recoveryBlocked || !confirm('Marquer cette génération INCERTAINE sans la relancer ? Tu pourras inspecter la conversation et décider manuellement.')) return;
    try { await call('POST', withWorker('/bridge/result'), { id: recoveryBlocked.id, error: 'Génération interrompue lors du rechargement ; vérification manuelle nécessaire.', incertain: true });
      sessionStorage.removeItem(ACTIVE_KEY); recoveryBlocked = null; say('Image incertaine : pas de relance automatique.'); }
    catch (e) { alert('Impossible de signaler le statut : ' + e.message); }
  });


  /* ---------- badge ---------- */
  const badge = document.createElement('div');
  badge.id = 'pont-agnes';
  badge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;font:600 12px/1.3 -apple-system,system-ui,sans-serif;' +
    'background:#141619;color:#f3f0e9;border:1px solid rgba(255,178,36,.5);border-radius:10px;padding:8px 11px;box-shadow:0 10px 30px rgba(0,0,0,.4);' +
    'cursor:pointer;max-width:300px;user-select:none';
  badge.title = 'Cliquer pour mettre le pont en pause ou le relancer';
  badge.onclick = () => { GM_setValue(K_ON, !GM_getValue(K_ON, true)); draw(); };
  document.body.appendChild(badge);
  function draw() {
    const on = GM_getValue(K_ON, true);
    badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffb224;margin-right:6px;vertical-align:1px"></span>Pont YakFlow <span style="opacity:.6">v' + CONNECT_VERSION + '</span> · ' + (on ? '' : '<b>en pause</b> · ') + info.replace(/[<>&]/g, '') +
      (lastErr ? '<div style="color:#ff9188;font-weight:500;margin-top:3px">' + lastErr.replace(/[<>&]/g, '') + '</div>' : '') +
      (awake() ? '' : '<div style="color:#ffc757;font-weight:500;margin-top:3px">Clique une fois dans cet onglet pour qu’il continue en arrière-plan.</div>');
    if (typeof dbtn !== 'undefined') badge.appendChild(dbtn);
  }
  function say(t) { info = t; draw(); }
  // Diagnostic : copie dans le presse-papiers tout ce qu'il faut pour comprendre ce que le script voit dans la page
  const brief = (el) => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.attributes].filter((a) => /^(data-|aria-|role)/.test(a.name)).map((a) => '[' + a.name + '=' + String(a.value).slice(0, 40) + ']').join('') : '';
  function chain(el, n) { const o = []; for (let i = 0; el && i < (n || 6); i++, el = el.parentElement) o.push(brief(el)); return o; }
  function diagnostic() {
    const imgs = [...document.querySelectorAll('img')].filter((i) => i.naturalWidth > 100).map((i) => ({ host: (imgSrc(i).match(/^[a-z]+:\/\/[^/]+/) || [imgSrc(i).slice(0, 20)])[0], w: i.naturalWidth, h: i.naturalHeight, alt: (i.alt || '').slice(0, 40), complete: i.complete, inMain: !!i.closest('main'), chain: chain(i, 7) }));
    const turns = [...document.querySelectorAll(ITEM_SEL + ', [data-conversation-role]')].slice(-8).map((e) => ({ el: brief(e), text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120), buttons: [...e.querySelectorAll('button')].slice(0, 10).map(brief) }));
    const buttons = [...document.querySelectorAll('main button, form button')].filter(isVisible).slice(-14).map(brief);
    const asst = lastAssistant();
    return JSON.stringify({ version: VERSION, url: location.pathname, info, lastErr, busy, pendingImage: !!pending(), activeJob: sessionStorage.getItem(ACTIVE_KEY)?.slice(0,300), late: late ? late.nom : null,
      state: { loadingUi: loadingUi(), hasConversation: hasConversation(), userItemFound: !!userItem(), generating: generating(), stopButton: chatgptBusy(), turnDone: turnDone(), foundImage: !!findGeneratedImage(), generatedImages: generatedImages().length },
      lastAssistantHtmlHead: asst ? asst.outerHTML.slice(0, 600) : null, imgs, turns, buttons, shimmer: [...document.querySelectorAll('[class*="shimmer" i], [aria-busy="true"], [data-testid*="image" i]')].slice(0, 8).map((e) => brief(e) + ' .' + String(e.className).slice(0, 60)) }, null, 1);
  }
  let failDiag = null;   // photo de l'état de la page au moment du dernier échec
  const dbtn = document.createElement('div');
  dbtn.textContent = 'Copier le diagnostic';
  dbtn.style.cssText = 'margin-top:6px;font:500 11px/1 -apple-system,system-ui,sans-serif;color:#ffb224;text-decoration:underline;cursor:pointer';
  dbtn.onclick = async (e) => {
    e.stopPropagation();
    const txt = failDiag && Date.now() - failDiag.t < 30 * 60000 ? failDiag.txt : diagnostic();
    try { await navigator.clipboard.writeText(txt); dbtn.textContent = 'Diagnostic copié, colle-le dans le chat'; }
    catch (err) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); dbtn.textContent = 'Diagnostic copié (méthode 2)'; }
    setTimeout(() => { dbtn.textContent = 'Copier le diagnostic'; }, 6000);
  };

  /* ---------- boucle ---------- */
  async function doJob(job) {
    say('image : ' + job.nom);
    const field = await waitFor(findPromptField, 30000);
    if (!field) throw new Error('zone de texte ChatGPT introuvable');
    sentPrompt = job.prompt;
    const before = new Set(generatedImages().map(imgSrc));
    const rp = refPlan(job.refs || [], job);
    const files = rp.uploads.map((r) => dataUrlToFile(r.data, r.name));
    const refHashes = [];
    for (const r of job.refs || []) { try { refHashes.push(hashOf(await bitmapOf(r.data))); } catch (e) { /* tant pis */ } }
    const validate = async (img) => checkResult(await fetchBlob(imgSrc(img)), job, refHashes);
    // 1. les fiches d'abord (comme la Régie), en vérifiant que les vignettes apparaissent
    if (files.length) {
      if (attachLimit()) throw attachError();
      say('ajout de ' + files.length + ' fiche(s) : ' + job.nom);
      if (!(await attachAndCheck(files, field))) { if (attachLimit()) throw attachError(); throw new Error('fiches non jointes (aucune vignette n\'apparaît)'); }
      await sleep(2500);
    }
    // 2. puis le prompt, vérifié
    if (!(await setPrompt(job.prompt + rp.suffix))) throw new Error('impossible d\'écrire le prompt dans ChatGPT');
    if (files.length && attachedCount() < files.length) throw new Error('les fiches ont disparu après le prompt');
    const send = await waitFor(() => { const b = findSendButton(); return b && !b.disabled ? b : null; }, 120000, 1000);
    if (!send) throw new Error('bouton Envoyer introuvable (fiches pas encore chargées ?)');
    // L'état est enregistré avant l'envoi : rechargement de l'onglet = récupération, jamais re-génération.
    try { sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({id:job.id,nom:job.nom,prompt:job.prompt,t:Date.now(),before:[...before]})); } catch (_) {}
    job.submitted = true;
    send.click();
    // Les pièces jointes sont maintenant présentes dans cette conversation, y compris si la génération échoue.
    const c = rp.mem; c.sent++; c.uploaded = (c.uploaded || 0) + rp.uploads.length; c.reused = (c.reused || 0) + (rp.original.length - rp.uploads.length);
    for (const r of rp.newly) if (isPersistentSheet({name:r.name})) {
      const old = c.refs.find(x => x.hash === r.hash);
      if (old) Object.assign(old, { job: job.id, attachedAt: c.sent, name: r.name });
      else c.refs.push({ ...r, job: job.id, attachedAt: c.sent });
    }
    c.refs = c.refs.slice(-75); saveRefSession(c);
    const img = await waitNewImage(before, 15 * 60000, 'ChatGPT dessine : ' + job.nom, validate);
    if (!img) {
      if (limitReached()) throw new Error('limite ChatGPT atteinte');
      late = { id: job.id, nom: job.nom, before, t: Date.now(), validate };
      throw new Error('aucune image reçue (je la récupère si elle arrive en retard)');
    }
    say('image détectée · conversion et transfert : ' + job.nom);
    const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img)));
    await deliverSavedResult({ id: job.id, data });
    say('image stockée et vérifiée pour YakFlow : ' + job.nom);
  }

  let lastBeat = 0;
  async function loop() {
    let pauseUntil = 0, genSince = 0, serverReady = false, idle = 0;
    for (;;) {
      // YAKFLOW_POLL_V16 : 4 s quand il y a du travail, puis on ralentit jusqu'à 30 s quand il n'y a rien à faire
      await sleep(Math.min(10000, 3000 + idle * 1000));   // file locale : interroger souvent ne coûte rien
      draw();
      if (!serverReady) {
        try {
          const st = await call('GET', '/bridge/status');
          serverReady = st.protocol >= 2;
          if (!serverReady) { say('redémarre serveur.py'); lastErr = 'Pont mis à jour, mais ancien serveur encore actif (HTTP 404).'; continue; }
          await call('POST', withWorker('/bridge/hello'));
          lastErr = '';
        } catch (e) { say('studio non joignable'); lastErr = 'Lance serveur.py (Agnes Studio).'; continue; }
      }
      // YAKFLOW_CHAT_HEAL_V1 : le studio demande une relance (rien n'avance) → on recharge l'onglet, sauf s'il dessine depuis moins de 20 min
      { const ra = get('bridge:reloadAt', 0); if (ra > PAGE_T0 && (!busy || Date.now() - busySince > 20 * 60000)) { say('relance demandée par le studio'); await sleep(500); location.reload(); return; } }
      if (busy || !GM_getValue(K_ON, true) || Date.now() < pauseUntil) continue;
      if (await recoverSavedResult()) continue;
      if (await recoverAfterReload()) continue;
      // V3.3.1 : après un upload interrompu, retirer automatiquement les seules
      // références nommées `ref-N-...` par YakFlow avant la prochaine scène.
      // Aucun clic manuel requis ; conserver et attendre si des fichiers personnels subsistent.
      if (!recoveryBlocked && !late && attachedCount() > 0) {
        await clearYakFlowDraft();
        if (attachedCount() > 0) {
          if (!yakFlowDraftButtons().length) say('Brouillon avec pièce(s) jointe(s) non YakFlow : je les préserve.');
          continue;
        }
        // Une fois nettoyé, la boucle poursuit et reprend la file toute seule.
      }
      if (recoveryBlocked) { say('Récupération automatique en cours : ' + recoveryBlocked.nom); continue; }
      if (late) {
        let img = !generating() && newImage(late.before);
        if (img && late.validate) { const why = await late.validate(img).catch(() => ''); if (why) { late.before.add(imgSrc(img)); img = null; } }
        if (img) {
          busy = true;
          try { const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img))); await deliverSavedResult({ id: late.id, data }); say('image en retard rendue : ' + late.nom); lastErr = ''; }
          catch (e) { lastErr = late.nom + ' : ' + e.message; }
          finally { late = null; busy = false; }
          continue;
        }
        // Une image retardée n'entraîne plus d'échec automatique ni de nouveau rendu.
        // Continuer à surveiller le résultat existant, même après 10 minutes.
        say("Récupération automatique de l'image en retard : " + late.nom);
        continue;

      }
      // ChatGPT dessine encore (image en retard, ou autre) : on n'envoie RIEN tant qu'il n'a pas fini
      if (hasConversation() && generating()) {
        genSince = genSince || Date.now();
        if (Date.now() - genSince < 4 * 60000) { say('ChatGPT travaille encore, j\'attends qu\'il ait fini'); continue; }
      } else genSince = 0;
      let job;
      try { job = (await call('GET', withWorker('/bridge/peek?info=' + encodeURIComponent(info)))).job; lastErr = ''; }
      catch (e) { say('studio non joignable'); lastErr = 'Lance serveur.py (Agnes Studio).'; continue; }
      lastBeat = Date.now();
      if (!job) { idle = Math.min(idle + 1, 9); say('rien à faire'); continue; }
      idle = 0;
      dbg('travail reçu', { id: job.id, nom: job.nom });
      if (late && job.id === late.id) { say('j\'attends encore l\'image de ' + late.nom); continue; }   // ne pas la redessiner tout de suite
      // Réutiliser cette conversation évite de retéléverser les mêmes fiches personnage.
      // L'identification de la nouvelle image se fait à partir des URL présentes AVANT cet envoi.
      busy = true; busySince = Date.now();
      let taken = false;
      try {
        // Attribution atomique : deux onglets ne peuvent pas recevoir la même image.
        job = (await call('POST', withWorker('/bridge/take'))).job;
        if (!job) { busy = false; continue; }
        taken = true;
        await doJob(job); lastErr = ''; say('image rendue : ' + job.nom); await sleep(4000);
      }
      catch (e) {
        lastErr = (job?.nom || 'Pont') + ' : ' + e.message;
        try { failDiag = { t: Date.now(), txt: diagnostic() }; } catch (x) { /* tant pis */ }
        if (e.attachUntil && !job.submitted) {
          // Cette scène attend son quota d'UPLOAD ; les scènes utilisant les fiches déjà envoyées restent possibles.
          if (taken) await call('POST', withWorker('/bridge/release'), { id: job.id, until: e.attachUntil }).catch(() => {});
          say('Import bloqué jusqu’à ' + new Date(e.attachUntil).toLocaleTimeString('fr-FR') + ' ; autres scènes sans nouvelles pièces jointes autorisées.');
        } else if (taken && !(late && late.id === job.id) && !pending()) {
          await call('POST', withWorker('/bridge/result'), { id: job.id, error: job.submitted ? 'Génération incertaine : ' + e.message : e.message, incertain: !!job.submitted }).catch(() => {});
          if (!job.submitted) { try { sessionStorage.removeItem(ACTIVE_KEY); } catch (_) {} }
        }
        if (!job.submitted && /limite (?:de g[ée]n[ée]ration|d.images)|image generation limit/i.test(e.message)) { pauseUntil = Date.now() + 20 * 60000; say('quota de génération ChatGPT atteint'); }
      } finally { busy = false; }
    }
  }
  draw();
  // signal de vie seulement quand la boucle n'a pas déjà parlé au serveur (pendant qu'une image se dessine, surtout)
  setInterval(() => { if (Date.now() - lastBeat < 25000) return; lastBeat = Date.now(); call('POST', withWorker('/bridge/heartbeat?info=' + encodeURIComponent(info))).catch(() => {}); }, 25000);
  loop();

  }

  function runGrok() {
const K_ON='yakflow_grok_on';
keepAwake();
const worker=sessionStorage.getItem('agnesGrokWorker') ||
  ('grok-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
sessionStorage.setItem('agnesGrokWorker',worker);

let busy=false, current='', lastErr='', state='démarrage', pauseUntil=0;

function gm(method,url,{data=null,headers={},responseType='json',timeout=30000}={}) {
  return new Promise((resolve,reject)=>{
    GM_xmlhttpRequest({
      method,url,data,headers,responseType,timeout,
      onload:r=>{
        if(r.status<200||r.status>=300) return reject(new Error('HTTP '+r.status+' '+String(r.responseText||'').slice(0,180)));
        resolve(r.response);
      },
      onerror:()=>reject(new Error('réseau')),
      ontimeout:()=>reject(new Error('timeout'))
    });
  });
}
// YAKFLOW_CONNECT : la file Grok est dans le navigateur (hub), plus de serveur
function api(method,path,data) {
  return hub('grok',method,path,data,worker).then(r=>r.status<400?r.json:Promise.reject(new Error((r.json&&r.json.detail)||('HTTP '+r.status))));
}
function visible(el){
  if(!el)return false;
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width>2&&r.height>2&&s.visibility!=='hidden'&&s.display!=='none';
}
function txt(el){return ((el?.innerText||el?.textContent||'')+' '+(el?.getAttribute?.('aria-label')||'')+' '+(el?.getAttribute?.('title')||'')).trim();}
function allButtons(){return [...document.querySelectorAll('button,[role="button"]')].filter(visible);}
function findButton(rx,exclude){
  return allButtons().find(b=>rx.test(txt(b))&&!(exclude&&exclude.test(txt(b))));
}
async function waitFor(fn,ms=15000,step=250){
  const end=Date.now()+ms;
  while(Date.now()<end){const v=fn();if(v)return v;await sleep(step);}
  return null;
}
function setState(s){state=s;draw();}

function draw(){
  let box=document.getElementById('agnes-grok-box');
  if(!box){
    box=document.createElement('div');box.id='agnes-grok-box';
    box.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#101216;color:#eee;border:1px solid #3a404a;border-radius:12px;padding:10px 12px;width:270px;font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 35px #0008';
    document.documentElement.appendChild(box);
  }
  const on=GM_getValue(K_ON,true);
  box.innerHTML='<div style="display:flex;align-items:center;gap:8px"><b style="color:#ffb224">Pont Grok</b><span style="opacity:.6">v'+CONNECT_VERSION+'</span><span style="opacity:.55">'+worker.slice(-8)+'</span><button id="agnes-grok-toggle" style="margin-left:auto;border:0;border-radius:7px;padding:4px 7px;background:'+(on?'#2f8f63':'#555')+';color:white">'+(on?'ON':'OFF')+'</button></div>'+
    '<div style="margin-top:6px">'+escapeHtml(state)+'</div>'+(awake()?'':'<div style="margin-top:4px;color:#ffc757">Clique une fois dans cet onglet pour qu’il continue en arrière-plan.</div>')+
    (current?'<div style="opacity:.7;margin-top:3px">'+escapeHtml(current)+'</div>':'')+
    (lastErr?'<div style="color:#ff8c82;margin-top:5px">'+escapeHtml(lastErr)+'</div>':'');
  box.querySelector('#agnes-grok-toggle').onclick=()=>{GM_setValue(K_ON,!on);lastErr='';draw();};
}
function escapeHtml(s){const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}

function dataUrlFile(dataUrl,name='agnes-frame.jpg'){
  const [head,b64]=dataUrl.split(',');
  const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg';
  const bin=atob(b64),u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  return new File([u],name,{type:mime});
}
async function chooseVideoMode(){
  // DOM Grok actuel : bouton role=radio aria-label="Vidéo".
  const exact=[...document.querySelectorAll('button[role="radio"]')].find(b=>
    visible(b) && /^(vid[eé]o|video)$/i.test((b.getAttribute('aria-label')||txt(b)).trim()));
  if(exact && exact.getAttribute('aria-checked')!=='true'){exact.click();await sleep(650);return;}
  const b=findButton(/^(video|vidéo)$|\b(video|vidéo)\b/i,/download|upscale|share|saved/i);
  if(b && b.getAttribute('aria-checked')!=='true'){b.click();await sleep(650);}
}
async function uploadImage(dataUrl){
  const file=dataUrlFile(dataUrl);
  // DOM Grok actuel : <form> ... <input hidden multiple accept="image/..." name="files">
  let inp=document.querySelector('form input[type="file"][name="files"][accept*="image"]') ||
          [...document.querySelectorAll('input[type="file"]')].find(x=>
            !x.disabled && (!x.accept || /image|\*/i.test(x.accept)));
  if(!inp){
    const up=findButton(/^(importer|upload)$|télévers|ajouter.*image|add.*image|attach|joindre|reference/i);
    if(up){up.click();await sleep(450);}
    inp=await waitFor(()=>document.querySelector('form input[type="file"][name="files"][accept*="image"]') ||
      [...document.querySelectorAll('input[type="file"]')].find(x=>!x.disabled&&(!x.accept||/image|\*/i.test(x.accept))),5000);
  }
  if(!inp)throw new Error("champ d'import image Grok introuvable");
  const dt=new DataTransfer();dt.items.add(file);
  Object.defineProperty(inp,'files',{configurable:true,value:dt.files});
  inp.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
  inp.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
  // Attend que Grok ait réellement traité la pièce jointe.
  await sleep(2200);
}
function composer(){
  // DOM Grok octobre 2026 : TipTap / ProseMirror dans data-testid="chat-input".
  const exact=document.querySelector('[data-testid="chat-input"] [contenteditable="true"][role="textbox"]');
  if(exact&&visible(exact))return exact;
  const labelled=[...document.querySelectorAll('[contenteditable="true"][role="textbox"]')].find(e=>
    visible(e)&&/ask grok|décrivez|imagine/i.test((e.getAttribute('aria-label')||'')+' '+txt(e)));
  if(labelled)return labelled;
  const ta=[...document.querySelectorAll('textarea')].find(visible);
  if(ta)return ta;
  return [...document.querySelectorAll('[contenteditable="true"]')].find(visible);
}
function setPrompt(el,prompt){
  el.focus();
  if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){
    const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    setter?setter.call(el,prompt):(el.value=prompt);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return;
  }
  // TipTap/ProseMirror réagit mieux à une vraie insertion éditable qu'à textContent seul.
  try{
    const sel=window.getSelection(),range=document.createRange();
    range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);
    if(document.execCommand)document.execCommand('insertText',false,prompt);
  }catch(_){}
  if((el.innerText||'').trim()!==prompt.trim()){
    el.innerHTML='';
    const p=document.createElement('p');p.textContent=prompt;el.appendChild(p);
  }
  el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:prompt}));
  el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
}
async function submitPrompt(prompt){
  const c=await waitFor(composer,12000);
  if(!c)throw new Error('zone de prompt Grok introuvable');
  setPrompt(c,prompt);
  await sleep(900);
  const form=c.closest('form')||document.querySelector('form');
  // Après saisie Grok affiche son contrôle d'envoi. Priorité au submit/aria-label explicite.
  let b=form && [...form.querySelectorAll('button')].filter(visible).find(x=>{
    const a=((x.getAttribute('aria-label')||'')+' '+txt(x)).trim();
    return x.type==='submit'||/envoyer|send|générer|generate|créer|create|animate|animer/i.test(a);
  });
  // Exclut les contrôles connus du composer (Importer, Vidéo, audio, durée, résolution...).
  if(!b && form){
    b=[...form.querySelectorAll('button')].filter(visible).find(x=>{
      const a=((x.getAttribute('aria-label')||'')+' '+txt(x)).trim();
      return !/importer|dictée|micro|image|vid[eé]o|audio|résolution|durée|proportions|720p|1080p|sourdine/i.test(a)
        && (x.closest('.absolute.end-2.bottom-0')||x.type==='submit');
    });
  }
  if(b){b.click();await sleep(500);return;}
  // Grok/TipTap accepte Entrée pour envoyer ; Shift+Entrée sert au retour ligne.
  c.focus();
  c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  c.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  await sleep(500);
}
function generationProgress(){
  // DOM fourni : "Génération en cours" + pourcentage + bouton Annuler.
  const nodes=[...document.querySelectorAll('span,div')].filter(visible);
  const hit=nodes.find(e=>/^Génération en cours(?:\s+\d+%)?$/i.test((e.innerText||'').trim()));
  if(!hit)return null;
  const root=hit.closest('div.flex.justify-center.items-center')||hit.parentElement?.parentElement||hit.parentElement;
  const t=(root?.innerText||hit.innerText||'').trim();
  const m=t.match(/(\d+)%/);
  return {text:t,percent:m?Number(m[1]):null};
}
function finishedVideos(){
  // DOM fourni : video#sd-video avec URL .../generated_video.mp4?cache=1.
  return [...document.querySelectorAll('video#sd-video,video[src*="generated_video.mp4"],video')].filter(v=>{
    const k=videoKey(v);
    return visible(v)&&k&&(/generated_video\.mp4/i.test(k)||v.id==='sd-video')&&(v.readyState>=2||v.duration>0);
  });
}
function videoKey(v){return v.currentSrc||v.src||v.querySelector?.('source')?.src||'';}
async function waitNewVideo(before,timeout=8*60*1000){
  const end=Date.now()+timeout;
  let sawProgress=false;
  while(Date.now()<end){
    const limit=[...document.querySelectorAll('body *')].filter(visible).some(e=>
      /usage limit|limite.*utilisation|try again later|rate limit/i.test(txt(e))&&txt(e).length<240);
    if(limit)throw new Error('limite Grok détectée');

    const prog=generationProgress();
    if(prog){
      sawProgress=true;
      setState('Grok anime…'+(prog.percent!==null?' '+prog.percent+'%':''));
    }

    const vids=finishedVideos();
    const v=vids.find(x=>{const k=videoKey(x);return k&&!before.has(k);});
    if(v && (!prog || sawProgress)){
      // Le MP4 final est présent. Petite marge pour laisser React stabiliser src/currentSrc.
      await sleep(1400);
      return v;
    }
    await sleep(700);
  }
  throw new Error('aucune nouvelle vidéo Grok après 8 min');
}
async function videoBlob(v){
  const src=videoKey(v);
  if(!src)throw new Error('URL vidéo Grok introuvable');
  if(src.startsWith('blob:')||src.startsWith('data:')){
    const r=await fetch(src);if(!r.ok)throw new Error('lecture vidéo '+r.status);return r.blob();
  }
  return gm('GET',src,{responseType:'blob',timeout:120000});
}
async function postVideo(job,blob){
  const buf=await blob.arrayBuffer();
  const size=2_000_000,total=Math.ceil(buf.byteLength/size);
  if(total>100)throw new Error('Vidéo Grok trop volumineuse');
  for(let part=0;part<total;part++){
    const chunk=buf.slice(part*size,Math.min(buf.byteLength,(part+1)*size));
    const r=await hub('grok','POST','result-chunk?id='+encodeURIComponent(job.id)+'&part='+part+'&total='+total,chunk,worker);
    if(r.status>=400)throw new Error((r.json&&r.json.detail)||'transfert vidéo refusé');
  }
  return api('POST','result-complete?id='+encodeURIComponent(job.id));
}
async function fail(job,e){
  try{await api('POST','fail',{id:job.id,error:e.message||String(e)});}catch(_){}
}
async function doJob(job){
  current=(job.titre?job.titre+' · ':'')+(job.nom||job.id);
  setState('préparation du clip');
  const before=new Set([...document.querySelectorAll('video')].map(videoKey).filter(Boolean));
  await chooseVideoMode();
  setState('envoi de l’image');
  await uploadImage(job.image);
  await chooseVideoMode();
  const motion=(job.prompt||'').trim();
  const prompt=motion + (motion?'\n\n':'') +
    'Animate this exact starting image as a coherent cinematic shot. Preserve character identity, clothing, environment and composition. '+
    'Camera motion and action must follow the instructions precisely. Duration target: '+job.seconds+' seconds. Aspect ratio: '+job.aspect+'.';
  setState('envoi du prompt');
  await submitPrompt(prompt);
  setState('Grok anime…');
  const v=await waitNewVideo(before);
  setState('récupération de la vidéo');
  const blob=await videoBlob(v);
  if(!blob||blob.size<10000)throw new Error('vidéo reçue trop petite');
  setState('retour vers YakFlow');
  await postVideo(job,blob);
  setState('clip rendu · '+Math.round(blob.size/1024/1024*10)/10+' Mo');
  await sleep(1800);
  current='';
  // Nettoie l'état Grok pour le clip suivant.
  location.assign('https://grok.com/imagine');
}

let lastBeat=0;
async function heartbeat(){
  if(Date.now()-lastBeat<25000)return; lastBeat=Date.now();
  try{await api('POST','heartbeat?info='+encodeURIComponent(document.title||'Grok Imagine'));}catch(_){}
}
async function loop(){
  draw();
  setInterval(heartbeat,25000);heartbeat();
  let idle=0;
  for(;;){
    // YAKFLOW_POLL_V16 : 1,6 s quand il y a du travail, jusqu'à 30 s quand la file est vide
    await sleep(Math.min(8000,1600+idle*1000));
    if(busy||!GM_getValue(K_ON,true)||Date.now()<pauseUntil)continue;
    if(!/\/imagine/.test(location.pathname)){setState('ouvre Grok Imagine');continue;}
    let r;
    try{r=await api('POST','take?info='+encodeURIComponent(document.title||'Grok Imagine'));}
    catch(e){lastErr='Ouvre l’onglet YakFlow.';setState('en attente de YakFlow');draw();continue;}
    lastBeat=Date.now();
    if(!r?.job){idle=Math.min(idle+1,9);lastErr='';setState('en attente d’un clip');draw();continue;}
    idle=0;
    const job=r.job;busy=true;lastErr='';
    try{await doJob(job);}
    catch(e){
      lastErr=e.message||String(e);setState('échec du clip');draw();await fail(job,e);
      if(/limite/i.test(lastErr))pauseUntil=Date.now()+20*60*1000;
      current='';await sleep(3000);
      // évite qu'un état UI cassé contamine le prochain clip
      location.assign('https://grok.com/imagine');
      return;
    }finally{busy=false;}
  }
}
loop();

  }

  const host = location.hostname;
  if (host === 'yakflow.netlify.app') runStudio();
  else if (host === 'chatgpt.com' || host === 'chat.openai.com') runChatGPT();
  else if (host === 'grok.com') runGrok();
})();
