/**
 * GLM Publisher v0.6 — Index public, basé EXCLUSIVEMENT sur les snapshots.
 * Aucune lecture Google Docs pendant une recherche visiteur.
 */
function glmIndexSheet_() {
  const sheet=ensureSheet_(getBook_(), 'SearchIndex',
    ['Key','Version','SectionId','Titre','Bloc','Texte']);
  return sheet;
}
function glmRefreshIndex_(key,version,snapshot) {
  assertKey_(key);
  const sheet=glmIndexSheet_();
  // On remplace uniquement les lignes de cette page, jamais celles des autres.
  const last=sheet.getLastRow();
  if (last > 1) {
    const keys=sheet.getRange(2,1,last-1,1).getValues();
    for(let i=keys.length-1;i>=0;i--) if(String(keys[i][0])===key)sheet.deleteRow(i+2);
  }
  const entries=[];
  (snapshot.sections||[]).forEach(section=>{
    const body=String(section.text || '').slice(0,350000);
    if(!body.trim())return;
    const id=String(section.id||'').slice(0,120);
    const title=String(section.title||'').slice(0,300);
    for(let i=0;i<body.length;i+=10000)entries.push([
      key,version,id,title,Math.floor(i/10000),body.slice(i,i+10000)
    ]);
  });
  if(snapshot.metadata && Object.keys(snapshot.metadata).length) {
    const m=snapshot.metadata;
    const extra=[m.author,m.translation,m.correction,m.source,m.description,m.level]
      .filter(Boolean).join(' · ');
    if(extra.trim())entries.push([key,version,'publication','Présentation',0,extra.slice(0,15000)]);
  }
  if(snapshot.changelog && String(snapshot.changelog).trim())
    entries.push([key,version,'change-log','Change-log',0,String(snapshot.changelog).slice(0,20000)]);
  if(entries.length>250) throw new Error('Index trop volumineux pour cette publication.');
  if(entries.length)
    sheet.getRange(sheet.getLastRow()+1,1,entries.length,6).setValues(entries);
  return entries.length;
}
/** Permet d'indexer les anciennes versions v0.5, sans les republier. */
function adminRebuildSearchIndex(key) {
  assertAdmin_();
  assertKey_(key);
  const row=docRow_(key);
  if(!row.version)throw new Error('Aucune version publique à indexer.');
  const snapshot=loadPublished_(key);
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try {return {key,entries:glmRefreshIndex_(key,row.version,snapshot)};}
  finally {lock.releaseLock();}
}
function glmPlain_(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function glmSearchPublic_(raw) {
  const query=String(raw||'').trim().slice(0,90);
  if(query.length<2)return [];
  // Sélectionner SEULEMENT les versions effectivement publiées dans Documents.
  const current={};
  plainDocRows_().forEach(d=>{if(d.version)current[d.key]=d;});
  const index=getBook_().getSheetByName('SearchIndex');
  if(!index || index.getLastRow()<2)return [];
  const needle=glmPlain_(query);
  const list=index.getRange(2,1,index.getLastRow()-1,6).getValues();
  const results=[];
  const seen=new Set();
  for(const row of list) {
    const key=String(row[0]||'');
    const active=current[key];
    if(!active || String(row[1])!==active.version)continue;
    const id=String(row[2]||'');
    const title=String(row[3]||'');
    const text=String(row[5]||'');
    const hit=glmPlain_(title).includes(needle) ? 0 : glmPlain_(text).indexOf(needle);
    if(hit<0)continue;
    const identity=key+':'+id;
    if(seen.has(identity))continue;
    seen.add(identity);
    const center=hit===0 ? 0 : hit;
    const excerpt=text.slice(Math.max(0,center-80),Math.max(0,center-80)+230);
    results.push({key,docTitle:active.title,sectionId:id,
      sectionTitle:title,excerpt:(center>80?'…':'')+excerpt+(text.length>center+150?'…':''),
      siteUrl:active.siteUrl});
    if(results.length>=50)break;
  }
  return results;
}
function glmSearchHtml_(query) {
  const esc=escapeHtml_;
  const q=String(query||'').trim().slice(0,90);
  const results=q.length>=2?glmSearchPublic_(q):[];
  // URL renvoyée par l'application publiée (on ne révèle pas l'URL du panneau privé).
  const service=String(ScriptApp.getService().getUrl()||'');
  const base=/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec/.test(service)?service:'';
  let items='';
  if(q.length>=2 && !results.length)items='<p>Aucun résultat parmi les textes publiés et indexés.</p>';
  for(const r of results) {
    const page=base+'?page='+encodeURIComponent(r.key);
    const link=r.siteUrl && /^https:\/\//i.test(r.siteUrl) ? r.siteUrl : page;
    items+='<li><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"><strong>'+
      esc(r.docTitle)+'</strong> — '+esc(r.sectionTitle)+'</a>'+
      '<p>'+esc(r.excerpt)+'</p></li>';
  }
  const action=base||'';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Recherche des publications GLM</title>'+
    '<style>body{font:16px/1.55 Georgia,serif;margin:0;color:#171717}main{max-width:850px;margin:0 auto;padding:24px}form{display:flex;gap:8px}input{min-width:0;flex:1;padding:12px;border:1px solid #bbb}button{padding:12px;background:#2a211c;color:#fff;border:0;cursor:pointer}li{margin:1.4rem 0}li p{margin:.3rem 0;color:#444}a{color:#7c332a}</style>'+
    '</head><body><main><h1>Rechercher dans les traductions publiées</h1>'+
    '<form method="get" action="'+esc(action)+'"><input type="hidden" name="search" value="1">'+
    '<input name="q" maxlength="90" value="'+esc(q)+'" placeholder="Mot ou expression" aria-label="Recherche">'+
    '<button type="submit">Rechercher</button></form>'+
    (q.length>=2?'<p>'+results.length+' résultat(s) affiché(s) (maximum 50).</p>':'')+
    '<ul>'+items+'</ul><small>Seules les versions validées et indexées sont recherchées. Les commentaires et suggestions Google Docs ne sont jamais indexés.</small>'+
    '</main></body></html>';
}
