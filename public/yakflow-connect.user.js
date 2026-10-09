// ==UserScript==
// @name         YakFlow Connect
// @namespace    https://yakflow.netlify.app/
// @version      3.0.5
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
  const CONNECT_VERSION = '3.0.5';
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
  const ck = (id, n) => 'grok:chunk:' + fnv(String(id)) + ':' + n;
  const qk = (kind) => kind + ':queue';
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  function beat(kind, worker, info) {
    if (!worker) return;
    set(kind + ':w:' + fnv(worker), { seenAt: now(), info: String(info || '').slice(0, 200) });
  }
  function alive(kind) {
    const out = [];
    for (const k of keys(kind + ':w:')) { const w = get(k); if (!w || now() - w.seenAt > 10 * 60000) { del(k); continue; } if (now() - w.seenAt < ALIVE_MS) out.push(w); }
    return out;
  }
  function job(kind, id) {
    const j = get(jk(kind, id));
    if (j && j.st === 'en cours' && now() - (j.claimedAt || 0) > 30 * 60000) {
      Object.assign(j, { st: kind === 'grok' ? 'echec' : 'incertain', error: 'L’onglet ' + (kind === 'grok' ? 'Grok' : 'ChatGPT') + ' ne répond plus depuis 30 minutes. Vérifie-le avant de relancer.', finishedAt: now() });
      set(jk(kind, id), j);
    }
    return j;
  }
  const saveJob = (kind, id, patch) => { const j = { ...(get(jk(kind, id)) || {}), ...patch }; set(jk(kind, id), j); return j; };
  const queue = (kind) => get(qk(kind), []);
  function waiting(kind) { return queue(kind).filter((id) => (job(kind, id) || {}).st === 'attente'); }
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
      for (const k of keys(kind + ':job:')) { const j = get(k); if (!j || now() - (j.createdAt || 0) > 24 * 3600 * 1000) { if (j) { del(pk(kind, j.id)); del(rk(kind, j.id)); if (kind === 'grok') dropChunks(j.id, j.chunks); del(kind + ':claim:' + fnv(String(j.id))); } del(k); } }
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
      if (kind === 'grok') return ok({ alive: live.length > 0, workers: live.length, pending: waiting(kind).length, running: 0 });
      const out = { protocol: 2, alive: live.length > 0, workers: live.length, info: live[0] ? live[0].info : '' };
      const pz = get('bridge:pause'); if (pz && now() < pz.until) Object.assign(out, { pauseUntil: pz.until, pauseWhy: pz.why || '', info: 'En pause jusqu’à ' + new Date(pz.until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' : ' + (pz.why || 'limite ChatGPT') });
      if (id) { const j = job(kind, id); if (j) Object.assign(out, { st: j.st, error: j.error || '', pos: 0, data: j.st === 'fini' ? get(rk(kind, id)) : null }); }
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
      if (same && same.fingerprint === fp && ['attente', 'en cours', 'fini'].includes(same.st)) return ok({ ok: true, deja: true, st: same.st });
      set(pk(kind, jid), d);
      set(jk(kind, jid), { id: jid, st: 'attente', fingerprint: fp, createdAt: now(), worker: '', error: '' });
      del(kind + ':claim:' + fnv(jid));
      set(qk(kind), queue(kind).filter((x) => x !== jid).concat(jid));
      return ok({ ok: true, pos: waiting(kind).length });
    }
    if (action === 'forget' && method === 'POST') {
      const j = job(kind, id);
      if (j) {
        saveJob(kind, id, { st: 'oublie', forgottenAt: now() });
        set(qk(kind), queue(kind).filter((x) => x !== id));
        if (['fini', 'echec', 'attente'].includes(j.st)) { del(pk(kind, id)); del(rk(kind, id)); if (kind === 'grok') dropChunks(id, j.chunks); }
      }
      return ok({ ok: true });
    }
    if (['hello', 'heartbeat'].includes(action) && method === 'POST') { beat(kind, worker, info); return ok({ ok: true }); }
    if (action === 'peek' && kind === 'bridge' && method === 'GET') {
      beat(kind, worker, info);
      const jid = waiting(kind)[0];
      return ok({ job: jid ? get(pk(kind, jid)) : null });
    }
    if (action === 'take' && method === 'POST') {
      if (!worker) return err(400, 'Onglet inconnu.');
      beat(kind, worker, info);
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
      if (j.st === 'oublie') return ok({ ok: true, ignore: true });
      if (d.data) { set(rk(kind, d.id), String(d.data)); saveJob(kind, d.id, { st: 'fini', finishedAt: now(), error: '' }); }
      else saveJob(kind, d.id, { st: 'echec', finishedAt: now(), error: String(d.error || 'Erreur ChatGPT').slice(0, 500) });
      return ok({ ok: true });
    }
    // YAKFLOW_RELEASE_V1 : l'onglet rend le travail à la file (limite passagère), sans le compter comme un échec
    if (action === 'release' && method === 'POST') {
      const d = body || {}; const j = job(kind, d.id);
      if (!j) return err(404, 'Travail inconnu.');
      if (j.worker && j.worker !== worker) return err(409, 'Autre onglet propriétaire.');
      if (j.st === 'en cours') { saveJob(kind, d.id, { st: 'attente', worker: '', claimedAt: 0 }); del(kind + ':claim:' + fnv(String(d.id))); }
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
  const VERSION = '2.1.1';
  // Un identifiant par chargement d'onglet : les conversations restent indépendantes.
  // YAKFLOW_CONNECT_303 : identifiant stable par onglet (survit au rechargement entre deux images) : un onglet = un worker
  const WORKER = sessionStorage.getItem('yakflowChatWorker') || ('chat-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()));
  sessionStorage.setItem('yakflowChatWorker', WORKER);
  const withWorker = (path) => path + (path.includes('?') ? '&' : '?') + 'worker=' + encodeURIComponent(WORKER);
  keepAwake();
  const dbg = (m, o) => { try { console.log('[Pont]', m, o || ''); } catch (e) { /* rien */ } };
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
    return c.toDataURL('image/jpeg', 0.86);
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
    const root = document.querySelector('main') || document.body;
    const snip = norm(sentPrompt).slice(0, 50); if (!snip) return null;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n, hit = null;
    while ((n = w.nextNode())) { if (n.parentElement && !n.parentElement.closest('form') && norm(n.nodeValue).includes(snip.slice(0, 30))) { hit = n.parentElement; break; } }
    if (!hit) return null;
    return hit.closest(ITEM_SEL) || hit.parentElement;
  }
  function findGeneratedImage() {
    const all = generatedImages();
    const gal = all.filter((img) => img.closest('[data-testid="generated-image-gallery"], [data-testid="generated-image-preview"]') || /image g[ée]n[ée]r[ée]e|generated image/i.test(img.alt || ''));
    const i = gal.length ? gal : all;   // la vraie image générée a le texte alternatif « Image générée N »
    // on ne prend que ce qui est APRÈS le dernier message envoyé (les fiches jointes sont dans ce message)
    const users = document.querySelectorAll('[data-message-author-role="user"], [data-turn="user"]');
    const lastUser = userItem() || (users.length ? users[users.length - 1] : null);
    let after = lastUser ? i.filter((img) => !lastUser.contains(img) && (lastUser.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING)) : i;
    // repli : la conversation est neuve à chaque image, donc toute image hors du message envoyé est la bonne
    if (!after.length && lastUser) after = i.filter((img) => !lastUser.contains(img));
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
    const el = [...document.querySelectorAll('body *')].find((e) => e.children.length < 6 && isVisible(e) && re.test(e.textContent || '') && (e.textContent || '').length < 400);
    if (!el) return 0;
    const box = (el.closest('div') && el.closest('div').parentElement) || el;
    const txt = box.textContent || el.textContent || '';
    const m = txt.match(/(\d{1,2})\s*[:h]\s*(\d{2})\s*(AM|PM)?/i);
    if (!m) return Date.now() + 60 * 60000;
    let h = +m[1]; const mi = +m[2]; if (m[3]) { if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; }
    const d = new Date(); d.setHours(h, mi, 0, 0); if (d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1);
    return d.getTime() + 60000;
  }
  function attachError() { const until = attachLimit() || Date.now() + 60 * 60000; const e = new Error('limite de pièces jointes ChatGPT, pause jusqu’à ' + new Date(until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })); e.attachUntil = until; return e; }
  const limitReached = () => /(limit|limite|quota|try again later|réessa)/i.test(lastAssistantText());
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
  const newImage = (before) => { const img = findGeneratedImage(); return img && !before.has(imgSrc(img)) ? img : null; };
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
      catch (e) { if (/HTTP 404/.test(e.message)) return null; await sleep(5000); }
    }
    throw new Error('le studio ne répond pas pour recevoir l\'image');
  }
  // image arrivée en retard (après l'abandon) : on la rend quand même au studio
  let late = null;

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
    badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffb224;margin-right:6px;vertical-align:1px"></span>Pont YakFlow · ' + (on ? '' : '<b>en pause</b> · ') + info.replace(/[<>&]/g, '') +
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
    return JSON.stringify({ version: VERSION, url: location.pathname, info, lastErr, busy, late: late ? late.nom : null,
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
    const files = (job.refs || []).map((r) => dataUrlToFile(r.data, r.name));
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
    if (!(await setPrompt(job.prompt))) throw new Error('impossible d\'écrire le prompt dans ChatGPT');
    if (files.length && attachedCount() < files.length) throw new Error('les fiches ont disparu après le prompt');
    const send = await waitFor(() => { const b = findSendButton(); return b && !b.disabled ? b : null; }, 120000, 1000);
    if (!send) throw new Error('bouton Envoyer introuvable (fiches pas encore chargées ?)');
    send.click();
    const img = await waitNewImage(before, 15 * 60000, 'ChatGPT dessine : ' + job.nom, validate);
    if (!img) {
      if (limitReached()) throw new Error('limite ChatGPT atteinte');
      late = { id: job.id, nom: job.nom, before, t: Date.now(), validate };
      throw new Error('aucune image reçue (je la récupère si elle arrive en retard)');
    }
    say('envoi au studio : ' + job.nom);
    const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img)));
    await postResult({ id: job.id, data });
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
      if (busy || !GM_getValue(K_ON, true) || Date.now() < pauseUntil) continue;
      { const pz = get('bridge:pause'); if (pz && Date.now() < pz.until) { say('pause jusqu’à ' + new Date(pz.until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' (' + (pz.why || 'limite ChatGPT') + ')'); continue; } }
      if (late) {
        let img = !generating() && newImage(late.before);
        if (img && late.validate) { const why = await late.validate(img).catch(() => ''); if (why) { late.before.add(imgSrc(img)); img = null; } }
        if (img) {
          busy = true;
          try { const data = await blobToJpegDataUrl(await fetchBlob(imgSrc(img))); await postResult({ id: late.id, data }); say('image en retard rendue : ' + late.nom); lastErr = ''; }
          catch (e) { lastErr = late.nom + ' : ' + e.message; }
          finally { late = null; busy = false; }
          continue;
        }
        if (Date.now() - late.t > 10 * 60000) {   // toujours rien : on le dit au studio, qui relancera l'image
          await call('POST', withWorker('/bridge/result'), { id: late.id, error: 'aucune image reçue de ChatGPT' }).catch(() => {});
          try { failDiag = { t: Date.now(), txt: diagnostic() }; } catch (x) { /* tant pis */ }
          lastErr = late.nom + ' : aucune image reçue'; late = null;
        } else { say('j\'attends encore l\'image de ' + late.nom); continue; }   // jamais deux images à la fois
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
      // une conversation neuve pour CHAQUE image : aucune autre image ne peut être prise pour le résultat
      if (hasConversation()) {
        say('nouvelle conversation pour ' + job.nom);
        await sleep(800);
        location.assign('https://chatgpt.com/');
        return;
      }
      busy = true;
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
        if (e.attachUntil) {
          set('bridge:pause', { until: e.attachUntil, why: 'limite de pièces jointes ChatGPT' });
          if (taken) await call('POST', withWorker('/bridge/release'), { id: job.id }).catch(() => {});
          say(e.message); lastErr = '';
        } else if (taken && !(late && late.id === job.id)) await call('POST', withWorker('/bridge/result'), { id: job.id, error: e.message }).catch(() => {});
        if (/limite/.test(e.message)) { pauseUntil = Date.now() + 20 * 60000; say('pause 20 min (limite ChatGPT)'); }
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
  box.innerHTML='<div style="display:flex;align-items:center;gap:8px"><b style="color:#ffb224">Pont Grok</b><span style="opacity:.55">'+worker.slice(-8)+'</span><button id="agnes-grok-toggle" style="margin-left:auto;border:0;border-radius:7px;padding:4px 7px;background:'+(on?'#2f8f63':'#555')+';color:white">'+(on?'ON':'OFF')+'</button></div>'+
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
