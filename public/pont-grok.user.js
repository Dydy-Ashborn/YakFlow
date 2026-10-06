// ==UserScript==
// @name         YakFlow — Pont Grok Imagine
// @namespace    yakflow
// @version      4.1.0
// @description  Pont entre YakFlow en ligne et Grok Imagine, multi-onglets et transfert MP4.
// @match        https://grok.com/imagine*
// @match        https://grok.com/supergrok/imagine*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @connect      grok.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(() => {
'use strict';

let BASE=GM_getValue('yakflow_site',''), LICENSE=GM_getValue('yakflow_code','');

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
const saveSetup=v=>{if(!v)return;GM_setValue('yakflow_site',v.site);GM_setValue('yakflow_code',v.code);location.reload()};
GM_registerMenuCommand('YakFlow · changer le site ou le code',()=>yfSetup(BASE,LICENSE,'Modifier la connexion YakFlow').then(saveSetup));
try{if(BASE)BASE=new URL(BASE).origin}catch(_){BASE=''}
if(!BASE||!LICENSE||!BASE.startsWith('https://')){yfSetup(BASE,LICENSE).then(saveSetup);return}
const K_ON='agnes_grok_on'; // conservé pour compatibilité avec les installations existantes
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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
function api(method,path,data) {
  const url=BASE+'/grok/'+path+(path.includes('?')?'&':'?')+'worker='+encodeURIComponent(worker);
  return gm(method,url,{data:data===undefined?null:JSON.stringify(data),
    headers:{'X-Studio':'1','X-Yakflow-License':LICENSE,...(data===undefined?{}:{'Content-Type':'application/json'})},responseType:'json'});
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
    '<div style="margin-top:6px">'+escapeHtml(state)+'</div>'+
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
  const size=3_000_000,total=Math.ceil(buf.byteLength/size);
  if(total>100)throw new Error('Vidéo Grok trop volumineuse pour le transfert en ligne');
  for(let part=0;part<total;part++){
    const chunk=buf.slice(part*size,Math.min(buf.byteLength,(part+1)*size));
    await gm('POST',BASE+'/grok/result-chunk?id='+encodeURIComponent(job.id)+'&worker='+encodeURIComponent(worker)+'&part='+part+'&total='+total,
      {data:chunk,headers:{'X-Yakflow-License':LICENSE,'Content-Type':'application/octet-stream'},responseType:'json',timeout:180000});
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

async function heartbeat(){
  try{await api('POST','heartbeat?info='+encodeURIComponent(document.title||'Grok Imagine'));}catch(_){}
}
async function loop(){
  draw();
  setInterval(heartbeat,8000);heartbeat();
  for(;;){
    await sleep(1600);
    if(busy||!GM_getValue(K_ON,true)||Date.now()<pauseUntil)continue;
    if(!/\/imagine/.test(location.pathname)){setState('ouvre Grok Imagine');continue;}
    let r;
    try{r=await api('POST','take?info='+encodeURIComponent(document.title||'Grok Imagine'));}
    catch(e){lastErr='YakFlow en ligne non joignable ou code expiré.';setState('pont hors ligne');draw();continue;}
    if(!r?.job){lastErr='';setState('en attente d’un clip');draw();continue;}
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
})();
