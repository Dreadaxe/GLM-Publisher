import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';

// Exécuter les fonctions pures avec des services Google simulés.
const publication=createContext({
  findTab_:(tabs,id)=>tabs.find(t=>t.tabProperties.tabId===id),
  blocksText_:(rows)=>rows.map(x=>x.paragraph?.elements?.map(e=>e.textRun?.content||'').join('')||'').join('\n'),
  safeHref_:v=>/^https:\/\//.test(v)?v:'',
  escapeHtml_:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
});
runInContext(readFileSync('Publication.gs','utf8'),publication);
const mockLines=[
  'Auteur : Tuomas Pirinen','Traduction : La Grande Librairie','PDF VF : https://example.org/vf.pdf',
  'Image aperçu : https://example.org/cover.png','Discord : javascript:alert(1)',
  'Présentation : Les règles de la bande.'
];
const tabs=[{id:'t.0',title:'VF'},{id:'t.1',title:'Fiche de publication'}];
const source={tabs:[{tabProperties:{tabId:'t.1'},documentTab:{body:{content:mockLines.map(s=>
  ({paragraph:{elements:[{textRun:{content:s}}]}}))}}}]};
const meta=runInContext('glmReadMetadata_(tabs,source)',Object.assign(publication,{tabs,source}));
assert.equal(meta.data.author,'Tuomas Pirinen');
assert.equal(meta.data.pdfFr,'https://example.org/vf.pdf');
assert.ok(!meta.data.discord,'Lien dangereux exclu');
assert.ok(meta.warnings.length,'Avertissement lien dangereux');
const block=publication.glmPublicMetaHtml_({author:'<script>alert(1)</script>',pdfFr:'https://example.org/vf.pdf'});
assert.ok(!block.includes('<script>'),'Échappement requis');
assert.ok(block.includes('&lt;script&gt;'));
const changelog=publication.glmPublicChangelogHtml_('Change-Log\nV1 : traduction\nV2 : correction');
assert.ok(changelog.includes('V1 : traduction'));
assert.ok(!changelog.includes('<li>Change-Log</li>'));
assert.equal(publication.glmChoice_({author:'Old'},{author:'New'},'keep','fiche').author,'Old');
assert.equal(publication.glmChoice_({author:'Old'},{author:'New'},'update','fiche').author,'New');

const rows=[
 ['Key','Version','SectionId','Titre','Bloc','Texte'],
 ['cavalcade-maudite','old','intro','Lore',0,'Armes obscures anciennes'],
 ['cavalcade-maudite','current','intro','Lore',0,'Armes obscures publiées'],
 ['brouillon-prive','draft','secret','Brouillon',0,'Armes privées non publiées']
];
const sheet={
 getLastRow:()=>rows.length,
 getRange:(start,col,count,width)=>({
  getValues:()=>rows.slice(start-1,start-1+count).map(r=>r.slice(col-1,col-1+width)),
  setValues:vals=>{for(let i=0;i<vals.length;i++)rows[start-1+i]=vals[i];}
 }),
 deleteRow:index=>rows.splice(index-1,1)
};
const search=createContext({
 ensureSheet_:()=>sheet,getBook_:()=>({getSheetByName:()=>sheet}),
 plainDocRows_:()=>[
  {key:'cavalcade-maudite',version:'current',title:'Cavalcade Maudite',siteUrl:''},
  {key:'brouillon-prive',version:'',title:'Brouillon',siteUrl:''}
 ],
 assertKey_:()=>{},
 escapeHtml_:publication.escapeHtml_,
 ScriptApp:{getService:()=>({getUrl:()=> 'https://script.google.com/macros/s/EXAMPLE/exec'})}
});
runInContext(readFileSync('Search.gs','utf8'),search);
let found=search.glmSearchPublic_('armes');
assert.equal(found.length,1,'Seul le texte publié de la version active doit apparaître');
assert.ok(found[0].excerpt.includes('publiées'));
assert.ok(!JSON.stringify(found).includes('privées'));
const snapshot={sections:[{id:'intro',title:'Lore',text:'Nouvelle règle : queue préhensile.'}]};
assert.equal(search.glmRefreshIndex_('cavalcade-maudite','new',snapshot),1);
assert.equal(rows.filter(r=>r[0]==='cavalcade-maudite').length,1);
assert.equal(rows.find(r=>r[0]==='cavalcade-maudite')[1],'new');
console.log('OK : fiche, liens, XSS, changelog, restauration de choix et recherche sur snapshots publiés.');
