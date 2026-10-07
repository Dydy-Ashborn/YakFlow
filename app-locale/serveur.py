"""YakFlow — serveur local (aucune installation nécessaire, Python 3 suffit).

Lance :  caffeinate -i python3 ~/Downloads/agnes-studio/serveur.py
Puis le navigateur s'ouvre sur http://127.0.0.1:8765

- sert le studio (index.html, montage.js, clip.html) ;
- relaie les appels vers l'API Agnes (le navigateur seul est bloqué par CORS) ;
- télécharge les images et vidéos produites par Agnes ;
- sert de pont avec ChatGPT : le script « Pont ChatGPT » (Tampermonkey, onglet chatgpt.com) prend les images à faire ici et rend le résultat ;
- range tout sur le disque dans ~/Downloads/AgnesStudio/<projet>/ (images, clips, vidéo montée, infos de publication).

Il n'écoute que sur ton ordinateur (127.0.0.1). Les appels sensibles exigent l'en-tête X-Studio,
qu'un autre site ouvert dans ton navigateur ne peut pas envoyer : il ne peut donc ni utiliser ta clé ni écrire sur ton disque.
"""
import http.server, json, os, re, time, socketserver, sys, threading, urllib.error, urllib.parse, urllib.request, webbrowser, tempfile, uuid, shutil
import agnes_radar  # AGNES_RADAR_TIKTOK_V1
import licence  # YAKFLOW_LICENCE_LOCALE_V1

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
API = "https://apihub.agnes-ai.com"
API_ALT = "https://apihub.agnes-ai.cn"
AGNES_HOSTS = (".agnes-ai.com", ".agnes-ai.cn")


# ---------- pont ChatGPT : file d'images à faire, en mémoire ----------
BRIDGE = {"jobs": {}, "order": [], "seen": 0, "lock": threading.Lock(), "info": "", "ghost": {}, "orphan": {}, "workers": {}}
GHOST_TTL = 20 * 60   # un travail oublié par le studio mais encore en cours dans ChatGPT : on attend son image au lieu de le redemander
ORPHAN_TTL = 30 * 60  # une image arrivée alors que plus personne ne l'attendait : gardée pour le prochain travail identique

# AGNES_GROK_BRIDGE_V1
GROK={"jobs":{},"order":[],"workers":{},"lock":threading.Lock()}
GROK_TTL=45*60
GROK_DIR=tempfile.mkdtemp(prefix="agnes-studio-grok-")
def grok_cleanup():
    t=time.time()
    with GROK["lock"]:
        for w in [w for w,x in GROK["workers"].items() if t-x.get("t",0)>25]:
            GROK["workers"].pop(w,None)
        for j in GROK["jobs"].values():
            if j.get("st")=="en cours" and t-j.get("claimed",t)>120 and j.get("worker") not in GROK["workers"]:
                j["st"],j["worker"]="attente",""
                if j["id"] not in GROK["order"]: GROK["order"].append(j["id"])
        for jid in [jid for jid,j in GROK["jobs"].items() if j.get("done") and t-j["done"]>GROK_TTL]:
            j=GROK["jobs"].pop(jid,None)
            if jid in GROK["order"]: GROK["order"].remove(jid)
            if j and j.get("file"):
                try: os.remove(j["file"])
                except OSError: pass


def phash(d):
    """Empreinte d'un travail : même prompt + mêmes fiches jointes = même image (ex. un décor partagé entre deux épisodes)."""
    import hashlib
    refs = ",".join(sorted(r.get("name", "") for r in (d.get("refs") or [])))
    return hashlib.sha1((d.get("prompt", "") + "|" + refs).encode("utf-8")).hexdigest()[:12]


def blog(msg):
    sys.stderr.write("  pont : " + msg + "\n")


def bridge_next():
    """Premier travail libre. Un travail déjà envoyé ne doit jamais être dupliqué."""
    for jid in BRIDGE["order"]:
        j = BRIDGE["jobs"].get(jid)
        if not j:
            continue
        if j["st"] == "attente":
            return j
    return None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """urllib transforme un POST redirigé en GET sans corps (d'où des 405) : on gère les redirections nous-mêmes."""
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def forward(method, url, body, headers, hops=0):
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with OPENER.open(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location") if e.headers else None
        if e.code in (301, 302, 303, 307, 308) and loc and hops < 4:
            nxt = urllib.parse.urljoin(url, loc)
            host = urllib.parse.urlparse(nxt).hostname or ""
            if nxt.startswith("https://") and host.endswith(AGNES_HOSTS):
                sys.stderr.write("  redirection %s -> %s (je garde le %s)\n" % (e.code, nxt, method))
                return forward(method, nxt, body, headers, hops + 1)
        return e.code, e.read()
    except Exception as e:
        return 599, ('{"detail":"reseau: %s"}' % str(e).replace('"', "'")).encode()
ALLOWED_DL = (".agnes-ai.cn", ".agnes-ai.com", ".myqcloud.com")
OUT = os.path.join(os.path.expanduser("~"), "Downloads", "AgnesStudio")
MAX_SAVE = 400 * 1024 * 1024
PUBLISH = {"jobs": {}, "lock": threading.Lock()}
PUBLISH_DIR = tempfile.mkdtemp(prefix="agnes-studio-tiktok-")
PUBLISH_TTL = 6 * 60 * 60

# AGNES_REMOTE_STATUS_V1
REMOTE_STATUS = {"updated": 0, "projects": [], "current": None}
REMOTE_STATUS_LOCK = threading.Lock()
STATUS_PORT = 8766


def google_drive_root():
    """Dossier "Mon Drive" de Google Drive pour ordinateur, ou None.

    AGNES_GOOGLE_DRIVE_DIR peut forcer un chemin précis sans changer le code.
    """
    forced = os.environ.get("AGNES_GOOGLE_DRIVE_DIR", "").strip()
    if forced:
        forced = os.path.realpath(os.path.expanduser(forced))
        return forced if os.path.isdir(forced) else None

    cloud = os.path.join(os.path.expanduser("~"), "Library", "CloudStorage")
    try:
        accounts = sorted(
            os.path.join(cloud, name)
            for name in os.listdir(cloud)
            if name.startswith("GoogleDrive-") and os.path.isdir(os.path.join(cloud, name))
        )
    except OSError:
        return None

    for account in accounts:
        for leaf in ("My Drive", "Mon Drive"):
            candidate = os.path.join(account, leaf)
            if os.path.isdir(candidate):
                return candidate
    return None


def drive_component(value, fallback="episode"):
    value = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '-', str(value or '')).strip().strip('.')
    value = re.sub(r'\s+', ' ', value)[:120]
    return value or fallback


def export_publish_job_to_drive(job):
    root = google_drive_root()
    if not root:
        raise RuntimeError("Google Drive pour ordinateur introuvable. Installe-le ou définis AGNES_GOOGLE_DRIVE_DIR.")
    if not job.get('video') or not job.get('cover'):
        raise RuntimeError("Vidéo ou couverture manquante.")

    base = os.path.join(root, "Agnes Studio", "A publier")
    folder = os.path.join(base, drive_component(job.get('title')))
    os.makedirs(folder, exist_ok=True)

    shutil.copy2(os.path.join(job['dir'], 'video.mp4'), os.path.join(folder, 'video.mp4'))
    shutil.copy2(os.path.join(job['dir'], 'cover.jpg'), os.path.join(folder, 'couverture.jpg'))
    with open(os.path.join(folder, 'description.txt'), 'w', encoding='utf-8') as f:
        f.write(job.get('description', ''))
        if job.get('description') and not job.get('description', '').endswith('\n'):
            f.write('\n')
    return folder


def publish_cleanup():
    """Retire les préparations anciennes, jamais les médias des projets."""
    expired = [key for key, job in PUBLISH["jobs"].items() if time.time() - job["created"] > PUBLISH_TTL]
    for key in expired:
        job = PUBLISH["jobs"].pop(key)
        shutil.rmtree(job["dir"], ignore_errors=True)


def safe_path(rel):
    """Chemin relatif propre sous OUT, ou None."""
    parts = [p for p in rel.replace("\\", "/").split("/") if p not in ("", ".")]
    if not parts or any(p == ".." or not re.fullmatch(r"[\w\-. ]{1,120}", p) for p in parts):
        return None
    full = os.path.realpath(os.path.join(OUT, *parts))
    return full if full.startswith(os.path.realpath(OUT) + os.sep) else None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        line = args[0] if args else ""
        if isinstance(line, str) and ("/api/" in line or "/save" in line):
            sys.stderr.write("  " + (fmt % args).split("?")[0] + "\n")

    def _send(self, code, data, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _trusted(self):
        if self.headers.get("X-Studio") != "1":
            self._send(403, b'{"detail":"appel refuse (en-tete X-Studio manquant)"}')
            return False
        return True

    # YAKFLOW_LICENCE_LOCALE_V1 : toute la production exige une licence valide (vérifiée hors ligne, renouvelée 1 fois par période)
    LOCKED = ("/api/", "/bridge/", "/grok/", "/dl", "/save", "/open", "/publish/", "/status/update", "/radar/api/")

    def _licensed(self):
        if not self.path.startswith(self.LOCKED):
            return True
        if licence.ok():
            return True
        self._send(402, json.dumps({"detail": "Licence YakFlow requise : active ton code dans YakFlow.", "licence": False}, ensure_ascii=False).encode("utf-8"))
        return False

    def _licence_api(self, method):
        if self.path.startswith("/licence/status") and method == "GET":
            force = "force=1" in self.path
            return self._send(200, json.dumps(licence.status(force=force), ensure_ascii=False).encode("utf-8"))
        if not self._trusted():
            return
        if self.path.startswith("/licence/activate") and method == "POST":
            d = self._json_body(4096) or {}
            res = licence.activate(d.get("code"))
            return self._send(200 if res.get("ok") else 403, json.dumps(res, ensure_ascii=False).encode("utf-8"))
        if self.path.startswith("/licence/forget") and method == "POST":
            licence.forget()
            return self._send(200, b'{"ok":true}')
        return self._send(404, b'{"detail":"action licence inconnue"}')

    def _relay(self, method):
        if not self._trusted():
            return
        target = API + self.path[len("/api"):]
        body = None
        if method == "POST":
            body = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
        headers = {"Content-Type": "application/json"}
        if self.headers.get("Authorization"):
            headers["Authorization"] = self.headers["Authorization"]
        code, data = forward(method, target, body, headers)
        # l'API image peut répondre sur l'autre domaine d'Agnes
        if code in (404, 405) and self.path.startswith("/api/v1/images"):
            alt = API_ALT + self.path[len("/api"):]
            sys.stderr.write("  %s sur %s, j'essaie %s\n" % (code, target, alt))
            code2, data2 = forward(method, alt, body, headers)
            if code2 not in (404, 405):
                code, data = code2, data2
        if code >= 400:
            sys.stderr.write("  Agnes a répondu %s sur %s : %s\n" % (code, self.path.split("?")[0], data[:300].decode("utf-8", "replace") or "(réponse vide)"))
        self._send(code, data)

    def _download(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        url = (q.get("url") or [""])[0]
        name = re.sub(r'[^\w\-. ]', "", (q.get("name") or ["fichier"])[0]) or "fichier"
        host = urllib.parse.urlparse(url).hostname or ""
        # hôtes Agnes connus : libre ; autre hôte https (CDN de stockage) : seulement depuis le studio (en-tête X-Studio)
        known = host.endswith(ALLOWED_DL)
        private = host in ("localhost",) or re.fullmatch(r"[\d.]+|\[?[0-9a-f:]+\]?", host or "x") is not None
        if not url.startswith("https://") or private or not (known or self.headers.get("X-Studio") == "1"):
            sys.stderr.write("  téléchargement refusé : %s\n" % url[:200])
            self.send_error(400, "Lien non autorise")
            return
        if not known:
            sys.stderr.write("  téléchargement depuis %s\n" % host)
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                data, ctype = r.read(), r.headers.get("Content-Type") or "application/octet-stream"
        except Exception as e:
            self.send_error(502, str(e))
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Disposition", 'attachment; filename="%s"' % name)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _save(self):
        if not self._trusted():
            return
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        full = safe_path((q.get("path") or [""])[0])
        n = int(self.headers.get("Content-Length", 0) or 0)
        if not full or n <= 0 or n > MAX_SAVE:
            self._send(400, b'{"detail":"chemin ou taille refuse"}')
            return
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        tmp = full + ".part"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, full)
        self._send(200, ('{"ok":true,"path":"%s"}' % full.replace("\\", "/").replace('"', "")).encode())

    def _open(self):
        if not self._trusted():
            return
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        full = safe_path((q.get("path") or [""])[0]) or OUT
        os.makedirs(full, exist_ok=True)
        if sys.platform == "darwin":
            os.system('open "%s"' % full.replace('"', ""))
        elif sys.platform.startswith("win"):
            os.startfile(full)  # noqa
        self._send(200, b'{"ok":true}')

    def _json_body(self, limit=60 * 1024 * 1024):
        n = int(self.headers.get("Content-Length", 0) or 0)
        if n <= 0 or n > limit:
            return None
        try:
            return json.loads(self.rfile.read(n))
        except Exception:
            return None

    def _publish(self, method):
        if not self._trusted():
            return
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        action = parsed.path[len('/publish/'):]
        token = (query.get('token') or [''])[0]
        with PUBLISH['lock']:
            publish_cleanup()
            if action == 'create' and method == 'POST':
                data = self._json_body(16 * 1024) or {}
                if not isinstance(data, dict) or not isinstance(data.get('title'), str) or not isinstance(data.get('description'), str):
                    return self._send(400, b'{"detail":"metadonnees invalides"}')
                token = uuid.uuid4().hex
                directory = os.path.join(PUBLISH_DIR, token)
                os.makedirs(directory)
                PUBLISH['jobs'][token] = {'title': data['title'][:200], 'description': data['description'][:3000],
                                          'videoName': re.sub(r'[^\w\-. ]', '-', data.get('videoName', 'episode.mp4'))[:100],
                                          'created': time.time(), 'dir': directory, 'status': 'preparation', 'message': '',
                                          'video': False, 'cover': False}
                return self._send(200, json.dumps({'token': token}).encode())
            job = PUBLISH['jobs'].get(token)
            if not job:
                return self._send(404, b'{"detail":"preparation introuvable ou expiree"}')
            if action == 'media' and method == 'POST':
                kind = (query.get('kind') or [''])[0]
                if kind not in ('video', 'cover'):
                    return self._send(400, b'{"detail":"media invalide"}')
                size = int(self.headers.get('Content-Length', 0) or 0)
                limit = MAX_SAVE if kind == 'video' else 25 * 1024 * 1024
                if size <= 0 or size > limit:
                    return self._send(400, b'{"detail":"taille media invalide"}')
                path = os.path.join(job['dir'], 'video.mp4' if kind == 'video' else 'cover.jpg')
                with open(path + '.part', 'wb') as out:
                    remaining = size
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        out.write(chunk)
                        remaining -= len(chunk)
                if remaining:
                    os.unlink(path + '.part')
                    return self._send(400, b'{"detail":"envoi incomplet"}')
                os.replace(path + '.part', path)
                job[kind] = True
                if job['video'] and job['cover']:
                    job['status'] = 'pret'
                return self._send(200, b'{"ok":true}')
            if action == 'media' and method == 'GET':
                kind = (query.get('kind') or [''])[0]
                if kind not in ('video', 'cover') or not job[kind]:
                    return self._send(404, b'{"detail":"media absent"}')
                path = os.path.join(job['dir'], 'video.mp4' if kind == 'video' else 'cover.jpg')
                self.send_response(200)
                self.send_header('Content-Type', 'video/mp4' if kind == 'video' else 'image/jpeg')
                self.send_header('Content-Length', str(os.path.getsize(path)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                with open(path, 'rb') as source:
                    shutil.copyfileobj(source, self.wfile, 1024 * 1024)
                return
            if action == 'drive' and method == 'POST':
                try:
                    folder = export_publish_job_to_drive(job)
                except Exception as e:
                    return self._send(500, json.dumps({'detail': str(e)}, ensure_ascii=False).encode('utf-8'))
                job['status'] = 'pret'
                job['message'] = 'Copié dans Google Drive'
                return self._send(200, json.dumps({'ok': True, 'path': folder}, ensure_ascii=False).encode('utf-8'))
            if action == 'status' and method == 'POST':
                data = self._json_body(2048) or {}
                state = data.get('status')
                if state not in ('pret', 'ouvert', 'video', 'description', 'couverture', 'brouillon', 'intervention', 'erreur'):
                    return self._send(400, b'{"detail":"etat invalide"}')
                job['status'], job['message'] = state, str(data.get('message', ''))[:500]
                return self._send(200, b'{"ok":true}')
            if action in ('status', 'job') and method == 'GET':
                return self._send(200, json.dumps({k: job[k] for k in ('title', 'description', 'videoName', 'status', 'message', 'video', 'cover')}).encode())
        self._send(404, b'{"detail":"action inconnue"}')

    def _bridge(self, method):
        if not self._trusted():
            return
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        jid = (q.get("id") or [""])[0]
        worker = (q.get("worker") or [""])[0][:80]
        act = u.path[len("/bridge/"):]
        B = BRIDGE
        with B["lock"]:
            if act == "push" and method == "POST":
                d = self._json_body()
                if not d or not d.get("id") or not d.get("prompt"):
                    return self._send(400, b'{"detail":"travail invalide"}')
                old = B["jobs"].get(d["id"])
                if old and old["st"] in ("attente", "en cours") and old["prompt"] == d["prompt"]:
                    return self._send(200, b'{"ok":true,"deja":true}')
                h, now = phash(d), time.time()
                job = {"id": d["id"], "pid": d.get("pid", ""), "nom": d.get("nom", ""), "titre": d.get("titre", ""),
                       "prompt": d["prompt"], "refs": d.get("refs") or [], "st": "attente", "pushed": now, "h": h}
                orp = B["orphan"].pop(h, None)
                gh = B["ghost"].get(h)
                if orp and now - orp["t"] < ORPHAN_TTL:
                    job.update({"st": "fini", "data": orp["data"], "refs": []})
                    blog("push %s : image déjà reçue pour ce prompt, rendue tout de suite" % d["id"])
                elif gh and now - gh["t"] < GHOST_TTL:
                    job.update({"st": "en cours", "claimed": gh["t"]})
                    blog("push %s : ChatGPT dessine déjà ce prompt, j'attends son image (pas de nouvel envoi)" % d["id"])
                else:
                    blog("push %s (%s)" % (d["id"], d.get("nom", "")))
                B["jobs"][d["id"]] = job
                if d["id"] in B["order"]:
                    B["order"].remove(d["id"])
                B["order"].append(d["id"])
                return self._send(200, b'{"ok":true}')
            if act == "status":
                j = B["jobs"].get(jid)
                current = time.time()
                workers = {k: v for k, v in B["workers"].items() if current - v["seen"] < 30}
                B["workers"] = workers
                if j and j["st"] == "en cours" and current - j.get("claimed", current) > 30 * 60:
                    j["st"] = "incertain"
                    j["error"] = "L'onglet ChatGPT n'a pas rendu l'image après 30 min. Vérifie sa conversation avant de relancer."
                alive = bool(workers) or current - B["seen"] < 25
                out = {"protocol": 2, "alive": alive, "workers": len(workers) or (1 if current - B["seen"] < 25 else 0), "info": B["info"]}
                if j:
                    out.update({"st": j["st"], "error": j.get("error"), "data": j.get("data") if j["st"] == "fini" else None,
                                "pos": B["order"].index(jid) + 1 if jid in B["order"] else 0})
                return self._send(200, json.dumps(out).encode())
            if act == "forget" and method == "POST":
                j = B["jobs"].pop(jid, None)
                if jid in B["order"]:
                    B["order"].remove(jid)
                if j and j["st"] == "en cours" and time.time() - j.get("claimed", 0) < GHOST_TTL:
                    B["ghost"][j.get("h") or phash(j)] = {"t": j.get("claimed", time.time()), "id": jid}
                    blog("forget %s alors que ChatGPT dessine : je garde sa trace (image attendue)" % jid)
                elif j:
                    blog("forget %s (%s)" % (jid, j["st"]))
                return self._send(200, b'{"ok":true}')
            # côté ChatGPT
            if worker:
                B["workers"][worker] = {"seen": time.time(), "info": (q.get("info") or [""])[0][:200]}
            else:
                B["seen"] = time.time()
            if act == "hello" and method == "POST":
                if worker:
                    blog("onglet ChatGPT connecté : %s" % worker[:12])
                    return self._send(200, b'{"ok":true}')
                # Compatibilité avec l'ancien pont : ne toucher qu'à ses travaux.
                n = 0
                for j in B["jobs"].values():
                    if j["st"] == "en cours" and not j.get("worker"):
                        j["st"], n = "attente", n + 1
                blog("onglet ChatGPT (re)démarré, %d travail(aux) remis en file" % n)
                return self._send(200, json.dumps({"ok": True, "repris": n}).encode())
            if act == "heartbeat" and method == "POST" and worker:
                return self._send(200, b'{"ok":true}')
            if act == "peek":
                B["info"] = (q.get("info") or [""])[0][:200]
                j = bridge_next()
                return self._send(200, json.dumps({"job": {k: j[k] for k in ("id", "pid", "nom", "titre", "prompt", "refs")} if j else None}).encode())
            if act == "take" and method == "POST" and worker:
                j = bridge_next()
                if not j:
                    return self._send(200, b'{"job":null}')
                j["st"], j["claimed"], j["worker"] = "en cours", time.time(), worker
                blog("take %s par %s (%s)" % (j["id"], worker[:12], j.get("nom", "")))
                return self._send(200, json.dumps({"job": {k: j[k] for k in ("id", "pid", "nom", "titre", "prompt", "refs")}}).encode())
            if act == "claim" and method == "POST":
                j = B["jobs"].get(jid)
                if not j:
                    return self._send(404, b'{"detail":"travail inconnu"}')
                if j["st"] != "attente":
                    return self._send(409, b'{"detail":"travail deja pris"}')
                j["st"], j["claimed"] = "en cours", time.time()
                blog("claim %s (%s)" % (jid, j.get("nom", "")))
                return self._send(200, b'{"ok":true}')
            if act == "result" and method == "POST":
                d = self._json_body() or {}
                rid = d.get("id", "")
                j = B["jobs"].get(rid)
                if j and j.get("worker") and worker != j["worker"]:
                    return self._send(409, b'{"detail":"autre onglet proprietaire"}')
                gh = next((h for h, g in B["ghost"].items() if g["id"] == rid), None)
                if not j and gh and d.get("data"):
                    # le studio avait oublié ce travail : un travail identique l'a peut-être remplacé
                    j = next((x for x in B["jobs"].values() if x.get("h") == gh and x["st"] in ("attente", "en cours")), None)
                    if not j:
                        B["orphan"][gh] = {"t": time.time(), "data": d["data"]}
                        B["ghost"].pop(gh, None)
                        blog("result %s : plus personne ne l'attend, image gardée pour la prochaine demande identique" % rid)
                        return self._send(200, b'{"ok":true,"orphelin":true}')
                if gh:
                    B["ghost"].pop(gh, None)
                if not j:
                    blog("result %s : travail inconnu" % rid)
                    return self._send(404, b'{"detail":"travail inconnu"}')
                if d.get("data"):
                    j["st"], j["data"] = "fini", d["data"]
                    blog("result %s : image reçue (%d Ko)" % (rid, len(d["data"]) // 1024))
                else:
                    j["st"], j["error"] = "echec", (d.get("error") or "erreur inconnue")[:300]
                    blog("result %s : ÉCHEC : %s" % (rid, j["error"]))
                if j["id"] in B["order"]:
                    B["order"].remove(j["id"])
                j["refs"] = []
                return self._send(200, b'{"ok":true}')
        self._send(404, b'{"detail":"action inconnue"}')


    def _status_update(self):
        """Snapshot lecture seule reçu depuis le navigateur Agnes du Mac."""
        if not self._trusted():
            return
        data = self._json_body(limit=2 * 1024 * 1024)
        if not isinstance(data, dict):
            return self._send(400, b'{"detail":"json invalide"}')
        clean = {
            "updated": int(time.time() * 1000),
            "projects": data.get("projects", [])[:200],
            "current": data.get("current"),
        }
        with REMOTE_STATUS_LOCK:
            REMOTE_STATUS.clear()
            REMOTE_STATUS.update(clean)
        return self._send(200, b'{"ok":true}')


    # AGNES_GROK_BRIDGE_V1
    def _grok(self,method):
        if self.headers.get("X-Studio")!="1": return self._send(403,b'{"detail":"X-Studio requis"}')
        grok_cleanup()
        u=urllib.parse.urlparse(self.path); act=u.path[len("/grok/"):]
        q=urllib.parse.parse_qs(u.query); worker=(q.get("worker")or[""])[0]
        if act=="heartbeat" and method=="POST":
            if not worker:return self._send(400,b'{"detail":"worker manquant"}')
            with GROK["lock"]:GROK["workers"][worker]={"t":time.time(),"info":(q.get("info")or[""])[0][:120]}
            return self._send(200,b'{"ok":true}')
        if act=="status" and method=="GET":
            with GROK["lock"]:
                data={"alive":bool(GROK["workers"]),"workers":len(GROK["workers"]),
                      "pending":sum(j.get("st")=="attente" for j in GROK["jobs"].values()),
                      "running":sum(j.get("st")=="en cours" for j in GROK["jobs"].values())}
            return self._send(200,json.dumps(data).encode())
        if act=="push" and method=="POST":
            d=self._json_body()or{}; jid=str(d.get("id")or"")
            if not jid or not d.get("image"):return self._send(400,b'{"detail":"id/image manquant"}')
            with GROK["lock"]:
                old=GROK["jobs"].get(jid)
                if old and old.get("st") in ("attente","en cours","fini"):
                    pos=(GROK["order"].index(jid)+1) if jid in GROK["order"] else 0
                    return self._send(200,json.dumps({"ok":True,"pos":pos,"st":old.get("st")}).encode())
                j={"id":jid,"pid":str(d.get("pid")or""),"sid":str(d.get("sid")or""),
                   "titre":str(d.get("titre")or"")[:160],"nom":str(d.get("nom")or"")[:160],
                   "prompt":str(d.get("prompt")or"")[:12000],"image":d.get("image"),
                   "seconds":str(d.get("seconds")or"6"),"aspect":str(d.get("aspect")or"9:16"),
                   "quality":str(d.get("quality")or"720P"),"st":"attente","created":time.time(),
                   "worker":"","file":"","error":""}
                GROK["jobs"][jid]=j;GROK["order"].append(jid)
                pos=sum(GROK["jobs"].get(x,{}).get("st")=="attente" for x in GROK["order"])
            return self._send(200,json.dumps({"ok":True,"pos":pos}).encode())
        if act=="take" and method=="POST":
            if not worker:return self._send(400,b'{"detail":"worker manquant"}')
            with GROK["lock"]:
                GROK["workers"][worker]={"t":time.time(),"info":(q.get("info")or[""])[0][:120]}
                j=next((GROK["jobs"].get(jid) for jid in GROK["order"] if GROK["jobs"].get(jid,{}).get("st")=="attente"),None)
                if not j:return self._send(200,b'{"job":null}')
                j["st"],j["worker"],j["claimed"]="en cours",worker,time.time()
                if j["id"] in GROK["order"]:GROK["order"].remove(j["id"])
                public={k:j.get(k) for k in ("id","pid","sid","titre","nom","prompt","image","seconds","aspect","quality")}
            return self._send(200,json.dumps({"job":public}).encode())
        if act=="job" and method=="GET":
            jid=(q.get("id")or[""])[0]
            with GROK["lock"]:
                j=GROK["jobs"].get(jid)
                if not j:return self._send(404,b'{"detail":"job Grok inconnu"}')
                wait=[x for x in GROK["order"] if GROK["jobs"].get(x,{}).get("st")=="attente"]
                pos=wait.index(jid)+1 if jid in wait else 0
                data={"id":jid,"st":j.get("st"),"pos":pos,"worker":j.get("worker",""),"error":j.get("error","")}
            return self._send(200,json.dumps(data).encode())
        if act=="result" and method=="POST":
            jid=(q.get("id")or[""])[0]
            with GROK["lock"]:
                j=GROK["jobs"].get(jid)
                if not j:return self._send(404,b'{"detail":"job Grok inconnu"}')
                if j.get("worker") and worker!=j.get("worker"):return self._send(409,b'{"detail":"autre onglet proprietaire"}')
            n=int(self.headers.get("Content-Length") or 0)
            if n<10000:return self._send(400,b'{"detail":"video trop petite"}')
            if n>250*1024*1024:return self._send(413,b'{"detail":"video trop grosse"}')
            raw=self.rfile.read(n);path=os.path.join(GROK_DIR,re.sub(r"[^A-Za-z0-9_.-]+","_",jid)+".mp4")
            with open(path,"wb") as f:f.write(raw)
            with GROK["lock"]:
                j=GROK["jobs"].get(jid)
                if j:j["st"],j["file"],j["done"],j["image"]="fini",path,time.time(),""
            return self._send(200,b'{"ok":true}')
        if act=="fail" and method=="POST":
            d=self._json_body()or{};jid=str(d.get("id")or"")
            with GROK["lock"]:
                j=GROK["jobs"].get(jid)
                if j and(not j.get("worker")or j.get("worker")==worker):
                    j["st"],j["error"],j["done"],j["image"]="echec",str(d.get("error")or"erreur Grok")[:500],time.time(),""
            return self._send(200,b'{"ok":true}')
        if act=="file" and method=="GET":
            jid=(q.get("id")or[""])[0]
            with GROK["lock"]:
                j=GROK["jobs"].get(jid);path=j.get("file") if j else""
            if not path or not os.path.isfile(path):return self._send(404,b'{"detail":"video Grok absente"}')
            with open(path,"rb") as f:raw=f.read()
            self.send_response(200);self.send_header("Content-Type","video/mp4");self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store");self.end_headers();self.wfile.write(raw);return
        return self._send(404,b'{"detail":"action Grok inconnue"}')

    def do_OPTIONS(self):
        self.send_error(405)

    def do_GET(self):
        if self.path.startswith("/licence/"): return self._licence_api("GET")
        if not self._licensed(): return
        if self.path.startswith("/grok/"): return self._grok("GET")
        # AGNES_RADAR_TIKTOK_V1
        if self.path.startswith("/radar/api/"):
            return agnes_radar.handle_get(self)
        if self.path.startswith("/publish/"):
            return self._publish("GET")
        if self.path.startswith("/bridge/"):
            return self._bridge("GET")
        if self.path.startswith("/api/"):
            return self._relay("GET")
        if self.path.startswith("/dl?"):
            return self._download()
        if self.path.startswith("/ping"):
            return self._send(200, ('{"ok":true,"dossier":"%s"}' % OUT.replace("\\", "/")).encode())
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/licence/"): return self._licence_api("POST")
        if not self._licensed(): return
        if self.path.startswith("/grok/"): return self._grok("POST")
        # AGNES_RADAR_TIKTOK_V1
        if self.path.startswith("/radar/api/"):
            return agnes_radar.handle_post(self)
        if self.path.startswith("/status/update"):
            return self._status_update()
        if self.path.startswith("/publish/"):
            return self._publish("POST")
        if self.path.startswith("/bridge/"):
            return self._bridge("POST")
        if self.path.startswith("/api/"):
            return self._relay("POST")
        if self.path.startswith("/save?"):
            return self._save()
        if self.path.startswith("/open"):
            return self._open()
        self.send_error(404)



# AGNES_REMOTE_STATUS_V1 — serveur lecture seule séparé
STATUS_HTML = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Agnes - Suivi</title>\n<style>:root{color-scheme:dark;--card:#15171b;--line:#292d33;--txt:#f4f1ea;--sub:#9d998f;--amber:#ffb224;--ok:#3fd08a;--err:#ff4b3e}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#1a140a 0,#0b0c0e 220px);color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}main{max-width:720px;margin:auto;padding:18px 14px 50px}.top{display:flex;align-items:center;gap:10px;margin-bottom:16px}.logo{width:34px;height:34px;border:2px solid var(--amber);border-radius:8px;display:grid;place-items:center;color:var(--amber);font-weight:900}.grow{flex:1}h1{font-size:20px;margin:0}.small,.meta{font-size:12px;color:var(--sub)}.live{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ok)}.dot{width:8px;height:8px;background:currentColor;border-radius:50%}.hero,.card{background:rgba(21,23,27,.96);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}.tag{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}.bar{height:7px;background:#262a30;border-radius:99px;overflow:hidden;margin:9px 0}.bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb224,#ffc85c)}.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.num{background:#0d0f12;border-radius:10px;padding:9px}.num b{display:block;font-size:18px}.num span{font-size:10px;color:var(--sub);text-transform:uppercase}.project{display:grid;grid-template-columns:1fr auto;gap:5px 8px;padding:13px 4px;border-top:1px solid var(--line);cursor:pointer}.project:first-child{border-top:0}.title{font-weight:750}.state{font-size:11px;font-weight:800;padding:4px 7px;border-radius:7px;background:#24272c}.state.ok{color:var(--ok)}.state.run{color:var(--amber)}.state.err{color:var(--err)}h3{font-size:12px;text-transform:uppercase;letter-spacing:.13em;color:var(--sub);margin:18px 3px 9px}.empty{color:var(--sub);text-align:center;padding:20px}#detail{display:none}#detail.on{display:block}.back{border:0;background:#202328;color:#fff;border-radius:9px;padding:9px 12px;font-weight:700;margin-bottom:12px}video{width:100%;max-height:70vh;background:#000;border-radius:14px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.gallery img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:9px;border:1px solid var(--line)}.viewer{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;z-index:99;align-items:center;justify-content:center;padding:45px 10px 20px}.viewer.on{display:flex}.viewer img{max-width:100%;max-height:90vh}.close{position:absolute;top:10px;right:12px;width:42px;height:42px;border-radius:50%;border:1px solid #555;background:#222;color:white;font-size:24px}</style></head>\n<body><main><div class="top"><div class="logo">A</div><div><h1>Agnes Studio</h1><div class="small">Suivi lecture seule</div></div><div class="grow"></div><div class="live"><i class="dot"></i><span id="live">Connexion...</span></div></div><div id="home"><div id="app"><div class="card empty">Chargement...</div></div></div><div id="detail"><button class="back" onclick="closeDetail()">← Projets</button><div id="detailBody"></div></div></main><div class="viewer" id="viewer" onclick="closeViewer()"><button class="close">×</button><img id="bigImg"></div>\n<script>const esc=s=>String(s??\'\').replace(/[&<>"\']/g,m=>({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#039;\'}[m]));let STATE=null;function stateLabel(p){if(p.errors>0)return[\'Erreur\',\'err\'];if(p.montage===\'fini\')return[\'Monté\',\'ok\'];if(p.running>0)return[\'En cours\',\'run\'];return[\'À faire\',\'\']}function row(p){const [lab,cl]=stateLabel(p);return `<div class="project" onclick=\'openDetail(${JSON.stringify(p.id)})\'><div><div class="title">${esc(p.title)}</div><div class="meta">${esc(p.publication||\'\')} · ${p.imagesDone}/${p.imagesTotal} images · ${p.clipsDone}/${p.clipsTotal} clips</div></div><span class="state ${cl}">${lab}</span></div>`}function render(d){STATE=d;document.querySelector(\'#live\').textContent=\'En direct\';const cur=d.current||d.projects.find(p=>p.running>0)||d.projects.find(p=>p.active&&p.montage!==\'fini\');let h=\'\';if(cur){const total=Math.max(1,cur.imagesTotal+cur.clipsTotal+1),done=cur.imagesDone+cur.clipsDone+(cur.montage===\'fini\'?1:0),pct=Math.round(done/total*100);h+=`<section class="hero" onclick=\'openDetail(${JSON.stringify(cur.id)})\'><span class="tag">Projet en cours · toucher pour ouvrir</span><h2>${esc(cur.title)}</h2><div class="bar"><i style="width:${pct}%"></i></div><div class="nums"><div class="num"><b>${cur.imagesDone}/${cur.imagesTotal}</b><span>Images</span></div><div class="num"><b>${cur.clipsDone}/${cur.clipsTotal}</b><span>Clips</span></div><div class="num"><b>${pct}%</b><span>Total</span></div></div></section>`}h+=\'<h3>Projets · toucher pour voir</h3><section class="card">\'+d.projects.filter(p=>!p.archived).map(row).join(\'\')+\'</section>\';document.querySelector(\'#app\').innerHTML=h}async function openDetail(id){const p=(STATE?.projects||[]).find(x=>x.id===id);if(!p)return;document.querySelector(\'#home\').style.display=\'none\';document.querySelector(\'#detail\').classList.add(\'on\');const body=document.querySelector(\'#detailBody\');body.innerHTML=\'<section class="card empty">Chargement...</section>\';const r=await fetch(\'/media/list?project=\'+encodeURIComponent(id),{cache:\'no-store\'});const m=await r.json();let h=`<section class="card"><span class="tag">Projet</span><h2>${esc(p.title)}</h2></section>`;h+=\'<h3>Vidéo montée</h3><section class="card">\'+(m.video?`<video controls playsinline preload="metadata" src="/media/video?project=${encodeURIComponent(id)}"></video>`:\'<div class="empty">Vidéo pas encore disponible.</div>\')+\'</section>\';h+=\'<h3>Images · \'+m.images.length+\'</h3><section class="card">\'+(m.images.length?\'<div class="gallery">\'+m.images.map(n=>`<img loading="lazy" src="/media/image?project=${encodeURIComponent(id)}&name=${encodeURIComponent(n)}" onclick="openViewer(this.src);event.stopPropagation()">`).join(\'\')+\'</div>\':\'<div class="empty">Aucune image enregistrée.</div>\')+\'</section>\';body.innerHTML=h;window.scrollTo(0,0)}function closeDetail(){document.querySelector(\'#detail\').classList.remove(\'on\');document.querySelector(\'#home\').style.display=\'block\';document.querySelector(\'#detailBody\').innerHTML=\'\'}function openViewer(src){document.querySelector(\'#bigImg\').src=src;document.querySelector(\'#viewer\').classList.add(\'on\')}function closeViewer(){document.querySelector(\'#viewer\').classList.remove(\'on\');document.querySelector(\'#bigImg\').src=\'\'}async function tick(){try{const r=await fetch(\'/status.json?x=\'+Date.now(),{cache:\'no-store\'});render(await r.json())}catch(e){document.querySelector(\'#live\').textContent=\'Hors ligne\'}}tick();setInterval(tick,3000);</script></body></html>'

class StatusHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send_status(self, code, data, ctype="application/json; charset=utf-8"):
        if isinstance(data, str):
            data = data.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(data)

    def _media_file(self, project, kind, name=""):
        folder = remote_project_dir(project)
        if not folder or not os.path.isdir(folder):
            return self._send_status(404, b'{"detail":"projet introuvable"}')
        safe = os.path.basename(folder)
        if kind == "video":
            path = os.path.join(folder, safe + ".mp4")
            ctype = "video/mp4"
        elif kind == "image":
            if not name or os.path.basename(name) != name:
                return self._send_status(400, b'{"detail":"image invalide"}')
            path = os.path.join(folder, name) if name == safe + "-couverture.jpg" else os.path.join(folder, "images", name)
            low = name.lower()
            ctype = "image/png" if low.endswith(".png") else ("image/webp" if low.endswith(".webp") else "image/jpeg")
        else:
            return self._send_status(400, b'{"detail":"media invalide"}')
        path = os.path.realpath(path)
        if not os.path.isfile(path):
            return self._send_status(404, b'{"detail":"media absent"}')
        size = os.path.getsize(path)
        rng = self.headers.get("Range", "")
        start, end, status = 0, size - 1, 200
        if rng.startswith("bytes="):
            try:
                part = rng[6:].split(",", 1)[0]
                a, b = part.split("-", 1)
                if a:
                    start = int(a)
                    end = int(b) if b else size - 1
                elif b:
                    start = max(0, size - int(b))
                    end = size - 1
                start = max(0, min(start, size - 1))
                end = max(start, min(end, size - 1))
                status = 206
            except Exception:
                pass
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "private, max-age=30")
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        if path != "/ping" and not licence.ok():
            return self._send_status(402, '<!doctype html><meta charset="utf-8"><body style="background:#08090b;color:#f5f2ec;font-family:sans-serif;padding:40px">Licence YakFlow requise : active ton code sur l\'ordinateur.</body>', "text/html; charset=utf-8")
        if path == "/media/list":
            project = (query.get("project") or [""])[0]
            return self._send_status(200, json.dumps(remote_media_manifest(project), ensure_ascii=False).encode("utf-8"))
        if path == "/media/video":
            return self._media_file((query.get("project") or [""])[0], "video")
        if path == "/media/image":
            return self._media_file((query.get("project") or [""])[0], "image", (query.get("name") or [""])[0])
        if path in ("/", "/index.html", "/status.html"):
            return self._send_status(200, STATUS_HTML, "text/html; charset=utf-8")
        if path == "/status.json":
            with REMOTE_STATUS_LOCK:
                payload = dict(REMOTE_STATUS)
            return self._send_status(
                200,
                json.dumps(payload, ensure_ascii=False).encode("utf-8")
            )
        if path == "/ping":
            return self._send_status(200, b'{"ok":true,"readonly":true}')
        self._send_status(404, b'{"detail":"not found"}')

    def do_POST(self):
        self._send_status(405, b'{"detail":"lecture seule"}')


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    srv = Server(("127.0.0.1", PORT), Handler)
    status_srv = Server(("127.0.0.1", STATUS_PORT), StatusHandler)
    threading.Thread(target=status_srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/" % PORT
    print("YakFlow tourne sur " + url + "  (Ctrl+C pour arrêter)")
    st = licence.status()
    print("Licence : " + ("active" if st.get("ok") else "à activer dans le navigateur"))
    print("Les fichiers sont rangés dans " + OUT)
    print("Suivi téléphone lecture seule : http://127.0.0.1:%d/" % STATUS_PORT)
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêté.")
