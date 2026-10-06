import { checkLicense } from '../lib/firebase.mjs';
import { json } from '../lib/http.mjs';

const PATHS = new Map([
  ['POST /v1/images/generations', true],
  ['POST /v1/videos', true],
  ['GET /agnesapi', true],
]);

export default async function handler(request) {
  try {
    const state = await checkLicense(request.headers.get('X-Yakflow-License'));
    if (!state.valid) return json(state, 403);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^.*?(?:\/api|\/agnes-api)/, '') || '/';
    if (!PATHS.has(`${request.method} ${path}`)) return json({ detail: 'Opération Agnes non autorisée.' }, 404);
    const key = request.headers.get('Authorization') ?? '';
    if (!/^Bearer\s+\S{8,}$/.test(key)) return json({ detail: 'Clé Agnes manquante.' }, 401);
    let body;
    if (request.method === 'POST') {
      const size = Number(request.headers.get('Content-Length') ?? 0);
      if (size > 5_000_000) return json({ detail: 'Image ou références trop volumineuses pour la version web.' }, 413);
      body = await request.text();
      if (body.length > 5_000_000) return json({ detail: 'Image ou références trop volumineuses pour la version web.' }, 413);
    }
    const upstream = async (origin) => fetch(origin + path + url.search, {
      method: request.method,
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(55_000),
    });
    let response = await upstream('https://apihub.agnes-ai.com');
    if ([404, 405].includes(response.status) && path === '/v1/images/generations') {
      response = await upstream('https://apihub.agnes-ai.cn');
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(response.headers.get('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After') } : {}),
      },
    });
  } catch (error) {
    console.error('agnes-api:', error.message);
    return json({ detail: 'Relais Agnes indisponible ou délai dépassé.' }, 502);
  }
}
