export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function smallJson(request, max = 8192) {
  const raw = await request.text();
  if (raw.length > max) throw new Error('Requête trop volumineuse.');
  return JSON.parse(raw);
}
