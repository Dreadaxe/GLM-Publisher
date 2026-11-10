/**
 * GLM Publisher v0.6 — Fiche éditoriale et Change-log publics.
 * Les données ne proviennent que des onglets du document lu avec
 * PREVIEW_WITHOUT_SUGGESTIONS, puis sont figées dans un snapshot validé.
 */
function glmIsPublicationTab_(title) {
  return /^(fiche\s+(?:de\s+)?publication|publication|fiche\s+[ée]ditoriale)$/i
    .test(String(title || '').trim());
}

function glmKeyName_(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Uniquement les champs explicitement approuvés par l'éditeur. */
function glmReadMetadata_(tabs, source) {
  const entry = (tabs || []).find(t => glmIsPublicationTab_(t.title));
  if (!entry) return {data:{}, warnings:[], tabFound:false};
  const tab = findTab_(source.tabs || [], entry.id);
  if (!tab || !tab.documentTab || !tab.documentTab.body)
    return {data:{}, warnings:['Onglet Fiche de publication illisible.'], tabFound:true};
  const text = blocksText_(tab.documentTab.body.content || []).slice(0,18000);
  const mapping = {
    accroche:'description', presentation:'description', resume:'description',
    auteur:'author', auteurs:'author', auteuroriginal:'author',
    traduction:'translation', traducteur:'translation', traducteurs:'translation',
    correction:'correction', corrections:'correction', relecture:'correction',
    miseenpage:'layout', niveau:'level', version:'version',
    source:'source', sourceoriginale:'source',
    sourceurl:'sourceUrl', liensource:'sourceUrl',
    pdfvf:'pdfFr', pdffr:'pdfFr', pdffrancais:'pdfFr',
    pdfvo:'pdfOriginal', pdforiginal:'pdfOriginal',
    imageapercu:'previewImage', apercupdf:'previewImage', vignette:'previewImage',
    lienimage:'previewImage',
    discord:'discord', discordglm:'discord',
    avertissement:'notice', mentions:'notice', licence:'notice',
    lienpdfvf:'pdfFr', lienpdfvo:'pdfOriginal'
  };
  const linkKeys = new Set(['sourceUrl','pdfFr','pdfOriginal','previewImage','discord']);
  const data = {};
  const warnings = [];
  text.split(/\r?\n/).forEach(line => {
    const m = /^\s*([^:|]{2,70})\s*(?::|\|)\s*(.*?)\s*$/.exec(line);
    if (!m) return;
    const field = mapping[glmKeyName_(m[1])];
    if (!field || !m[2]) return;
    const value = m[2].trim().slice(0,field === 'description' || field === 'notice' ? 1200 : 500);
    if (linkKeys.has(field)) {
      if (!/^https:\/\//i.test(value) || !safeHref_(value)) {
        warnings.push('Lien HTTPS non valide dans « '+m[1].trim()+' ».');
        return;
      }
    }
    if (field === 'previewImage' && !/^https:\/\//i.test(value)) return;
    data[field] = value;
  });
  return {data, warnings, tabFound:true};
}
function glmSame_(a,b) { return JSON.stringify(a || {}) === JSON.stringify(b || {}); }
function glmChoice_(previous, latest, action, label) {
  if (action === 'keep') return previous;
  if (action === 'remove') return typeof latest === 'string' ? '' : {};
  if (action === 'update') {
    if (!latest || (typeof latest === 'string' ? !latest.trim() : !Object.keys(latest).length))
      throw new Error('Aucun contenu à publier pour '+label+'.');
    return latest;
  }
  throw new Error('Choix de publication invalide pour '+label+'.');
}

function glmPublicMetaHtml_(meta) {
  meta = meta || {};
  if (!Object.keys(meta).length) return '';
  const esc = escapeHtml_;
  const fields = [
    ['author','Auteur'],['translation','Traduction'],
    ['correction','Correction / relecture'],['layout','Mise en page'],
    ['source','Source'],['level','Niveau'],['version','Version']
  ];
  const items = fields.filter(([key])=>meta[key]).map(([key,label])=>
    '<dt>'+esc(label)+'</dt><dd>'+esc(meta[key])+'</dd>').join('');
  const links = [
    ['pdfFr','PDF VF'],['pdfOriginal','PDF VO'],['sourceUrl','Source originale'],
    ['discord','Discord GLM']
  ].filter(([key])=>meta[key] && /^https:\/\//i.test(meta[key]))
    .map(([key,label])=>'<a href="'+esc(meta[key])+'" rel="noopener noreferrer" target="_blank">'+esc(label)+'</a>');
  const image = meta.previewImage && /^https:\/\//i.test(meta.previewImage)
    ? '<a class="glm-cover" href="'+esc(meta.pdfFr || meta.pdfOriginal || meta.previewImage)+
      '" target="_blank" rel="noopener noreferrer"><img loading="lazy" alt="Aperçu du PDF" src="'+
      esc(meta.previewImage)+'"></a>' : '';
  const description = meta.description ? '<p class="glm-description">'+esc(meta.description)+'</p>' : '';
  const notice = meta.notice ? '<p class="glm-notice">'+esc(meta.notice)+'</p>' : '';
  return '<section class="glm-publication" aria-label="Présentation de la publication">'+
    '<div class="glm-publication-details">'+description+
    (items?'<dl class="glm-credits">'+items+'</dl>':'')+
    (links.length?'<nav class="glm-downloads" aria-label="Liens de la publication">'+links.join('')+'</nav>':'')+
    notice+'</div>'+image+'</section>';
}

function glmPublicChangelogHtml_(text) {
  text = String(text || '').trim();
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    .filter((s,i)=> !(i===0 && /^change[\s-]?log$/i.test(s))).slice(0,150);
  if (!lines.length) return '';
  return '<details class="glm-section glm-changelog"><summary>Change-log</summary>'+
    '<div class="glm-content"><ul class="glm-change-list">'+lines.map(s=>
    '<li>'+escapeHtml_(s)+'</li>').join('')+'</ul></div></details>';
}
