// YakFlow · relais Cloudflare Worker
// Rôle : faire passer les appels Agnes (API + téléchargement des images/clips) pour les abonnés YakFlow,
// sans aucune lecture de base de données : chaque appel porte la licence signée (jeton ECDSA) délivrée
// une fois par mois par yakflow.netlify.app. Le Worker vérifie juste la signature et la date.
//
// À coller tel quel dans Cloudflare (Workers & Pages > Créer > Worker > Modifier le code), puis Déployer.

const PUBLIC_KEY = {
  kty: 'EC', crv: 'P-256',
  x: 'HHa1M8_6PFwWynyMX96HgfOGhWCK1Uktq0Vcjn7HcKM',
  y: 'rMI-Y3kGNf8wSuOTHaQDpWpbMGHnfy838ogn8kEARRk',
};
const ALLOWED_ORIGINS = ['https://yakflow.netlify.app', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const AGNES = ['https://apihub.agnes-ai.com', 'https://apihub.agnes-ai.cn'];
const AGNES_PATHS = new Set(['POST /v1/images/generations', 'POST /v1/videos', 'GET /agnesapi']);
const MEDIA_HOSTS = ['.agnes-ai.cn', '.agnes-ai.com', '.agnes-ai.space', '.myqcloud.com'];
const GRACE = 3 * 24 * 3600 * 1000;      // 3 jours de tolérance après la fin de période (renouvellement en cours)
const MAX_BODY = 20 * 1024 * 1024;

let keyPromise = null;
const key = () => (keyPromise ||= crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function checkToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await key(), b64u(sig), b64u(body));
    if (!ok) return null;
    const lic = JSON.parse(new TextDecoder().decode(b64u(body)));
    return lic && lic.u && Date.now() < lic.u + GRACE ? lic : null;
  } catch { return null; }
}

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Yakflow-Token, X-Studio', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const json = (data, status, extra) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

function mediaAllowed(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && MEDIA_HOSTS.some((s) => u.hostname.toLowerCase().endsWith(s));
  } catch { return false; }
}

async function agnes(request, url, path, h) {
  if (!AGNES_PATHS.has(request.method + ' ' + path)) return json({ detail: 'Opération Agnes non autorisée.' }, 404, h);
  const auth = request.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S{8,}$/.test(auth)) return json({ detail: 'Clé Agnes manquante.' }, 401, h);
  let body;
  if (request.method === 'POST') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return json({ detail: 'Requête trop volumineuse.' }, 413, h);
  }
  let res;
  for (const origin of AGNES) {
    res = await fetch(origin + path + url.search, { method: request.method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body });
    if (!([404, 405].includes(res.status) && path === '/v1/images/generations')) break;
  }
  const out = { 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store', ...h };
  if (res.headers.get('Retry-After')) out['Retry-After'] = res.headers.get('Retry-After');
  return new Response(res.body, { status: res.status, headers: out });
}

async function download(url, h) {
  let target = url.searchParams.get('url');
  if (!mediaAllowed(target)) return json({ detail: 'Lien média non autorisé.' }, 400, h);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(target, { redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const next = new URL(res.headers.get('Location'), target).toString();
      if (!mediaAllowed(next)) return json({ detail: 'Redirection média non autorisée.' }, 400, h);
      target = next; continue;
    }
    if (!res.ok) return json({ detail: 'Téléchargement refusé par la source.' }, res.status, h);
    return new Response(res.body, { status: 200, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'no-store', ...h } });
  }
  return json({ detail: 'Trop de redirections.' }, 400, h);
}

export default {
  async fetch(request) {
    const h = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: h['Access-Control-Allow-Origin'] ? 204 : 403, headers: h });
    const url = new URL(request.url);
    if (url.pathname === '/ping') return json({ ok: true, mode: 'relais' }, 200, h);
    const lic = await checkToken(request.headers.get('X-Yakflow-Token'));
    if (!lic) return json({ detail: 'Licence YakFlow invalide ou expirée. Recharge YakFlow.', licence: false }, 403, h);
    try {
      if (url.pathname.startsWith('/api/')) return await agnes(request, url, url.pathname.slice(4), h);
      if (url.pathname === '/dl' && request.method === 'GET') return await download(url, h);
      return json({ detail: 'Action inconnue.' }, 404, h);
    } catch (error) {
      return json({ detail: 'Relais Agnes indisponible : ' + String(error && error.message || error).slice(0, 120) }, 502, h);
    }
  },
};
