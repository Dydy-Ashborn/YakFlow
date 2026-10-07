// ==UserScript==
// @name         YakFlow — Pont Grok Imagine
// @namespace    yakflow
// @version      3.0.0
// @description  Pont YakFlow ↔ Grok Imagine. DOM Grok octobre 2026, multi-onglets, récupération MP4.
// @match        https://grok.com/imagine*
// @match        https://grok.com/supergrok/imagine*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      127.0.0.1
// @connect      localhost
// @connect      grok.com
// @run-at       document-idle
// ==/UserScript==

(() => {
'use strict';

const BASE='http://127.0.0.1:8765';
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
    headers:{'X-Studio':'1',...(data===undefined?{}:{'Content-Type':'application/json'})},responseType:'json'});
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
  return gm('POST',BASE+'/grok/result?id='+encodeURIComponent(job.id)+'&worker='+encodeURIComponent(worker),
    {data:buf,headers:{'X-Studio':'1','Content-Type':'video/mp4'},responseType:'json',timeout:180000});
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
    catch(e){lastErr='YakFlow non joignable. Lance serveur.py.';setState('pont hors ligne');draw();continue;}
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
