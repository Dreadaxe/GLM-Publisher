// Vérification statique hors ligne : aucun accès au compte Google.
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const code = readFileSync('Code.gs', 'utf8');
const admin = readFileSync('Admin.html', 'utf8');
const manifest = JSON.parse(readFileSync('appsscript.json', 'utf8'));

new Script(code, { filename: 'Code.gs' });
assert.match(code, /function\s+doGet\s*\(/, 'doGet absent');
assert.match(code, /function\s+installerGLM\s*\(/, 'installerGLM absent');
assert.match(admin, /<!doctype html>/i, 'Admin.html absent ou incomplet');
assert.equal(manifest.runtimeVersion, 'V8', 'Runtime V8 attendu');
assert.ok(Array.isArray(manifest.oauthScopes), 'Scopes Google manquants');
assert.ok(
  manifest.dependencies?.enabledAdvancedServices?.some((service) => service.userSymbol === 'Docs' && service.version === 'v1'),
  'Service avancé Google Docs v1 absent'
);
console.log('GLM Publisher : syntaxe JS, fichiers et manifeste OK.');
