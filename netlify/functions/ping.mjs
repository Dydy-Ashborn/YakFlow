export default function handler() {
  return Response.json({ ok: true, mode: 'cloud' }, { headers: { 'Cache-Control': 'no-store' } });
}
