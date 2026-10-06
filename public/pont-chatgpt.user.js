// ==UserScript==
// @name         YakFlow — Pont ChatGPT
// @namespace    https://db-digital.studio/agnes-studio
// @version      2.1.0
// @description  Fabrique dans ChatGPT les images demandées par YakFlow en ligne.
// @author       DB Digital
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* Fonctionnement :
   - YakFlow en ligne met les images à faire dans une file protégée par le code d’accès.
   - Ce script, dans un onglet chatgpt.com, prend la prochaine image, joint les fiches de référence,
     colle le prompt, envoie, attend l'image, la capture et la renvoie à YakFlow.
   - Une nouvelle conversation par épisode (comme la Régie).
   - Le bouton en bas à droite met le pont en pause / le relance. */
(function () {
  'use strict';
  let SERVER = GM_getValue('yakflow_site', ''), LICENSE = GM_getValue('yakflow_code', '');

  /* YAKFLOW_BRIDGE_SETUP_V12 : configuration du pont dans une modale (plus de prompt/alert natifs). Icônes : Font Awesome Free (CC BY 4.0). */
  function yfSetup(site, code, title) {
    const ICONS = {"key": ["0 0 512 512", "M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17l0 80c0 13.3 10.7 24 24 24l80 0c13.3 0 24-10.7 24-24l0-40 40 0c13.3 0 24-10.7 24-24l0-40 40 0c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"], "link": ["0 0 640 512", "M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"], "xmark": ["0 0 384 512", "M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"], "circle-check": ["0 0 512 512", "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"], "triangle-exclamation": ["0 0 512 512", "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480L40 480c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24l0 112c0 13.3 10.7 24 24 24s24-10.7 24-24l0-112c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"], "paw": ["0 0 512 512", "M226.5 92.9c14.3 42.9-.3 86.2-32.6 96.8s-70.1-15.6-84.4-58.5s.3-86.2 32.6-96.8s70.1 15.6 84.4 58.5zM100.4 198.6c18.9 32.4 14.3 70.1-10.2 84.1s-59.7-.9-78.5-33.3S-2.7 179.3 21.8 165.3s59.7 .9 78.5 33.3zM69.2 401.2C121.6 259.9 214.7 224 256 224s134.4 35.9 186.8 177.2c3.6 9.7 5.2 20.1 5.2 30.5l0 1.6c0 25.8-20.9 46.7-46.7 46.7c-11.5 0-22.9-1.4-34-4.2l-88-22c-15.3-3.8-31.3-3.8-46.6 0l-88 22c-11.1 2.8-22.5 4.2-34 4.2C84.9 480 64 459.1 64 433.3l0-1.6c0-10.4 1.6-20.8 5.2-30.5zM421.8 282.7c-24.5-14-29.1-51.7-10.2-84.1s54-47.3 78.5-33.3s29.1 51.7 10.2 84.1s-54 47.3-78.5 33.3zM310.1 189.7c-32.3-10.6-46.9-53.9-32.6-96.8s52.1-69.1 84.4-58.5s46.9 53.9 32.6 96.8s-52.1 69.1-84.4 58.5z"]};
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const ic = (name) => { const [vb, d] = ICONS[name], s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'); s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true'); p.setAttribute('d', d); p.setAttribute('fill', 'currentColor'); s.appendChild(p); return s; };
    const CSS = ':host{all:initial}*{box-sizing:border-box}' +
      '.bd{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:rgba(3,4,6,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:14px/1.5 Inter,-apple-system,system-ui,"Segoe UI",sans-serif;color:#f5f2ec;animation:f .2s}' +
      '.m{width:min(440px,100%);background:#111317;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 24px 64px rgba(0,0,0,.55);overflow:hidden;animation:p .25s cubic-bezier(.2,.8,.2,1)}' +
      '.h{display:flex;gap:14px;align-items:flex-start;padding:20px 22px 14px}.mi{width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#ffd06a,#ffb224 45%,#ff8a00);color:#1d1200}.mi svg{width:18px;height:18px}' +
      'h3{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}.h p{margin:3px 0 0;color:#7a756d;font-size:13px}' +
      '.x{margin-left:auto;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#7a756d;cursor:pointer;display:grid;place-items:center}.x:hover{background:#1d2127;color:#fff}.x svg{width:13px;height:13px}' +
      '.b{padding:6px 22px 18px;display:grid;gap:14px}label{display:grid;gap:6px;font-size:12px;font-weight:600;color:#b3ada3}' +
      '.f{position:relative}.f svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:#58544e}' +
      'input{width:100%;min-height:44px;padding:10px 12px 10px 36px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0c0d10;color:#fff;font:inherit;outline:none}input:focus{border-color:#ffb224;box-shadow:0 0 0 3px rgba(255,178,36,.15)}' +
      'input.code{font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}' +
      '.st{display:none;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:9px;font-size:13px}.st svg{width:14px;height:14px;flex:none;margin-top:2px}.st.err{display:flex;color:#ffb3ad;background:rgba(255,90,78,.1);border:1px solid rgba(255,90,78,.28)}.st.ok{display:flex;color:#9ff0c6;background:rgba(61,214,140,.1);border:1px solid rgba(61,214,140,.25)}.st.wait{display:flex;color:#b3ada3;background:#16191e;border:1px solid rgba(255,255,255,.07)}' +
      '.ft{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid rgba(255,255,255,.07);background:#0c0d10}' +
      'button.btn{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 16px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#16191e;color:#f5f2ec;font:600 13px Inter,-apple-system,system-ui,sans-serif;cursor:pointer}button.btn:hover{background:#1d2127}' +
      'button.pr{background:linear-gradient(135deg,#ffd06a,#ffb224 45%,#ff8a00);color:#1d1200;border-color:transparent;font-weight:700}button.pr:hover{filter:brightness(1.06);background:linear-gradient(135deg,#ffd06a,#ffb224 45%,#ff8a00)}button:disabled{opacity:.5;cursor:wait}' +
      '@keyframes f{from{opacity:0}}@keyframes p{from{opacity:0;transform:translateY(12px) scale(.97)}}';
    return new Promise((resolve) => {
      const host = el('div'); host.id = 'yakflow-setup';
      const root = host.attachShadow({ mode: 'closed' });
      try { const sh = new CSSStyleSheet(); sh.replaceSync(CSS); root.adoptedStyleSheets = [sh]; } catch (_) { root.appendChild(el('style', null, CSS)); }
      const bd = el('div', 'bd'), m = el('div', 'm'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      const h = el('div', 'h'), mi = el('div', 'mi'); mi.appendChild(ic('paw'));
      const ht = el('div'); ht.append(el('h3', null, title || 'Connecter ce pont à YakFlow'), el('p', null, 'À faire une seule fois sur cet ordinateur.'));
      const x = el('button', 'x'); x.type = 'button'; x.setAttribute('aria-label', 'Fermer'); x.appendChild(ic('xmark'));
      h.append(mi, ht, x);
      const b = el('div', 'b');
      const field = (lbl, iconName, val, ph, cls) => { const l = el('label', null, lbl), f = el('div', 'f'), i = el('input', cls); i.value = val || ''; i.placeholder = ph; i.spellcheck = false; i.autocomplete = 'off'; f.append(ic(iconName), i); l.appendChild(f); b.appendChild(l); return i; };
      const iSite = field('Adresse de ton site YakFlow', 'link', site, 'https://yakflow.netlify.app');
      const iCode = field('Ton code d’accès', 'key', code, 'YKF-XXXXX-XXXXX-XXXXX-XXXXX', 'code');
      const st = el('div', 'st'); b.appendChild(st);
      const ft = el('div', 'ft'), cancel = el('button', 'btn', 'Plus tard'), ok = el('button', 'btn pr', 'Connecter le pont');
      cancel.type = ok.type = 'button'; ft.append(cancel, ok);
      m.append(h, b, ft); bd.appendChild(m); root.appendChild(bd);
      (document.body || document.documentElement).appendChild(host);
      const show = (cls, msg, name) => { st.className = 'st ' + cls; st.replaceChildren(); if (name) st.appendChild(ic(name)); st.appendChild(el('span', null, msg)); };
      const close = (v) => { host.remove(); resolve(v); };
      x.onclick = cancel.onclick = () => close(null);
      bd.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(null); if (e.key === 'Enter') ok.click(); });
      ok.onclick = () => {
        let origin = '';
        try { const raw = iSite.value.trim(); origin = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw).origin; } catch (_) {}
        if (!origin || !origin.startsWith('https://')) { show('err', 'Adresse invalide : indique l’adresse https de ton site YakFlow.', 'triangle-exclamation'); iSite.focus(); return; }
        const c = iCode.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (!c) { show('err', 'Indique ton code d’accès YakFlow.', 'triangle-exclamation'); iCode.focus(); return; }
        ok.disabled = true; show('wait', 'Vérification du code…');
        GM_xmlhttpRequest({ method: 'POST', url: origin + '/.netlify/functions/verify-license', data: JSON.stringify({ code: c }), headers: { 'Content-Type': 'application/json' }, responseType: 'json', timeout: 20000,
          onload: (r) => {
            let d = r.response; if (!d || typeof d !== 'object') { try { d = JSON.parse(r.responseText); } catch (_) { d = {}; } }
            if (r.status >= 200 && r.status < 300 && d.valid) { show('ok', 'Code valide. Le pont démarre…', 'circle-check'); setTimeout(() => close({ site: origin, code: c }), 700); }
            else { ok.disabled = false; show('err', d.message || (r.status === 404 ? 'Site YakFlow introuvable à cette adresse.' : 'Code invalide ou abonnement inactif.'), 'triangle-exclamation'); }
          },
          onerror: () => { ok.disabled = false; show('err', 'Impossible de joindre ce site. Vérifie l’adresse.', 'triangle-exclamation'); },
          ontimeout: () => { ok.disabled = false; show('err', 'Le site ne répond pas. Réessaie dans un instant.', 'triangle-exclamation'); } });
      };
      setTimeout(() => (iSite.value ? iCode : iSite).focus(), 50);
    });
  }
  const saveSetup = (v) => { if (!v) return; GM_setValue('yakflow_site', v.site); GM_setValue('yakflow_code', v.code); location.reload(); };
  GM_registerMenuCommand('YakFlow · changer le site ou le code', () => yfSetup(SERVER, LICENSE, 'Modifier la connexion YakFlow').then(saveSetup));
  try { if (SERVER) SERVER = new URL(SERVER).origin; } catch (_) { SERVER = ''; }
  if (!SERVER || !LICENSE || !SERVER.startsWith('https://')) { yfSetup(SERVER, LICENSE).then(saveSetup); return; }
  const VERSION = '2.1.0';
  // Un identifiant par chargement d'onglet : les conversations restent indépendantes.
  const WORKER = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()).toString();
  const withWorker = (path) => path + (path.includes('?') ? '&' : '?') + 'worker=' + encodeURIComponent(WORKER);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dbg = (m, o) => { try { console.log('[Pont]', m, o || ''); } catch (e) { /* rien */ } };
  const K_ON = 'pont_actif', K_PID = 'pont_pid';
  let busy = false, info = 'en attente', lastErr = '';

  /* ---------- liaison avec le serveur du studio ---------- */
  function call(method, path, body) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method, url: SERVER + path, headers: { 'X-Studio': '1', 'Content-Type': 'application/json', 'X-Yakflow-License': LICENSE },
        data: body ? JSON.stringify(body) : undefined, timeout: 120000,
        onload: (r) => { try { r.status < 400 ? res(JSON.parse(r.responseText || '{}')) : rej(new Error('HTTP ' + r.status)); } catch (e) { rej(e); } },
        onerror: () => rej(new Error('serveur du studio injoignable')), ontimeout: () => rej(new Error('délai dépassé')),
      });
    });
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
      (lastErr ? '<div style="color:#ff9188;font-weight:500;margin-top:3px">' + lastErr.replace(/[<>&]/g, '') + '</div>' : '');
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
      say('ajout de ' + files.length + ' fiche(s) : ' + job.nom);
      if (!(await attachAndCheck(files, field))) throw new Error('fiches non jointes (aucune vignette n\'apparaît)');
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

  async function loop() {
    let pauseUntil = 0, genSince = 0, serverReady = false;
    for (;;) {
      await sleep(4000);
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
      if (!job) { say('rien à faire'); continue; }
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
        if (taken && !(late && late.id === job.id)) await call('POST', withWorker('/bridge/result'), { id: job.id, error: e.message }).catch(() => {});
        if (/limite/.test(e.message)) { pauseUntil = Date.now() + 20 * 60000; say('pause 20 min (limite ChatGPT)'); }
      } finally { busy = false; }
    }
  }
  draw();
  setInterval(() => call('POST', withWorker('/bridge/heartbeat?info=' + encodeURIComponent(info))).catch(() => {}), 10000);
  loop();
})();
