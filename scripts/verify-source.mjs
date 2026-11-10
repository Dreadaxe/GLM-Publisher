// Validation statique de tous les modules Apps Script, sans accès Google.
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const codeFiles=['Code.gs','Publication.gs','Search.gs'];
const sources={};
for(const file of codeFiles){
  const code=readFileSync(file,'utf8');
  new Script(code,{filename:file});
  sources[file]=code;
}
const admin=readFileSync('Admin.html','utf8');
const htmlScript=admin.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(htmlScript,'Admin.html : script manquant');
new Script(htmlScript[1],{filename:'Admin.html:script'});
const manifest=JSON.parse(readFileSync('appsscript.json','utf8'));
assert.equal(manifest.runtimeVersion,'V8');
assert.ok(manifest.oauthScopes?.includes('https://www.googleapis.com/auth/spreadsheets'));
assert.ok(manifest.dependencies?.enabledAdvancedServices?.some(s=>s.userSymbol==='Docs'));
assert.match(sources['Code.gs'],/function\s+installerGLM\s*\(/);
assert.match(sources['Code.gs'],/function\s+doGet\s*\(/);
assert.match(sources['Code.gs'],/glmPublicMetaHtml_\(snapshot\.metadata\)/);
assert.match(sources['Code.gs'],/glmPublicChangelogHtml_\(snapshot\.changelog\)/);
assert.match(sources['Code.gs'],/glmRefreshIndex_\(row\.key,ver,snapshot\)/);
assert.match(sources['Search.gs'],/function\s+glmSearchPublic_\s*\(/);
assert.match(admin,/id="metaAction"/);
assert.match(admin,/id="changelogAction"/);
console.log('OK : JavaScript, HTML, manifeste et connexions de la v0.6 vérifiés.');
