import test from 'node:test';
import assert from 'node:assert/strict';
import { codeId, licenseState, newCode, normalizeCode } from '../netlify/lib/license-core.mjs';

test('un code généré a le format attendu et ne révèle aucune donnée du client', () => {
  const code = newCode();
  assert.match(code, /^YKF(?:-[A-HJ-NP-Z2-9]{5}){4}$/);
  assert.equal(normalizeCode(code).length, 23);
  assert.equal(codeId(code), codeId(code.toLowerCase().replaceAll('-', '')));
  assert.notEqual(newCode(), code);
});

test('un essai expire et un code désactivé est refusé', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  const trial = { type: 'trial', active: true, expiresAt: '2026-10-07T12:00:00Z' };
  assert.equal(licenseState(trial, now).valid, true);
  assert.equal(licenseState(trial, now + 86400000).valid, false);
  assert.equal(licenseState({ type: 'premium', active: false, expiresAt: null }, now).valid, false);
  assert.equal(licenseState({ type: 'premium', active: true, expiresAt: null }, now).valid, true);
});
