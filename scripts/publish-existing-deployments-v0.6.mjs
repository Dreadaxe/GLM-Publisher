/**
 * Publication contrôlée de GLM Publisher v0.6 sur ses DEUX déploiements existants.
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

const sourceFile = fs.existsSync('.clasp-stage/Code.js') ? '.clasp-stage/Code.js' : '.clasp-stage/Code.gs';
const source = fs.readFileSync(sourceFile,'utf8');
if (!source.includes('GLM Publisher v0.6') || !source.includes('UnifrakturMaguntia')) {
  throw new Error('Publication interrompue : le brouillon Apps Script ne correspond pas à GLM Publisher v0.6.');
}
// Lire la configuration effective des applications web plutôt que se fier aux
// descriptions libres, parfois vides dans Apps Script.
async function getDeployments() {
  const path = new URL('.clasprc.json', 'file://' + process.env.HOME + '/');
  const auth = JSON.parse(fs.readFileSync(path, 'utf8'));
  const token = auth.tokens?.default || auth;
  if (!token?.refresh_token || !token.client_id || !token.client_secret) {
    throw new Error('Impossible de retrouver les identifiants OAuth clasp.');
  }
  const refreshed = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type:'refresh_token',
      refresh_token:token.refresh_token,
      client_id:token.client_id,
      client_secret:token.client_secret
    })
  });
  if (!refreshed.ok) throw new Error('Impossible de rafraîchir OAuth : statut '+refreshed.status);
  const {access_token} = await refreshed.json();
  if (!access_token) throw new Error('Jeton OAuth non reçu.');
  const scriptId = process.env.GLM_SCRIPT_ID;
  if (!scriptId) throw new Error('GLM_SCRIPT_ID absent.');
  const response = await fetch('https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId)+'/deployments?pageSize=100', {
    headers:{Authorization:'Bearer '+access_token}
  });
  if (!response.ok) throw new Error('Lecture de la configuration des déploiements refusée : statut '+response.status);
  const data = await response.json();
  if (data.nextPageToken) throw new Error('Inventaire incomplet : pagination à gérer avant publication.');
  return data.deployments || [];
}
const entries = await getDeployments();
function webConfig(d) {
  return d.entryPoints?.find(p=>p.entryPointType==='WEB_APP')?.webApp?.entryPointConfig || {};
}
console.log('Inventaire des applications (sans URL ni identifiants) : '+JSON.stringify(entries.map(d=>({
  version:d.deploymentConfig?.versionNumber,
  description:d.deploymentConfig?.description || '(aucune)',
  executeAs:webConfig(d).executeAs || '(inconnu)',
  access:webConfig(d).access || '(inconnu)'
}))));
function findRole(label, candidates, namePattern) {
  if (candidates.length === 1) return candidates[0];
  const named = candidates.filter(d=>namePattern.test(d.deploymentConfig?.description || ''));
  if (named.length === 1) return named[0];
  throw new Error('Publication interrompue : rôle '+label+' ambigu ('+candidates.length+' déploiements correspondants).');
}
const publi = findRole('public',
  entries.filter(d=>webConfig(d).executeAs==='USER_DEPLOYING' &&
    ['ANYONE', 'ANYONE_ANONYMOUS'].includes(webConfig(d).access)),
  /\\bpublic\\b/i);
const admin = findRole('administration',
  entries.filter(d=>webConfig(d).executeAs==='USER_ACCESSING'),
  /\\b(?:administration|admin)\\b/i);
if (!publi.deploymentId || !admin.deploymentId || publi.deploymentId===admin.deploymentId)
  throw new Error('Déploiements public et administration non distincts : publication bloquée.');
// Adaptation au format attendu par le contrôle final historique.
publi.id=publi.deploymentId;
admin.id=admin.deploymentId;
console.log('Deux déploiements distincts identifiés : GLM Public et GLM Administration.');
console.log('Création d’une version immuable du brouillon v0.6.');
const versionResult = clasp(['create-version','GLM Publisher v0.6 - rendu GLM']);
const match = versionResult.match(/Created version\s+(\d+)/i);
if (!match) throw new Error('Version créée, mais numéro impossible à confirmer : ' + versionResult);
const n = match[1];
console.log('Version Apps Script créée : ' + n);

for (const [name, target] of [['GLM Administration',admin], ['GLM Public',publi]]) {
  clasp(['update-deployment',target.id,'--versionNumber',n,'--description',name + ' v0.6']);
  console.log(name + ' actualisé vers v0.6 sans changer son identifiant de déploiement.');
}
const updated = listDeployments(clasp(['list-deployments']));
for (const [name, target] of [['GLM Administration',admin], ['GLM Public',publi]]) {
  if (!updated.some(x => x.id === target.id && x.version === n)) throw new Error('Contrôle final échoué pour '+name);
}
console.log('Vérification finale OK : les deux déploiements existants utilisent la même version '+n+'.');
