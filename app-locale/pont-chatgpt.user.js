// ==UserScript==
// @name         Agnes Studio - Pont ChatGPT
// @namespace    https://db-digital.studio/agnes-studio
// @version      1.11.1
// @description  Fabrique dans ChatGPT les images demandées par Agnes Studio (serveur local 127.0.0.1:8765) et les lui renvoie.
// @author       DB Digital
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      127.0.0.1
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* Fonctionnement :
   - Agnes Studio (http://127.0.0.1:8765) met les images à faire dans une file sur son serveur local.
   - Ce script, dans un onglet chatgpt.com, prend la prochaine image, joint les fiches de référence,
     colle le prompt, envoie, attend l'image, la capture et la renvoie au studio.
   - Une nouvelle conversation par épisode (comme la Régie).
   - Le bouton en bas à droite met le pont en pause / le relance. */
(function () {
  'use strict';
  const SERVER = 'http://127.0.0.1:8765';
  const VERSION = '1.11.1';
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
        method, url: SERVER + path, headers: { 'X-Studio': '1', 'Content-Type': 'application/json' },
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
    c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
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
    badge.innerHTML = '<span style="color:#ffb224">●</span> Pont Agnes Studio · ' + (on ? '' : '<b>en pause</b> · ') + info.replace(/[<>&]/g, '') +
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
