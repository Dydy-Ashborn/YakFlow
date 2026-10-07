"""Licence YakFlow (copie locale).

- Le code acheté est envoyé UNE fois au serveur de licences (yakflow.netlify.app) avec l'empreinte de cet ordinateur.
- Le serveur répond par une licence signée (ECDSA P-256) valable jusqu'à la fin de la période payée.
- Ensuite tout se vérifie ici, hors ligne : signature, ordinateur, date. Un seul nouvel appel par période (≈ 1 par mois).
- 3 jours de tolérance si Internet est coupé au moment du renouvellement.
Aucune dépendance : bibliothèque standard Python uniquement.
"""
import base64, hashlib, json, os, platform, re, subprocess, sys, threading, time, urllib.error, urllib.request, uuid

VERSION = "1.0.0"
API = os.environ.get("YAKFLOW_LICENCE_URL", "https://yakflow.netlify.app/.netlify/functions/licence")
GRACE = 3 * 24 * 3600 * 1000          # tolérance hors ligne après la fin de période (ms)
RETRY_AFTER = 10 * 60                 # après un échec réseau, on ne réessaie pas avant 10 min (s)
DIR = os.path.join(os.path.expanduser("~"), ".yakflow")
FILE = os.path.join(DIR, "licence.json")

# clé publique ECDSA P-256 du serveur de licences (la clé privée reste dans Netlify)
_QX = 0x1c76b533cffa3c5c16ca7c8c5fde8781f38685608ad5492dab455c8e7ec770a3
_QY = 0xacc23e63790635ff304ae3931da403a56a5b3061e77f2f37f28827f241004519
_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
_A = _P - 3
_Nn = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
_G = (0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,
      0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)


def _add(p, q):
    if p is None:
        return q
    if q is None:
        return p
    if p[0] == q[0]:
        if (p[1] + q[1]) % _P == 0:
            return None
        l = (3 * p[0] * p[0] + _A) * pow(2 * p[1], -1, _P) % _P
    else:
        l = (q[1] - p[1]) * pow(q[0] - p[0], -1, _P) % _P
    x = (l * l - p[0] - q[0]) % _P
    return (x, (l * (p[0] - x) - p[1]) % _P)


def _mul(k, p):
    r = None
    while k:
        if k & 1:
            r = _add(r, p)
        p = _add(p, p)
        k >>= 1
    return r


_lock = threading.Lock()
_state = {"checked": 0.0, "status": None, "last_try": 0.0}


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _verify(token):
    """Renvoie le contenu de la licence si la signature ECDSA est bonne, sinon None."""
    try:
        body_b64, sig_b64 = token.split(".")
        body, sig = _b64d(body_b64), _b64d(sig_b64)
        if len(sig) != 64:
            return None
        r, s_ = int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")
        if not (0 < r < _Nn and 0 < s_ < _Nn):
            return None
        z = int.from_bytes(hashlib.sha256(body).digest(), "big")
        w = pow(s_, -1, _Nn)
        pt = _add(_mul(z * w % _Nn, _G), _mul(r * w % _Nn, (_QX, _QY)))
        if pt is None or pt[0] % _Nn != r:
            return None
        return json.loads(body.decode("utf-8"))
    except Exception:
        return None


def _run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=8).stdout
    except Exception:
        return ""


def machine_id():
    """Empreinte stable de cet ordinateur (identifiant matériel haché, rien de personnel n'est envoyé)."""
    raw = ""
    if sys.platform == "darwin":
        m = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', _run(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"]))
        raw = m.group(1) if m else ""
    elif sys.platform.startswith("win"):
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0,
                                winreg.KEY_READ | getattr(winreg, "KEY_WOW64_64KEY", 0)) as k:
                raw = winreg.QueryValueEx(k, "MachineGuid")[0]
        except Exception:
            raw = ""
    else:
        for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
            try:
                raw = open(p).read().strip()
                if raw:
                    break
            except OSError:
                pass
    if not raw:
        raw = "%012x|%s" % (uuid.getnode(), platform.node())
    return hashlib.sha256(("yakflow|" + raw).encode("utf-8")).hexdigest()[:40]


def _load():
    try:
        with open(FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save(data):
    os.makedirs(DIR, exist_ok=True)
    tmp = FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, FILE)


def _post(payload):
    """Appel au serveur de licences. Renvoie (statut HTTP, json). Statut 0 = réseau indisponible."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API, data=data, method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "YakFlow/" + VERSION})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {}
    except Exception as e:
        # Python installé depuis python.org sur Mac : certificats parfois absents -> on passe par curl (présent sur Mac et Windows 10+)
        if "CERTIFICATE" not in str(e).upper() and "SSL" not in str(e).upper():
            return 0, {"message": "Connexion impossible : %s" % e}
        out = _run(["curl", "-sS", "-m", "20", "-X", "POST", "-H", "Content-Type: application/json",
                    "-d", data.decode("utf-8"), "-w", "\n%{http_code}", API])
        try:
            text, code = out.rsplit("\n", 1)
            return int(code), json.loads(text or "{}")
        except Exception:
            return 0, {"message": "Connexion impossible au serveur de licences."}


def _status_from(stored, machine):
    lic = _verify(stored.get("token", "")) if stored.get("token") else None
    if not lic or lic.get("m") != machine:
        return None
    return lic


def _public(ok, lic=None, message="", offline=False):
    out = {"ok": ok, "message": message, "offline": offline, "version": VERSION}
    if lic:
        out.update({"type": lic.get("t"), "until": lic.get("u"), "email": lic.get("e", "")})
    return out


def activate(code):
    """Active un code sur cet ordinateur (bouton « Activer » de l'écran d'accueil)."""
    code = re.sub(r"[^A-Z0-9-]", "", str(code or "").upper())
    if not code:
        return _public(False, message="Entre ton code YakFlow.")
    machine = machine_id()
    status, data = _post({"code": code, "machine": machine, "version": VERSION})
    if status == 200 and data.get("ok"):
        lic = _verify(data.get("token", ""))
        if not lic or lic.get("m") != machine:
            return _public(False, message="Réponse du serveur de licences invalide.")
        _save({"code": code, "token": data["token"], "saved": int(time.time())})
        with _lock:
            _state.update(status=_public(True, lic), checked=time.time())
        return _public(True, lic)
    if status == 0:
        return _public(False, message=data.get("message") or "Pas de connexion Internet. L'activation demande Internet une seule fois.")
    return _public(False, message=data.get("message") or "Activation refusée (HTTP %s)." % status)


def forget():
    try:
        os.remove(FILE)
    except OSError:
        pass
    with _lock:
        _state.update(status=None, checked=0.0)


def status(force=False):
    """État de la licence. Ne contacte le serveur que si la période payée est terminée."""
    with _lock:
        cached = _state["status"]
        if not force and cached and time.time() - _state["checked"] < 60:
            return cached
    machine = machine_id()
    stored = _load()
    lic = _status_from(stored, machine)
    now = int(time.time() * 1000)
    if lic and now < lic.get("u", 0):
        result = _public(True, lic)
    elif not stored.get("code"):
        result = _public(False, message="Active YakFlow avec le code reçu après ton abonnement.")
    else:
        # période terminée (ou licence absente) : un seul appel pour renouveler
        recent_fail = time.time() - _state["last_try"] < RETRY_AFTER
        code, data = (0, {}) if recent_fail else _post({"code": stored["code"], "machine": machine, "version": VERSION})
        if code == 200 and data.get("ok") and (_verify(data.get("token", "")) or {}).get("m") == machine:
            stored["token"] = data["token"]
            _save(stored)
            result = _public(True, _verify(data["token"]))
        elif code in (0, 429) or code >= 500:
            _state["last_try"] = time.time()
            if lic and now < lic.get("u", 0) + GRACE:
                result = _public(True, lic, "Renouvellement impossible pour l'instant (pas de connexion). YakFlow continue quelques jours.", offline=True)
            else:
                result = _public(False, lic, "Connecte-toi à Internet pour renouveler ta licence YakFlow.", offline=True)
        else:
            stored.pop("token", None)
            _save(stored)
            result = _public(False, message=data.get("message") or "Licence refusée.")
    with _lock:
        _state.update(status=result, checked=time.time())
    return result


def ok():
    return bool(status().get("ok"))
