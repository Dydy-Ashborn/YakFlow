# -*- coding: utf-8 -*-
import json, os, re, time, threading, urllib.parse, urllib.request, html as htmlmod, math
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

UA=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
DATA_DIR=Path.home()/"Downloads"/"AgnesStudio"/"_radar_tiktok"
DATA_FILE=DATA_DIR/"radar.json"
LOCK=threading.RLock()
SCAN={"running":False,"done":0,"total":0,"message":"prêt","error":""}
MIN_YAK_DISPLAY=50
DEFAULT_QUERIES=[
 "AI story TikTok","AI animation TikTok","AI horror TikTok","AI animal story TikTok",
 "AI short film TikTok","AI generated story TikTok",
 "anthropomorphic animal animation TikTok","AI emotional story TikTok"
]

def default_state():
    return {"version":1,"videos":{},"settings":{"queries":DEFAULT_QUERIES,"region":"FR","max_per_query":6},"updated":0}

def load():
    DATA_DIR.mkdir(parents=True,exist_ok=True)
    with LOCK:
        if not DATA_FILE.exists():
            s=default_state(); save(s); return s
        try: s=json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except: s=default_state()
        s.setdefault("videos",{}); s.setdefault("settings",default_state()["settings"])
        return s

def save(s):
    DATA_DIR.mkdir(parents=True,exist_ok=True); s["updated"]=int(time.time())
    t=DATA_FILE.with_suffix(".tmp"); t.write_text(json.dumps(s,ensure_ascii=False,indent=2),encoding="utf-8"); t.replace(DATA_FILE)

def fetch(url,timeout=18):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"fr-FR,fr;q=0.9,en;q=0.7","Cache-Control":"no-cache"})
    with urllib.request.urlopen(req,timeout=timeout) as r: return r.read(),r.geturl()

def norm(url):
    url=htmlmod.unescape((url or "").strip())
    m=re.search(r'https?://(?:www\.)?tiktok\.com/@[^/?#]+/video/\d+',url)
    if m:return m.group(0)
    m=re.search(r'https?://(?:vm|vt)\.tiktok\.com/[A-Za-z0-9_-]+/?',url)
    return m.group(0) if m else ""

def resolve(url):
    try:
        _,u=fetch(url,12); return norm(u) or url
    except:return url

def vid(url):
    m=re.search(r'/video/(\d+)',url or ""); return m.group(1) if m else re.sub(r'\W+','',url or "")[-28:]

def num(v):
    try:return int(float(str(v).replace(",","")))
    except:return 0

def oembed(url):
    raw,_=fetch("https://www.tiktok.com/oembed?url="+urllib.parse.quote(url,safe=""),15)
    return json.loads(raw.decode("utf-8","replace"))

def find_item(x):
    if isinstance(x,dict):
        st=x.get("stats")
        if isinstance(st,dict) and any(k in st for k in ("playCount","diggCount","commentCount","shareCount")): return x
        for v in x.values():
            r=find_item(v)
            if r:return r
    elif isinstance(x,list):
        for v in x:
            r=find_item(v)
            if r:return r
    return None

def page_item(page):
    for pat in [r'<script[^>]+id=["\']__UNIVERSAL_DATA_FOR_REHYDRATION__["\'][^>]*>(.*?)</script>',
                r'<script[^>]+id=["\']SIGI_STATE["\'][^>]*>(.*?)</script>']:
        m=re.search(pat,page,re.S|re.I)
        if m:
            try:
                r=find_item(json.loads(htmlmod.unescape(m.group(1)).strip()))
                if r:return r
            except:pass
    return None

def stat_rx(page,key):
    for pat in [rf'"{key}"\s*:\s*(\d+)',rf'\\"{key}\\"\s*:\s*(\d+)']:
        m=re.search(pat,page)
        if m:return num(m.group(1))
    return 0

def extract(url):
    url=resolve(url); now=int(time.time())
    v={"id":vid(url),"url":url,"title":"","author":"","author_url":"","thumbnail":"",
       "views":0,"likes":0,"comments":0,"shares":0,"favorites":0,"duration":0,"created":0,
       "first_seen":now,"last_seen":now,"matched_queries":[],"snapshots":[]}
    try:
        oe=oembed(url); v.update(title=oe.get("title") or "",author=oe.get("author_name") or "",
            author_url=oe.get("author_url") or "",thumbnail=oe.get("thumbnail_url") or "")
    except:pass
    try:
        raw,_=fetch(url,18); page=raw.decode("utf-8","replace"); it=page_item(page)
        if it:
            st=it.get("stats") or {}; au=it.get("author") or {}; vi=it.get("video") or {}
            v["views"]=num(st.get("playCount"));v["likes"]=num(st.get("diggCount"))
            v["comments"]=num(st.get("commentCount"));v["shares"]=num(st.get("shareCount"))
            v["favorites"]=num(st.get("collectCount"));v["created"]=num(it.get("createTime"))
            v["title"]=it.get("desc") or v["title"];v["duration"]=num(vi.get("duration"))
            if isinstance(au,dict):v["author"]=au.get("nickname") or au.get("uniqueId") or v["author"]
            if isinstance(vi,dict):v["thumbnail"]=vi.get("cover") or vi.get("dynamicCover") or v["thumbnail"]
        else:
            for a,b in [("views","playCount"),("likes","diggCount"),("comments","commentCount"),("shares","shareCount"),("favorites","collectCount"),("created","createTime")]:
                v[a]=stat_rx(page,b)
    except:pass
    v["stats_available"]=bool(v["views"] or v["likes"] or v["comments"] or v["shares"])
    return v

def ddg(q,maxn):
    try:raw,_=fetch("https://html.duckduckgo.com/html/?q="+urllib.parse.quote(q+" site:tiktok.com/@ inurl:/video/"),20)
    except:return []
    page=raw.decode("utf-8","replace"); out=[]
    for href in re.findall(r'href=["\']([^"\']+)["\']',page,re.I):
        href=htmlmod.unescape(href)
        if "uddg=" in href:
            try:href=urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get("uddg",[href])[0]
            except:pass
        u=norm(urllib.parse.unquote(href))
        if u and u not in out:out.append(u)
        if len(out)>=maxn:break
    return out

def bing(q,maxn):
    try:raw,_=fetch("https://www.bing.com/search?q="+urllib.parse.quote(q+" site:tiktok.com video")+"&count=30",20)
    except:return []
    page=raw.decode("utf-8","replace");out=[]
    for m in re.finditer(r'https?://(?:www\.)?tiktok\.com/@[^"\'&<>\s]+/video/\d+',page,re.I):
        u=norm(htmlmod.unescape(m.group(0)))
        if u and u not in out:out.append(u)
        if len(out)>=maxn:break
    return out

def search(q,maxn):
    out=ddg(q,maxn)
    if len(out)<maxn:
        for u in bing(q,maxn):
            if u not in out:out.append(u)
            if len(out)>=maxn:break
    return out

def cc_tags(period=7,region="FR"):
    url="https://ads.tiktok.com/creative/creativeCenter/trends/hashtag?"+urllib.parse.urlencode(
        {"deviceType":"pc","locale":"fr","period":str(period),"region":region})
    try:raw,_=fetch(url,20)
    except:return []
    page=htmlmod.unescape(raw.decode("utf-8","replace"));out=[]
    for tag in re.findall(r'#[A-Za-zÀ-ÿ0-9_]{2,50}',page):
        # Ignore CSS color tokens accidentally matched as hashtags: #fff, #FE2C55, etc.
        if re.fullmatch(r'#[0-9A-Fa-f]{3,8}',tag):
            continue
        if tag.lower() not in [x.lower() for x in out]:out.append(tag)
        if len(out)>=30:break
    return out

def cat(t):
    s=(t or "").lower()
    groups=[("Horreur",["horror","creepy","scary","killer","ghost","haunted","tueur","peur"]),
            ("Animaux",["animal","dog","cat","wolf","fox","anthropomorphic","chien","chat"]),
            ("Famille",["dad","father","mom","mother","baby","son","family","papa","maman","bébé","fils"]),
            ("Pouvoir",["power","magic","curse","ability","pouvoir","magique"]),
            ("Drame",["sad","emotional","cry","heartbreaking","drama","triste","émouvant"]),
            ("Comédie",["funny","comedy","humor","drôle"])]
    for n,ks in groups:
        if any(k in s for k in ks):return n
    return "Autre"

def metrics(v):
    now=int(time.time()); base=v.get("created") or v.get("first_seen") or now
    age=max((now-base)/3600,.35); views=num(v.get("views"));likes=num(v.get("likes"));com=num(v.get("comments"));shr=num(v.get("shares"))
    vel=views/age if views else 0; recent=acc=0; sn=v.get("snapshots") or []
    if len(sn)>=2:
        a,b=sn[-2],sn[-1];dt=max((b["t"]-a["t"])/3600,.01);recent=max(0,(b["views"]-a["views"])/dt)
        if len(sn)>=3:
            z=sn[-3];dt0=max((a["t"]-z["t"])/3600,.01);prev=max(0,(a["views"]-z["views"])/dt0);acc=recent-prev
    eng=((likes+2*com+3*shr)/views*100) if views else 0; sr=(shr/views*100) if views else 0
    text=(" ".join(v.get("matched_queries") or [])+" "+(v.get("title") or "")).lower()
    rel=min(1,sum(k in text for k in ["ai","animation","animated","generated","anthropomorphic","sora","veo","kling"])/3)
    use=recent or vel

    # Yak Potential = intérêt créatif / compatibilité avec la niche.
    yak=min(45,math.log10(max(use,1))*11)+min(25,eng*2.2)+min(12,sr*12)+rel*12+(6 if age<=24 else 3 if age<=168 else 0)
    yak=round(min(100,yak),1)

    # Score Reprise = "laquelle reprendre aujourd'hui ?"
    # Contrairement au Yak Potential, il exige une preuve de traction réelle.
    speed_score=min(100,max(0,(math.log10(max(use,1))-1.5)/3*100))
    views_score=min(100,max(0,(math.log10(max(views,1))-3)/3*100))
    engagement_score=min(100,max(0,eng/12*100))
    share_score=min(100,max(0,sr/.8*100))
    freshness_score=100 if age<=24 else 80 if age<=72 else 60 if age<=168 else 30

    base_reprise=(speed_score*.35 + views_score*.25 + engagement_score*.15 +
                  share_score*.10 + yak*.10 + freshness_score*.05)

    # "preuve" monte progressivement de 1k à 100k vues.
    proof=min(1,max(0,(math.log10(max(views,1))-3)/2))
    reprise=round(min(100,base_reprise*(.78+.22*proof)),1)

    if views<1500:
        confidence="trop tôt"
    elif views<10000:
        confidence="prometteur"
    elif views<50000:
        confidence="solide"
    else:
        confidence="confirmé"

    if reprise>=60 and views>=10000:
        reprise_label="🥇 REPRENDRE"
    elif reprise>=45:
        reprise_label="🔥 À SURVEILLER"
    else:
        reprise_label="❌ PASSER"

    if views<10000 and reprise>=45:
        reprise_reason=f"Très prometteur, mais seulement {views:,} vues pour l'instant".replace(",", " ")
    elif reprise>=60:
        reprise_reason=f"Traction confirmée : {views:,} vues et {round(use):,} vues/h".replace(",", " ")
    elif use>=3000:
        reprise_reason=f"Bonne vitesse ({round(use):,} vues/h), mais preuve encore moyenne".replace(",", " ")
    else:
        reprise_reason="Pas assez de traction confirmée pour en faire la reprise prioritaire"

    return {
        "age_hours":round(age,1),"velocity":round(vel),"recent_velocity":round(recent),"acceleration":round(acc),
        "engagement":round(eng,2),"share_rate":round(sr,3),"yak_potential":yak,"category":cat(v.get("title")),
        "reprise_score":reprise,"reprise_label":reprise_label,"reprise_reason":reprise_reason,
        "reprise_confidence":confidence
    }

def merge(s,f,q=None):
    old=s["videos"].get(f["id"],{});now=int(time.time())
    f["first_seen"]=old.get("first_seen") or f.get("first_seen") or now;f["last_seen"]=now
    f["matched_queries"]=list(dict.fromkeys((old.get("matched_queries") or [])+([q] if q else [])))
    sn=old.get("snapshots") or []
    if f.get("stats_available"):
        cur={"t":now,"views":f["views"],"likes":f["likes"],"comments":f["comments"],"shares":f["shares"]}
        if sn and now-sn[-1]["t"]<60:sn[-1]=cur
        else:sn.append(cur)
    f["snapshots"]=sn[-120:]
    for k in ["title","author","author_url","thumbnail","views","likes","comments","shares","favorites","created","duration"]:
        if not f.get(k) and old.get(k):f[k]=old[k]
    s["videos"][f["id"]]=f

def scan_worker():
    SCAN.update(running=True,done=0,total=0,message="Recherche…",error="")
    try:
        s=load();settings=s["settings"];jobs=[];seen=set()
        for q in settings.get("queries") or DEFAULT_QUERIES:
            SCAN["message"]="Recherche "+q
            for u in search(q,int(settings.get("max_per_query") or 6)):
                k=vid(u)
                if k not in seen:jobs.append((q,u));seen.add(k)
        SCAN["total"]=len(jobs);SCAN["message"]=f"{len(jobs)} vidéo(s) trouvée(s)"
        with ThreadPoolExecutor(max_workers=5) as ex:
            fs={ex.submit(extract,u):(q,u) for q,u in jobs}
            for f in as_completed(fs):
                q,_=fs[f]
                try:
                    fresh=f.result()
                    with LOCK:
                        s=load();merge(s,fresh,q);save(s)
                except:pass
                SCAN["done"]+=1;SCAN["message"]=f"Analyse {SCAN['done']}/{SCAN['total']}"
        s=load();reg=settings.get("region","FR")
        s["creative_center"]={"updated":int(time.time()),"hashtags_7d":cc_tags(7,reg),"hashtags_30d":cc_tags(30,reg)};save(s)
        SCAN["message"]="Terminé"
    except Exception as e:SCAN["error"]=str(e);SCAN["message"]="Erreur"
    finally:SCAN["running"]=False

def launch_scan():
    if SCAN["running"]:return False
    threading.Thread(target=scan_worker,daemon=True).start();return True

def refresh_worker():
    s=load();urls=[x.get("url") for x in s["videos"].values() if x.get("url")]
    with ThreadPoolExecutor(max_workers=5) as ex:
        fs=[ex.submit(extract,u) for u in urls[:150]]
        for f in as_completed(fs):
            try:
                fresh=f.result()
                with LOCK:s=load();merge(s,fresh);save(s)
            except:pass

def send(h,code,obj):
    data=json.dumps(obj,ensure_ascii=False).encode();h.send_response(code);h.send_header("Content-Type","application/json; charset=utf-8")
    h.send_header("Content-Length",str(len(data)));h.send_header("Cache-Control","no-store");h.end_headers();h.wfile.write(data)

def body(h):
    try:return json.loads(h.rfile.read(min(int(h.headers.get("Content-Length","0") or 0),1048576)).decode())
    except:return {}

def listed(w,sort):
    lim={"24h":24,"7d":168,"30d":720,"all":10**9}.get(w,24);now=int(time.time());out=[]
    for v in load()["videos"].values():
        base=v.get("created") or v.get("first_seen") or now
        if (now-base)/3600<=lim:
            x=dict(v);x["metrics"]=metrics(v)
            # UI volontairement concentrée sur les candidats Yak Films intéressants.
            if x["metrics"]["yak_potential"]>=MIN_YAK_DISPLAY:
                out.append(x)
    key={
        "reprise":lambda x:x["metrics"]["reprise_score"],
        "views":lambda x:x.get("views",0),
        "velocity":lambda x:x["metrics"]["recent_velocity"] or x["metrics"]["velocity"],
        "shares":lambda x:x["metrics"]["share_rate"],
        "yak":lambda x:x["metrics"]["yak_potential"]
    }.get(sort,lambda x:x["metrics"]["reprise_score"])
    return sorted(out,key=key,reverse=True)

def handle_get(h):
    u=urllib.parse.urlparse(h.path);q=urllib.parse.parse_qs(u.query)
    if u.path=="/radar/api/state":
        s=load();return send(h,200,{"ok":True,"settings":s["settings"],"creative_center":s.get("creative_center",{}),"count":len(s["videos"])})
    if u.path=="/radar/api/status":return send(h,200,SCAN)
    if u.path=="/radar/api/list":return send(h,200,{"ok":True,"videos":listed(q.get("window",["24h"])[0],q.get("sort",["yak"])[0])})
    return send(h,404,{"detail":"route inconnue"})

def handle_post(h):
    if h.headers.get("X-Studio")!="1":return send(h,403,{"detail":"X-Studio requis"})
    u=urllib.parse.urlparse(h.path);d=body(h)
    if u.path=="/radar/api/scan":return send(h,200,{"ok":True,"started":launch_scan()})
    if u.path=="/radar/api/refresh":threading.Thread(target=refresh_worker,daemon=True).start();return send(h,200,{"ok":True})
    if u.path=="/radar/api/add":
        url=norm(d.get("url",""))
        if not url:return send(h,400,{"detail":"URL TikTok invalide"})
        fresh=extract(url);s=load();merge(s,fresh,"Ajout manuel");save(s);return send(h,200,{"ok":True})
    if u.path=="/radar/api/remove":
        s=load();s["videos"].pop(str(d.get("id","")),None);save(s);return send(h,200,{"ok":True})
    if u.path=="/radar/api/settings":
        s=load();st=s["settings"]
        if isinstance(d.get("queries"),list):st["queries"]=[str(x).strip() for x in d["queries"] if str(x).strip()][:30]
        st["max_per_query"]=max(1,min(15,int(d.get("max_per_query",st.get("max_per_query",6)))))
        if d.get("region"):st["region"]=re.sub(r'[^A-Z]','',str(d["region"]).upper())[:3] or "FR"
        save(s);return send(h,200,{"ok":True,"settings":st})
    return send(h,404,{"detail":"route inconnue"})
