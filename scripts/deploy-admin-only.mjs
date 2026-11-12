/**
 * Déployer uniquement le panneau d'administration existant.
 * Ne touche ni à la version Web publique, ni à Google Sheets.
 */
import {execFileSync} from 'node:child_process';

function clasp(args){
  return execFileSync('clasp',args,{encoding:'utf8',timeout:120000}).trim();
}
function getAdminDeployment(){
  const lines=clasp(['list-deployments']).split(/\r?\n/);
  const found=lines.map(line=>line.match(/^\s*-\s+(\S+)\s+@(\d+)\s+-\s+(GLM Administration v0\.6(?:\s+.*)?)\s*$/i))
    .filter(Boolean).map(m=>({id:m[1],version:m[2],label:m[3]}));
  if(found.length!==1) throw new Error('Déploiement Administration existant introuvable ou ambigu : aucun déploiement ne sera modifié.');
  return found[0];
}
const admin=getAdminDeployment();
console.log('Panneau Administration identifié avec certitude. Le déploiement Public sera conservé.');
const versionOutput=clasp(['create-version','GLM Publisher v0.6 — lien public mémorisé et copie compacte']);
const match=versionOutput.match(/Created version\s+(\d+)/i);
if(!match) throw new Error('Version créée, mais numéro non confirmé : '+versionOutput);
const version=match[1];
console.log('Nouvelle version immuable : '+version);
clasp(['update-deployment',admin.id,'--versionNumber',version,'--description','GLM Administration v0.6 (liens publics)']);
console.log('Commande de déploiement Administration acceptée, identifiant et URL inchangés.');
for(let attempt=0;attempt<4;attempt++){
  if(attempt) await new Promise(resolve=>setTimeout(resolve,1000));
  const current=getAdminDeployment();
  if(current.id===admin.id && current.version===version) {
    console.log('Vérification finale OK : GLM Administration utilise la version '+version+'.');
    process.exit(0);
  }
}
throw new Error('Vérification finale non confirmée. Consulter Apps Script avant toute nouvelle publication.');
