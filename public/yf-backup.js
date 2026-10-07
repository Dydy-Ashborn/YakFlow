/* YakFlow · sauvegarde complète des projets (projets, images, clips, montages, réglages)
   Exporter : un fichier .yakflow téléchargé. Importer : ajoute les projets du fichier à ceux déjà présents.
   Utilisé pour passer de la version ordinateur (127.0.0.1:8765) à la version en ligne, ou d'un navigateur à un autre. */
(function () {
  'use strict';
  const DB = 'agnes_pipeline', MAGIC = 'YAKFLOW-SAVE-1\n';
  const LS_KEYS = ['as_settings', 'as_stats'];
  const enc = new TextEncoder(), dec = new TextDecoder();

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('media'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  const keysOf = (db, name) => new Promise((res, rej) => { const q = db.transaction(name, 'readonly').objectStore(name).getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const getOne = (db, name, k) => new Promise((res, rej) => { const q = db.transaction(name, 'readonly').objectStore(name).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const putOne = (db, name, k, v) => new Promise((res, rej) => { const tx = db.transaction(name, 'readwrite'); tx.objectStore(name).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };

  async function encode(v) {
    if (v instanceof ArrayBuffer) return { t: 'buf', data: new Uint8Array(v) };
    if (ArrayBuffer.isView(v)) return { t: 'buf', data: new Uint8Array(v.buffer, v.byteOffset, v.byteLength) };
    if (v instanceof Blob) return { t: 'blob', mime: v.type, data: v };
    if (typeof v === 'string') return { t: 'str', data: enc.encode(v) };
    return { t: 'json', data: enc.encode(JSON.stringify(v)) };
  }

  async function exportAll(progress) {
    const db = await open(), parts = [enc.encode(MAGIC)];
    let n = 0, bytes = 0;
    const add = async (store, k, v) => {
      const e = await encode(v);
      const size = e.data instanceof Blob ? e.data.size : e.data.byteLength;
      const head = enc.encode(JSON.stringify({ s: store, k, t: e.t, mime: e.mime || '' }));
      parts.push(u32(head.byteLength), head, u32(size), e.data);
      n++; bytes += size; if (progress) progress(n, bytes);
    };
    for (const store of ['kv', 'media']) for (const k of await keysOf(db, store)) await add(store, k, await getOne(db, store, k));
    for (const k of LS_KEYS) { try { const v = localStorage.getItem(k); if (v != null) await add('ls', k, v); } catch (_) {} }
    const blob = new Blob(parts, { type: 'application/octet-stream' });
    const a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = 'YakFlow-sauvegarde-' + d.toISOString().slice(0, 10) + '.yakflow';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return { n, bytes };
  }

  async function importFile(file, progress) {
    const head = dec.decode(await file.slice(0, MAGIC.length).arrayBuffer());
    if (head !== MAGIC) throw new Error('Ce fichier n’est pas une sauvegarde YakFlow.');
    const db = await open();
    let pos = MAGIC.length, n = 0, merged = 0;
    const readU32 = async () => { const b = await file.slice(pos, pos + 4).arrayBuffer(); pos += 4; return new DataView(b).getUint32(0); };
    while (pos < file.size) {
      const hl = await readU32(); const meta = JSON.parse(dec.decode(await file.slice(pos, pos + hl).arrayBuffer())); pos += hl;
      const dl = await readU32(); const slice = file.slice(pos, pos + dl); pos += dl;
      let v;
      if (meta.t === 'buf') v = await slice.arrayBuffer();
      else if (meta.t === 'blob') v = new Blob([await slice.arrayBuffer()], { type: meta.mime || '' });
      else if (meta.t === 'str') v = dec.decode(await slice.arrayBuffer());
      else v = JSON.parse(dec.decode(await slice.arrayBuffer()));
      if (meta.s === 'ls') {
        if (meta.k === 'as_settings') {
          // garde les réglages déjà présents, ajoute les clés Agnes et réglages de la sauvegarde
          let cur = {}; try { cur = JSON.parse(localStorage.getItem('as_settings') || '{}'); } catch (_) {}
          let inc = {}; try { inc = JSON.parse(v); } catch (_) {}
          const keys = [...new Set(String(cur.key || '').split(',').concat(String(inc.key || '').split(',')).map((x) => x.trim()).filter(Boolean))].join(',');
          localStorage.setItem('as_settings', JSON.stringify({ ...inc, ...cur, key: keys || cur.key || inc.key || '' }));
        } else if (localStorage.getItem(meta.k) == null) localStorage.setItem(meta.k, v);
      } else if (meta.s === 'kv' && meta.k === 'projects' && Array.isArray(v)) {
        const cur = (await getOne(db, 'kv', 'projects')) || [];
        const ids = new Set(cur.map((p) => p.id));
        const add = v.filter((p) => !ids.has(p.id)); merged = add.length;
        await putOne(db, 'kv', 'projects', cur.concat(add));
      } else if (meta.s === 'kv' || meta.s === 'media') {
        if (meta.s === 'media' && (await getOne(db, 'media', meta.k)) != null) { n++; continue; }
        await putOne(db, meta.s, meta.k, v);
      }
      n++; if (progress) progress(n, pos, file.size);
    }
    return { n, projects: merged };
  }

  const fmt = (b) => b > 1e9 ? (b / 1e9).toFixed(1) + ' Go' : b > 1e6 ? Math.round(b / 1e6) + ' Mo' : Math.round(b / 1e3) + ' Ko';
  function say(msg, type) { if (typeof window.toast === 'function') window.toast(msg, type || 'ok'); }

  window.yfBackup = { exportAll, importFile };
  document.addEventListener('click', async (e) => {
    const exp = e.target.closest('[data-yf-backup="export"]'), imp = e.target.closest('[data-yf-backup="import"]');
    if (exp) {
      exp.disabled = true; const old = exp.innerHTML; exp.textContent = 'Préparation…';
      try { const r = await exportAll((n, b) => { exp.textContent = 'Préparation… ' + fmt(b); }); say('Sauvegarde téléchargée : ' + r.n + ' éléments, ' + fmt(r.bytes) + '.'); }
      catch (err) { say('Sauvegarde impossible : ' + err.message, 'err'); }
      finally { exp.disabled = false; exp.innerHTML = old; }
    }
    if (imp) {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.yakflow';
      input.onchange = async () => {
        const f = input.files && input.files[0]; if (!f) return;
        imp.disabled = true; const old = imp.innerHTML;
        try {
          const r = await importFile(f, (n, pos, size) => { imp.textContent = 'Import… ' + Math.round(pos / size * 100) + ' %'; });
          say(r.projects + ' projet(s) récupéré(s). Rechargement…');
          setTimeout(() => location.reload(), 1200);
        } catch (err) { say('Import impossible : ' + err.message, 'err'); imp.disabled = false; imp.innerHTML = old; }
      };
      input.click();
    }
  });
})();
