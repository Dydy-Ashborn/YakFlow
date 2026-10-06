import { checkLicense } from '../lib/firebase.mjs';
import { json, smallJson } from '../lib/http.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ valid: false, message: 'Méthode refusée.' }, 405);
  try {
    const body = await smallJson(request);
    const state = await checkLicense(body.code);
    return json(state, state.valid ? 200 : 403);
  } catch (error) {
    console.error('verify-license:', error.message);
    return json({ valid: false, message: 'Vérification momentanément indisponible.' }, 503);
  }
}
