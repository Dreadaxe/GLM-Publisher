/**
 * Publication contrôlée de GLM Publisher v0.5 sur ses DEUX déploiements existants.
 * Échoue sans mutation si les descriptions ne permettent pas d'identifier
 * exactement un déploiement public et un déploiement administration.
 * Les identifiants de déploiement ne sont jamais committés ni loggés.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function clasp(args) {
  return execFileSync('clasp', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  }).trim();
}
function listDeployments(output) {
  return output.split(/\r?\n/)
    .map(line => line.match(/^\s*-\s+(\S+)\s+@(\w+)(?:\s+-\s+(.+))?\s*$/))
    .filter(Boolean)
    .map(m => ({ id: m[1], version: m[2], description: (m[3] || '').trim() }));
}
function findOne(list, test, description) {
  const candidates = list.filter(d => d.version !== 'HEAD' && /glm/i.test(d.description) && test.test(d.description));
  if (candidates.length !== 1) {
    throw new Error('Publication arrêtée : ' + description + ' introuvable ou ambigu (' + candidates.length + '). Vérifier les descriptions depuis Apps Script.');
  }
  return candidates[0];
}

const source = fs.readFileSync('.clasp-stage/Code.gs','utf8');
if (!source.includes('GLM Publisher v0.5') || !source.includes('UnifrakturMaguntia')) {
  throw new Error('Publication interrompue : le brouillon Apps Script ne correspond pas à GLM Publisher v0.5.');
}
const list = listDeployments(clasp(['list-deployments']));
const publi = findOne(list, /\bpublic\b/i, 'GLM Public');
const admin = findOne(list, /\b(?:administration|admin)\b/i, 'GLM Administration');
if (publi.id === admin.id) throw new Error('Déploiements identiques : opération interrompue.');
console.log('Deux déploiements distincts identifiés : GLM Public et GLM Administration.');
console.log('Création d’une version immuable du brouillon v0.5.');
const versionResult = clasp(['create-version','GLM Publisher v0.5 - rendu GLM']);
const match = versionResult.match(/Created version\s+(\d+)/i);
if (!match) throw new Error('Version créée, mais numéro impossible à confirmer : ' + versionResult);
const n = match[1];
console.log('Version Apps Script créée : ' + n);

for (const [name, target] of [['GLM Administration',admin], ['GLM Public',publi]]) {
  clasp(['update-deployment',target.id,'--versionNumber',n,'--description',name + ' v0.5']);
  console.log(name + ' actualisé vers v0.5 sans changer son identifiant de déploiement.');
}
const updated = listDeployments(clasp(['list-deployments']));
for (const [name, target] of [['GLM Administration',admin], ['GLM Public',publi]]) {
  if (!updated.some(x => x.id === target.id && x.version === n)) throw new Error('Contrôle final échoué pour '+name);
}
console.log('Vérification finale OK : les deux déploiements existants utilisent la même version '+n+'.');
