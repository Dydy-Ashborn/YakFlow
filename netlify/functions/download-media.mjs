import { checkLicense } from '../lib/firebase.mjs';
import { json } from '../lib/http.mjs';

const HOST_SUFFIXES = ['.agnes-ai.cn', '.agnes-ai.com', '.myqcloud.com'];

function allowed(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch { return false; }
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ detail: 'Méthode refusée.' }, 405);
  try {
    const state = await checkLicense(request.headers.get('X-Yakflow-License'));
    if (!state.valid) return json(state, 403);
    const url = new URL(request.url).searchParams.get('url');
    if (!allowed(url)) return json({ detail: 'Lien média non autorisé.' }, 400);
    let target = url;
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(50_000) });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = new URL(response.headers.get('Location'), target).toString();
        if (!allowed(next)) return json({ detail: 'Redirection média non autorisée.' }, 400);
        target = next;
        continue;
      }
      if (!response.ok) return json({ detail: 'Téléchargement média refusé par la source.' }, response.status);
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    return json({ detail: 'Trop de redirections média.' }, 400);
  } catch (error) {
    console.error('download-media:', error.message);
    return json({ detail: 'Téléchargement média indisponible.' }, 502);
  }
}
