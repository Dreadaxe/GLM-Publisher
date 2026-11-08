/**
 * GLM Publisher v0.5 — La Grande Librairie de Mordheim.
 * Google Docs (sources) -> validation explicite -> snapshots Sheets -> Google Sites (iframe).
 * Le contenu des Google Docs n'est JAMAIS rendu public avant publication.
 *
 * Installation : exécuter installerGLM() une fois depuis l'éditeur Apps Script.
 * Ne jamais déployer l'interface d'administration « exécuter en tant que moi ».
 */
const GLM_ = Object.freeze({
  PROP_SHEET: 'GLM_SPREADSHEET_ID',
  PROP_ADMINS: 'GLM_ADMIN_EMAILS',
  DOCUMENTS: 'Documents',
  VERSIONS: 'Versions',
  CHUNKS: 'Chunks',
  CHUNK_SIZE: 30000,
  MAX_PAGES: 60
});

/** Fonction visible dans le menu Exécuter de l’éditeur Apps Script. */
function installerGLM() {
  setupPublisher_();
}

/** Fonction d’installation interne (inaccessible depuis google.script.run). */
function setupPublisher_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(GLM_.PROP_SHEET);
  let spreadsheet;
  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    spreadsheet = SpreadsheetApp.create('GLM Publisher — registre et versions');
    props.setProperty(GLM_.PROP_SHEET, spreadsheet.getId());
  }
  ensureSheet_(spreadsheet, GLM_.DOCUMENTS,
    ['Key', 'DocId', 'TabId', 'SiteUrl', 'Title', 'PublishedVersion', 'LastPublishedUTC']);
  ensureSheet_(spreadsheet, GLM_.VERSIONS,
    ['Key', 'Version', 'TimestampUTC', 'EditorEmail', 'Summary', 'DigestSHA256']);
  ensureSheet_(spreadsheet, GLM_.CHUNKS, ['Key', 'Version', 'Part', 'Base64']);
  const owner = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!owner) throw new Error('Impossible de lire l’adresse du propriétaire. Configure GLM_ADMIN_EMAILS dans les propriétés du script.');
  const previous = (props.getProperty(GLM_.PROP_ADMINS) || '').split(',').map(x => x.trim()).filter(Boolean);
  props.setProperty(GLM_.PROP_ADMINS, Array.from(new Set(previous.concat([owner]))).join(','));
  Logger.log('Registre : ' + spreadsheet.getUrl());
  Logger.log('Administrateur initial : ' + owner);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

/** Les deux déploiements partagent la même logique, mais pas les autorisations. */
function doGet(e) {
  const query = (e && e.parameter) || {};
  if (query.admin === '1') {
    try {
      assertAdmin_();
      return HtmlService.createHtmlOutputFromFile('Admin').setTitle('GLM Publisher — Administration');
    } catch (err) {
      return HtmlService.createHtmlOutput('<p>Accès administrateur refusé. Ouvrir le déploiement privé et autoriser votre compte Google.</p>');
    }
  }
  const key = String(query.page || '');
  let snapshot = null;
  try { if (validKey_(key)) snapshot = loadPublished_(key); } catch (err) {
    return HtmlService.createHtmlOutput('<p>Publication temporairement indisponible.</p>');
  }
  // Uniquement la vue publique est autorisée en iframe. Aucun bouton d'écriture.
  return HtmlService.createHtmlOutput(renderPublicHtml_(snapshot))
    .setTitle(snapshot ? snapshot.title : 'GLM — Publication')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function assertAdmin_() {
  // NE PAS remplacer getActiveUser() par getEffectiveUser().
  // Dans le déploiement public « en tant que moi », effectiveUser est le propriétaire.
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const executor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  // Si une Web App est exécutée comme son propriétaire (déploiement public),
  // les méthodes d'administration ne doivent pas opérer avec ses privilèges.
  if (!email || email !== executor) throw new Error('Administration réservée au déploiement exécuté comme utilisateur.');
  const allowed = String(PropertiesService.getScriptProperties().getProperty(GLM_.PROP_ADMINS) || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!email || allowed.indexOf(email) === -1) throw new Error('Utilisateur non autorisé.');
  return email;
}

function validKey_(value) { return /^[a-z0-9][a-z0-9-]{1,63}$/.test(value || ''); }
function assertKey_(value) { if (!validKey_(value)) throw new Error('Identifiant invalide : utiliser 2 à 64 caractères minuscules, chiffres ou tirets.'); }
function getBook_() {
  const id = PropertiesService.getScriptProperties().getProperty(GLM_.PROP_SHEET);
  if (!id) throw new Error('Installation manquante : exécutez installerGLM depuis Apps Script.');
  return SpreadsheetApp.openById(id);
}
function rows_(sheetName) {
  const sheet = getBook_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}
function docRow_(key) {
  const sheet = getBook_().getSheetByName(GLM_.DOCUMENTS);
  const values = rows_(GLM_.DOCUMENTS);
  const idx = values.findIndex(r => String(r[0]) === key);
  if (idx < 0) throw new Error('Document inconnu : ' + key);
  return { sheet, rowNum: idx + 2, key: String(values[idx][0]), docId: String(values[idx][1]),
    tabId: String(values[idx][2] || ''), siteUrl: String(values[idx][3] || ''),
    title: String(values[idx][4] || ''), version: String(values[idx][5] || ''),
    publishedAt: String(values[idx][6] || '') };
}
function plainDocRows_() {
  return rows_(GLM_.DOCUMENTS).map(r => ({key: String(r[0]), docId: String(r[1]),
    tabId: String(r[2] || ''), siteUrl: String(r[3] || ''), title: String(r[4] || ''),
    version: String(r[5] || ''), publishedAt: String(r[6] || '')}));
}

/** API administration : chacune de ces fonctions VERIFIE l'identité au serveur. */
function adminListDocuments() {
  assertAdmin_();
  return {documents: plainDocRows_(), spreadsheetUrl: getBook_().getUrl()};
}

function docIdFromUrl_(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/\/document\/d\/([A-Za-z0-9_-]{20,})/) || raw.match(/^([A-Za-z0-9_-]{20,})$/);
  if (!match) throw new Error('Coller une URL Google Docs ou son identifiant valide.');
  return match[1];
}

function adminAddDocument(params) {
  assertAdmin_();
  params = params || {};
  const key = String(params.key || '').trim().toLowerCase();
  assertKey_(key);
  const docId = docIdFromUrl_(params.url);
  const tabFromUrl = String(params.url || '').match(/[?&#]tab=([^&#]+)/);
  const tabId = String(params.tabId || (tabFromUrl ? decodeURIComponent(tabFromUrl[1]) : '')).trim();
  const siteUrl = String(params.siteUrl || '').trim();
  if (siteUrl && !/^https:\/\//.test(siteUrl)) throw new Error('URL de Google Sites non valide (https requis).');
  const source = Docs.Documents.get(docId, {includeTabsContent: true, suggestionsViewMode: 'PREVIEW_WITHOUT_SUGGESTIONS'});
  const tabs = flattenTabs_(source.tabs || [], 0);
  const chosen = tabId ? tabs.find(t => t.id === tabId) : tabs.find(t => !t.isChangelog);
  if (!chosen) throw new Error('Aucun onglet éditorial lisible dans ce document.');
  if (chosen.isChangelog) throw new Error('Le Change-log ne peut pas être la source publiée.');
  if (plainDocRows_().some(d => d.key === key)) throw new Error('Cet identifiant de page existe déjà.');
  getBook_().getSheetByName(GLM_.DOCUMENTS)
    .appendRow([key, docId, chosen.id, siteUrl, source.title || key, '', '']);
  return adminListDocuments();
}

/** Onglets du document : selection explicite de la source à publier. */
function flattenTabs_(tabs, depth) {
  const flat = [];
  (tabs || []).forEach(tab => {
    const p = tab.tabProperties || {};
    if (tab.documentTab && tab.documentTab.body) flat.push({
      id: String(p.tabId || ''), title: String(p.title || 'Sans titre'), depth: depth || 0,
      isChangelog: isChangeLogTitle_(p.title)
    });
    flat.push.apply(flat, flattenTabs_(tab.childTabs || [], (depth || 0) + 1));
  });
  return flat;
}
function isChangeLogTitle_(name) {
  return /^(?:change[\s_-]?log|historique(?:\s+des)?\s+modifications)$/i.test(String(name || '').trim());
}
function adminListDocumentTabs(key) {
  assertAdmin_();
  assertKey_(key);
  const row = docRow_(key);
  const doc = Docs.Documents.get(row.docId, {includeTabsContent:true, suggestionsViewMode:'PREVIEW_WITHOUT_SUGGESTIONS'});
  const tabs = flattenTabs_(doc.tabs || [], 0);
  const first = tabs.find(t => !t.isChangelog);
  return { tabs, selectedTabId: row.tabId || (first ? first.id : ''),
    isExplicit: !!row.tabId, published: !!row.version };
}
function adminSetPublicationTab(key, tabId) {
  assertAdmin_();
  assertKey_(key);
  const row = docRow_(key);
  const doc = Docs.Documents.get(row.docId, {includeTabsContent:true, suggestionsViewMode:'PREVIEW_WITHOUT_SUGGESTIONS'});
  const tab = flattenTabs_(doc.tabs || [], 0).find(t => t.id === String(tabId || ''));
  if (!tab) throw new Error('Onglet introuvable dans le Google Doc.');
  if (tab.isChangelog) throw new Error('Le Change-log est réservé au suivi : choisissez VF ou un autre onglet éditorial.');
  row.sheet.getRange(row.rowNum, 3).setValue(tab.id);
  return {ok:true, selectedTabId:tab.id, title:tab.title};
}

function adminInspectDocument(key) {
  assertAdmin_();
  assertKey_(key);
  const row = docRow_(key);
  const source = readSource_(row);
  const published = row.version ? loadVersion_(key, row.version) : null;
  const oldById = {};
  (published ? published.sections : []).forEach(s => { oldById[s.id] = s; });
  const allIds = new Set(source.sections.map(s => s.id));
  const sections = source.sections.map(s => {
    const old = oldById[s.id];
    const status = !old ? 'nouvelle' : (old.html === s.html && (old.headingHtml || '') === (s.headingHtml || '') && (old.headingCss || '') === (s.headingCss || '') ? 'identique' : 'modifiée');
    return Object.assign({}, s, {status, oldHtml: old ? old.html : ''});
  });
  const stale = (published ? published.sections : [])
    .filter(s => !allIds.has(s.id))
    .map(s => ({id:s.id, title:s.title, html:'', oldHtml:s.html, order:s.order, issues:[], status:'absente'}));
  return {key, docTitle:source.title, docUrl:'https://docs.google.com/document/d/'+row.docId+'/edit',
    version:row.version, publishedAt:row.publishedAt, fingerprint:source.fingerprint,
    suggestions:source.suggestions, openComments:source.openComments,
    sections: sections.concat(stale), changelog:source.changelog,
    selectedTabId:source.selectedTabId, selectedTabTitle:source.selectedTabTitle};
}

function adminPublishDocument(options) {
  const editor = assertAdmin_();
  options = options || {};
  const key = String(options.key || '');
  assertKey_(key);
  const row = docRow_(key);
  if (row.version !== String(options.expectedVersion || '')) throw new Error('Une publication a eu lieu entre-temps. Réanalysez.');
  // On relit le document : impossible d'injecter du HTML arbitraire depuis le navigateur.
  const source = readSource_(row);
  if (source.fingerprint !== String(options.fingerprint || ''))
    throw new Error('Le Google Doc ou ses commentaires ont changé. Relancez l’analyse.');
  // Les commentaires appartiennent au document de travail. Ils n'empêchent pas de
  // publier un instantané du texte accepté et ne sont jamais exportés ni modifiés.

  const actions = Array.isArray(options.actions) ? options.actions : [];
  if (actions.length === 0) throw new Error('Aucune action sélectionnée.');
  const sourceById = {};
  source.sections.forEach(s => {sourceById[s.id] = s;});
  const previous = row.version ? loadVersion_(key, row.version) : null;
  const map = {};
  (previous ? previous.sections : []).forEach(s => { map[s.id] = s; });
  const touched = new Set();
  let updated = 0, removed = 0;
  actions.forEach(a => {
    const id = String(a && a.id || '');
    const action = String(a && a.action || '');
    if (!id || touched.has(id)) throw new Error('Action dupliquée ou vide.');
    touched.add(id);
    if (action === 'update') {
      if (!sourceById[id]) throw new Error('Section source absente : ' + id);
      if (sourceById[id].issues.length)
        throw new Error('Contenu non pris en charge dans « '+sourceById[id].title+' » : ' + sourceById[id].issues.join('; '));
      map[id] = {id, title:sourceById[id].title, html:sourceById[id].html,
        headingHtml:sourceById[id].headingHtml, headingCss:sourceById[id].headingCss,
        fonts:sourceById[id].fonts, text:sourceById[id].text, order:sourceById[id].order};
      updated++;
    } else if (action === 'remove') {
      if (!map[id]) throw new Error('Impossible de retirer une section qui n’est pas publiée : ' + id);
      delete map[id];
      removed++;
    } else if (action !== 'keep') throw new Error('Action inconnue : ' + action);
  });
  if (!updated && !removed) throw new Error('Sélectionnez au moins une mise à jour ou un retrait.');
  // Reconstituer l'ordre selon le Doc pour les sections encore présentes, puis anciennes sections figées.
  const positions = {};
  source.sections.forEach((s, i) => { positions[s.id] = i; });
  const sections = Object.keys(map).map(id => map[id]);
  sections.sort((a,b) => (positions[a.id] === undefined ? 99999 + a.order : positions[a.id]) -
    (positions[b.id] === undefined ? 99999 + b.order : positions[b.id]));
  sections.forEach((s,i) => {s.order=i;});
  // Le statut éditorial est conservé pour l'audit, sans publier les fils de discussion.
  const next = {title: source.title, key, sections, editorialStatus: {
    openCommentsAtPublication: source.openComments,
    suggestionsAtPublication: source.suggestions
  }};
  const summary = updated + ' section(s) actualisée(s), ' + removed + ' retirée(s)' +
    (source.openComments ? ' ; '+ source.openComments + ' commentaire(s) ouvert(s) conservé(s) dans Google Docs' : '') +
    (source.suggestions ? ' ; '+source.suggestions+' suggestion(s) non acceptée(s) exclue(s)' : '');
  return commit_(row, next, summary, editor);
}

function adminGetHistory(key) {
  assertAdmin_();
  assertKey_(key);
  docRow_(key);
  return rows_(GLM_.VERSIONS).filter(r => String(r[0]) === key).reverse().slice(0, 30)
    .map(r => ({version:String(r[1]), at:String(r[2]), author:String(r[3]), summary:String(r[4])}));
}

function adminRestoreDocument(options) {
  const editor = assertAdmin_();
  options = options || {};
  const key = String(options.key || '');
  assertKey_(key);
  const row = docRow_(key);
  if (row.version !== String(options.expectedVersion || ''))
    throw new Error('Version active modifiée. Actualisez la liste.');
  const version = String(options.version || '');
  const exists = rows_(GLM_.VERSIONS).some(r => String(r[0]) === key && String(r[1]) === version);
  if (!exists) throw new Error('Version historique introuvable.');
  const snapshot = loadVersion_(key, version);
  return commit_(row, snapshot, 'Restauration de ' + version, editor);
}

function commit_(row, snapshot, summary, editor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const current = docRow_(row.key);
    if (current.version !== row.version) throw new Error('Publication concurrente. Relancez une analyse.');
    const ver = new Date().getTime() + '-' + Utilities.getUuid().slice(0,8);
    const now = new Date().toISOString();
    const json = JSON.stringify(snapshot);
    const encoded = Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8);
    const chunks = [];
    for (let pos=0; pos<encoded.length; pos += GLM_.CHUNK_SIZE)
      chunks.push([row.key, ver, chunks.length, encoded.slice(pos,pos+GLM_.CHUNK_SIZE)]);
    const sheet = getBook_().getSheetByName(GLM_.CHUNKS);
    sheet.getRange(sheet.getLastRow()+1, 1, chunks.length, 4).setValues(chunks);
    getBook_().getSheetByName(GLM_.VERSIONS)
      .appendRow([row.key, ver, now, editor, summary, digest_(json)]);
    current.sheet.getRange(current.rowNum, 5, 1, 3)
      .setValues([[snapshot.title, ver, now]]);
    SpreadsheetApp.flush();
    return {ok:true, key:row.key, version:ver, at:now, summary};
  } finally { lock.releaseLock(); }
}

function loadPublished_(key) {
  const match = plainDocRows_().find(d=>d.key===key);
  if (!match || !match.version) return null;
  return loadVersion_(key, match.version);
}
function loadVersion_(key, version) {
  const chunks = rows_(GLM_.CHUNKS)
    .filter(r=>String(r[0])===key && String(r[1])===version)
    .sort((a,b)=>Number(a[2])-Number(b[2]));
  if (!chunks.length) throw new Error('Contenu de la version non trouvé.');
  for (let i=0;i<chunks.length;i++) if (Number(chunks[i][2]) !== i) throw new Error('Version incomplète.');
  const encoded = chunks.map(r=>String(r[3])).join('');
  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString('UTF-8');
  const expected = rows_(GLM_.VERSIONS).find(r=>String(r[0])===key && String(r[1])===version);
  if (!expected || String(expected[5])!==digest_(json)) throw new Error('Empreinte de version incorrecte.');
  return JSON.parse(json);
}
function digest_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8)
    .map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}

/** Lecture de la source avec suggestions non acceptées EXCLUES du HTML. */
function readSource_(row) {
  const options = {includeTabsContent:true, suggestionsViewMode:'PREVIEW_WITHOUT_SUGGESTIONS'};
  const source = Docs.Documents.get(row.docId, options);
  const inline = Docs.Documents.get(row.docId, {includeTabsContent:true, suggestionsViewMode:'SUGGESTIONS_INLINE'});
  const tabs = flattenTabs_(source.tabs || [], 0);
  const firstEditorial = tabs.find(t => !t.isChangelog);
  const selectedId = row.tabId || (firstEditorial && firstEditorial.id);
  const selected = findTab_(source.tabs || [], selectedId);
  if (!selected || !selected.documentTab || !selected.documentTab.body)
    throw new Error('Onglet de publication introuvable. Vérifiez le choix dans le panneau d’administration.');
  if (isChangeLogTitle_(selected.tabProperties && selected.tabProperties.title))
    throw new Error('Le Change-log ne peut pas être publié à la place du contenu VF.');
  const sections = parseSections_(selected.documentTab.body.content || [], selected.documentTab.namedStyles || source.namedStyles);
  if (!sections.length) throw new Error('L’onglet choisi ne contient aucun texte à publier.');
  const inlineSelected = findTab_(inline.tabs || [], selectedId);
  const suggestions = inlineSelected ? countSuggestions_(inlineSelected.documentTab) : countSuggestions_(inline);
  const comments = openComments_(row.docId);
  const changeTabMeta = tabs.find(t => t.isChangelog);
  const changeTab = changeTabMeta ? findTab_(source.tabs || [], changeTabMeta.id) : null;
  const changelogSection = sections.find(s => isChangeLogTitle_(s.title));
  const changelog = changeTab && changeTab.documentTab && changeTab.documentTab.body
    ? blocksText_(changeTab.documentTab.body.content || []).slice(0,8000)
    : changelogSection ? changelogSection.text.slice(0,8000) : '';
  // Une nouvelle discussion ou réponse n'invalide pas une analyse du TEXTE.
  // La vérification avant publication continue de détecter les changements de
  // texte, de styles, de structure et du nombre de suggestions en attente.
  const fingerprint = digest_(JSON.stringify({title:source.title, selectedTabId:selectedId,
    sections:sections.map(s=>[s.id,s.headingHtml,s.headingCss,s.html]), suggestions}));
  return {title:source.title || row.title || row.key, selectedTabId:selectedId,
    selectedTabTitle:String((selected.tabProperties || {}).title || ''), sections, suggestions,
    openComments:comments.ids.length, changelog, fingerprint};
}
function findTab_(tabs, wanted) {
  for (const tab of tabs || []) {
    if (tab.tabProperties && tab.tabProperties.tabId === wanted) return tab;
    const child = findTab_(tab.childTabs || [], wanted);
    if (child) return child;
  }
  return null;
}
function firstTab_(tabs) {
  for (const tab of tabs || []) {
    if (tab.documentTab && tab.documentTab.body) return tab;
    const child = firstTab_(tab.childTabs || []);
    if (child) return child;
  }
  return null;
}
function countSuggestions_(obj) {
  const ids = new Set();
  let anonymous = 0;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(key => {
      const v = value[key];
      if (/^suggested.*Ids$/.test(key) && Array.isArray(v)) v.forEach(id=>ids.add(String(id)));
      else if (/^suggested.*Changes$/.test(key) && v && typeof v==='object')
        Object.keys(v).forEach(id=>ids.add(String(id)));
      else if (/^suggested[A-Z]/.test(key) && v && !Array.isArray(v) && typeof v==='object') {
        // Les propriétés comme suggestedDocumentStyle peuvent ne pas porter d'ID.
        if (Object.keys(v).length && !/^suggested.*Changes$/.test(key)) anonymous++;
      }
      visit(v);
    });
  }
  visit(obj);
  return ids.size + anonymous;
}
function openComments_(docId) {
  const unresolved = [];
  let token;
  let pages = 0;
  do {
    const params = {fields:'nextPageToken,comments(id,resolved,deleted)', pageSize:100};
    if (token) params.pageToken = token;
    const reply = Drive.Comments.list(docId, params);
    (reply.comments || []).forEach(c => {if (!c.deleted && !c.resolved) unresolved.push(String(c.id));});
    token = reply.nextPageToken;
    pages++;
    if (pages >= GLM_.MAX_PAGES && token) throw new Error('Trop de pages de commentaires. Analyse incomplète : publication bloquée.');
  } while (token);
  return {ids:unresolved.sort()};
}

/** Styles Google Docs : héritage NORMAL_TEXT -> style nommé -> surcharge de chaque run. */
function namedStyleMap_(namedStyles) {
  const map = {};
  ((namedStyles && namedStyles.styles) || []).forEach(s => {
    if (s.namedStyleType) map[s.namedStyleType] = s;
  });
  return map;
}
function paraNamedType_(p) {
  return (p.paragraphStyle && p.paragraphStyle.namedStyleType) || 'NORMAL_TEXT';
}
function inheritedTextStyle_(p, named) {
  const normal = named.NORMAL_TEXT && named.NORMAL_TEXT.textStyle || {};
  const current = named[paraNamedType_(p)] && named[paraNamedType_(p)].textStyle || {};
  return Object.assign({}, normal, current);
}
function inheritedParagraphStyle_(p, named) {
  const normal = named.NORMAL_TEXT && named.NORMAL_TEXT.paragraphStyle || {};
  const current = named[paraNamedType_(p)] && named[paraNamedType_(p)].paragraphStyle || {};
  return Object.assign({}, normal, current, p.paragraphStyle || {});
}
function pt_(dimension, min, max) {
  if (!dimension || (dimension.unit && dimension.unit !== 'PT')) return '';
  const n = Number(dimension.magnitude);
  return Number.isFinite(n) && n >= (min || 0) && n <= (max || 250) ? Math.round(n * 100) / 100 + 'pt' : '';
}
function rgb_(optional) {
  if (!optional || !optional.color || !optional.color.rgbColor) return '';
  const rgb = optional.color.rgbColor;
  return '#' + ['red','green','blue'].map(k => {
    const v = Number(rgb[k] === undefined ? 0 : rgb[k]);
    return Math.round(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * 255).toString(16).padStart(2,'0');
  }).join('');
}
function fontFamily_(raw) {
  const font = String(raw || '').trim();
  // Écarter les caractères de contrôle et les caractères CSS spéciaux.
  return font.length && font.length <= 85 && /^[\p{L}\p{N} ._\-']+$/u.test(font) ? font : '';
}
function textStyleCss_(style) {
  const css = [];
  const font = fontFamily_(style.weightedFontFamily && style.weightedFontFamily.fontFamily);
  if (font) css.push('font-family:"'+font.replace(/'/g,'')+'",serif');
  const size = pt_(style.fontSize, 5, 150);
  if (size) css.push('font-size:'+size);
  const weight = style.weightedFontFamily && Number(style.weightedFontFamily.weight);
  if (typeof style.bold === 'boolean') css.push('font-weight:'+(style.bold ? (weight >= 600 && weight <= 900 ? weight : 700) : 400));
  else if (weight >= 100 && weight <= 900) css.push('font-weight:'+weight);
  if (typeof style.italic === 'boolean') css.push('font-style:'+(style.italic?'italic':'normal'));
  if (typeof style.smallCaps === 'boolean') css.push('font-variant:'+(style.smallCaps?'small-caps':'normal'));
  const lines=[];
  if (style.underline) lines.push('underline');
  if (style.strikethrough) lines.push('line-through');
  if (typeof style.underline === 'boolean' || typeof style.strikethrough === 'boolean')
    css.push('text-decoration-line:'+(lines.join(' ') || 'none'));
  const color = rgb_(style.foregroundColor);
  if (color) css.push('color:'+color);
  const bg = rgb_(style.backgroundColor);
  if (bg) css.push('background-color:'+bg);
  if (style.baselineOffset === 'SUPERSCRIPT') css.push('vertical-align:super;font-size:.8em');
  else if (style.baselineOffset === 'SUBSCRIPT') css.push('vertical-align:sub;font-size:.8em');
  return css.join(';');
}
function paragraphCss_(p, named) {
  const style = inheritedParagraphStyle_(p,named);
  const css=[];
  const align={START:'left',END:'right',CENTER:'center',JUSTIFIED:'justify'}[style.alignment];
  if (align) css.push('text-align:'+align);
  const line=Number(style.lineSpacing);
  if (line >= 60 && line <= 350) css.push('line-height:'+(Math.round(line)/100));
  [['spaceAbove','margin-top'],['spaceBelow','margin-bottom'],['indentStart','padding-left'],
    ['indentEnd','padding-right'],['indentFirstLine','text-indent']].forEach(([field,property])=>{
      const value=pt_(style[field],-150,300);
      if(value) css.push(property+':'+value);
    });
  const bg = rgb_(style.shading && style.shading.backgroundColor);
  if (bg) css.push('background-color:'+bg);
  return css.join(';');
}
function fontFamilies_(p, named, into) {
  [inheritedTextStyle_(p,named)].concat((p.elements||[]).map(e=>e.textRun && e.textRun.textStyle || {}))
    .forEach(style=>{
      const f=fontFamily_(style.weightedFontFamily && style.weightedFontFamily.fontFamily);
      if(f) into.add(f);
    });
}
function findFonts_(blocks, named, into) {
  (blocks||[]).forEach(b=>{
    if(b.paragraph) fontFamilies_(b.paragraph,named,into);
    if(b.table) (b.table.tableRows||[]).forEach(row=>(row.tableCells||[])
      .forEach(cell=>findFonts_(cell.content,named,into)));
  });
}
function parseSections_(blocks, namedStyles) {
  const named=namedStyleMap_(namedStyles);
  const sections=[];
  const ids=new Set();
  let current=null;
  function start(title,id,heading) {
    let cleanId=String(id || 'section-'+slug_(title)).replace(/[^a-zA-Z0-9_-]/g,'-');
    let unique=cleanId, count=2;
    while(ids.has(unique)) unique=cleanId+'-'+(count++);
    ids.add(unique);
    current={id:unique,title:title||'Sans titre',heading:heading||null,blocks:[],order:sections.length};
    sections.push(current);
  }
  for(const block of blocks||[]) {
    const p=block.paragraph;
    const style=p && p.paragraphStyle || {};
    if(p && style.namedStyleType==='HEADING_1') {
      start(paragraphText_(p).trim() || 'Sans titre', style.headingId, p);
      continue;
    }
    if(!current) start('Introduction','introduction',null);
    current.blocks.push(block);
  }
  return sections.map(s=>{
    const issues=[];
    const html=renderBlocks_(s.blocks,issues,named);
    const headingHtml=s.heading ? inlineParagraph_(s.heading,issues,named) : escapeHtml_(s.title);
    const headingCss=s.heading ? paragraphCss_(s.heading,named) : '';
    const fonts=new Set();
    if(s.heading) fontFamilies_(s.heading,named,fonts);
    findFonts_(s.blocks,named,fonts);
    return {id:s.id,title:s.title,headingHtml,headingCss,fonts:Array.from(fonts),html,
      text:blocksText_(s.blocks),order:s.order,issues};
  }).filter(s=>s.text.trim() || s.issues.length || s.headingHtml);
}
function slug_(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54) || 'sans-titre';
}
function escapeHtml_(str) {
  return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeHref_(url) {
  const str=String(url || '').trim();
  return /^(https?:\/\/|mailto:|#)/i.test(str) ? str : '';
}
function paragraphText_(p) {
  return (p.elements || []).map(e => e.textRun ? e.textRun.content || '' : '').join('');
}
function blocksText_(blocks) {
  return (blocks || []).map(b => {
    if (b.paragraph) return paragraphText_(b.paragraph);
    if (b.table) return (b.table.tableRows||[]).map(row=>(row.tableCells||[])
      .map(cell=>blocksText_(cell.content||[])).join(' | ')).join('\n');
    return '';
  }).join('\n').trim();
}
/** Titres HEADING_2..HEADING_6 -> sections HTML repliables imbriquées. */
function renderBlocks_(blocks,issues,named) {
  const out=[];
  let inList=false;
  const opened=[];
  let headingCounter=0;
  function closeList() { if (inList) {out.push('</ul>');inList=false;} }
  function closeHeadings(level) {
    while(opened.length && opened[opened.length-1] >= level) {
      out.push('</div></details>');
      opened.pop();
    }
  }
  for(const block of blocks||[]) {
    const p=block.paragraph;
    const heading=p && p.paragraphStyle && /^HEADING_([2-6])$/.exec(p.paragraphStyle.namedStyleType || '');
    if(heading && !p.bullet) {
      closeList();
      const level=Number(heading[1]);
      closeHeadings(level);
      const css=paragraphCss_(p,named);
      const id='glm-sous-titre-'+(block.startIndex === undefined ? 'n'+(++headingCounter) : String(block.startIndex));
      out.push('<details class="glm-subsection glm-level-'+level+'" open id="'+escapeHtml_(id)+'"><summary'+
        (css?' style="'+escapeHtml_(css)+'"':'')+'>'+inlineParagraph_(p,issues,named)+'</summary><div class="glm-subbody">');
      opened.push(level);
    } else if(p && p.bullet) {
      if(!inList){out.push('<ul class="glm-list">');inList=true;}
      const n=Math.min(4,Math.max(0,Number(p.bullet.nestingLevel||0)));
      const css=[paragraphCss_(p,named),'margin-left:'+(n*1.15)+'rem'].filter(Boolean).join(';');
      out.push('<li style="'+escapeHtml_(css)+'">'+inlineParagraph_(p,issues,named)+'</li>');
    } else {
      closeList();
      if(p) out.push(renderParagraph_(p,issues,named));
      else if(block.table) out.push(renderTable_(block.table,issues,named));
      else if(block.sectionBreak) { /* saut de section */ }
      else if(block.tableOfContents) issues.push('Table des matières automatique non importée');
      else if(Object.keys(block).some(k=>!['startIndex','endIndex'].includes(k)))
        issues.push('Bloc Google Docs non pris en charge');
    }
  }
  closeList();
  closeHeadings(0);
  return out.join('\n');
}
/** Les taquets Docs sont en points ; une grille conserve les colonnes, sans espaces artificiels. */
function tabGridHtml_(segments, p) {
  const stops = ((p.paragraphStyle && p.paragraphStyle.tabStops) || [])
    .filter(t => t.offset && (!t.offset.unit || t.offset.unit === 'PT') && Number.isFinite(Number(t.offset.magnitude)))
    .map(t => ({pt:Number(t.offset.magnitude),align:String(t.alignment||'START')}))
    .filter(t=>t.pt>=0 && t.pt<=2000)
    .sort((a,b)=>a.pt-b.pt);
  const widths=[];
  let last=0;
  for(let i=0;i<segments.length-1;i++) {
    const target = stops[i] ? stops[i].pt : last + 44;
    const next = Math.max(last+18, target);
    widths.push((Math.round((next-last)*100)/100)+'pt');
    last=next;
  }
  const template = widths.concat(['max-content']).join(' ');
  return '<span class="glm-tab-grid" style="grid-template-columns:'+escapeHtml_(template)+'">'+
    segments.map((html,i)=>{
      const align=i>0 && stops[i-1] && ['CENTER','END'].includes(stops[i-1].align)
        ? ' style="text-align:'+(stops[i-1].align==='END'?'right':'center')+'"' : '';
      return '<span class="glm-tab-cell"'+align+'>'+(html || '&#160;')+'</span>';
    }).join('')+'</span>';
}
function inlineParagraph_(p,issues,named) {
  const segments=[''];
  const inherited=inheritedTextStyle_(p,named);
  let hasTabs=false;
  function append(str){segments[segments.length-1]+=str;}
  for(const el of p.elements||[]) {
    if(el.textRun) {
      const txt=String(el.textRun.content||'').replace(/\n$/,'');
      if(!txt) continue;
      const style=Object.assign({},inherited,el.textRun.textStyle||{});
      const css=textStyleCss_(style);
      const href=style.link && safeHref_(style.link.url);
      txt.split('\t').forEach((piece,i)=>{
        if(i>0){segments.push('');hasTabs=true;}
        if(!piece)return;
        let html=escapeHtml_(piece).replace(/\n/g,'<br>');
        if(css) html='<span style="'+escapeHtml_(css)+'">'+html+'</span>';
        if(href) html='<a href="'+escapeHtml_(href)+'" target="_blank" rel="noopener noreferrer">'+html+'</a>';
        append(html);
      });
    } else if(el.inlineObjectElement || el.positionedObjectIds) {
      issues.push('Image/objet intégré : traitement manuel nécessaire');
      append('<span class="glm-unsupported">[Image non importée]</span>');
    } else if(el.equationElement) {
      issues.push('Équation non importée');
      append('<span class="glm-unsupported">[Équation non importée]</span>');
    } else if(el.richLink) {
      issues.push('Lien enrichi non pris en charge');
      append('<span class="glm-unsupported">[Lien enrichi non importé]</span>');
    }
  }
  return hasTabs ? tabGridHtml_(segments,p) : segments[0];
}
function renderParagraph_(p,issues,named) {
  const style=p.paragraphStyle||{};
  const tagByName={TITLE:'h2',SUBTITLE:'h3',HEADING_1:'h2',HEADING_2:'h3',HEADING_3:'h4',
    HEADING_4:'h5',HEADING_5:'h6',HEADING_6:'h6'};
  const tag=tagByName[style.namedStyleType]||'p';
  const css=paragraphCss_(p,named);
  const attr=css ? ' style="'+escapeHtml_(css)+'"' : '';
  const content=inlineParagraph_(p,issues,named);
  if(!content.trim()) return '<p class="glm-empty"'+attr+'></p>';
  const classes=paragraphText_(p).includes('\t')?' class="glm-has-tabs"':'';
  return '<'+tag+classes+attr+'>'+content+'</'+tag+'>';
}
function borderCss_(border) {
  if(!border || !border.width) return '';
  const width=pt_(border.width,0,12);
  if(!width) return '';
  if(Number(border.width.magnitude)===0) return '0';
  const dash=border.dashStyle==='DASH'?'dashed':border.dashStyle==='DOT'?'dotted':'solid';
  return width+' '+dash+' '+(rgb_(border.color)||'#aaa');
}
function cellCss_(style) {
  const css=[];
  const bg=rgb_(style.backgroundColor);
  if(bg) css.push('background-color:'+bg);
  [['paddingLeft','left'],['paddingRight','right'],['paddingTop','top'],['paddingBottom','bottom']]
    .forEach(([field,suffix])=>{const pt=pt_(style[field],0,90);if(pt)css.push('padding-'+suffix+':'+pt);});
  [['borderLeft','left'],['borderRight','right'],['borderTop','top'],['borderBottom','bottom']]
    .forEach(([field,suffix])=>{const b=borderCss_(style[field]);if(b)css.push('border-'+suffix+':'+b);});
  const vertical={TOP:'top',MIDDLE:'middle',BOTTOM:'bottom'}[style.contentAlignment];
  if(vertical) css.push('vertical-align:'+vertical);
  return css.join(';');
}
function renderTable_(table,issues,named) {
  let html='<div class="glm-table-wrap"><table class="glm-table"><tbody>';
  for(const row of table.tableRows||[]) {
    html+='<tr>';
    for(const cell of row.tableCells||[]) {
      const style=cell.tableCellStyle||{};
      const colspan=Math.max(1,Math.min(20,Number(style.columnSpan || cell.columnSpan || 1)));
      const rowspan=Math.max(1,Math.min(20,Number(style.rowSpan || cell.rowSpan || 1)));
      const css=cellCss_(style);
      html+='<td colspan="'+colspan+'" rowspan="'+rowspan+'"'+(css?' style="'+escapeHtml_(css)+'"':'')+'>'+renderBlocks_(cell.content||[],issues,named)+'</td>';
    }
    html+='</tr>';
  }
  return html+'</tbody></table></div>';
}
/** Charger uniquement les polices Google Fonts reconnues dans le document. */
function googleFontsLink_(sections) {
  const supported=new Set(['Alegreya','Cardo','Cinzel','Cormorant Garamond','EB Garamond',
    'Grenze','IM Fell English','IM Fell English SC','Lora','Merriweather','Montserrat',
    'Noto Sans','Noto Serif','Old Standard TT','Open Sans','Oswald','Pirata One',
    'Playfair Display','Roboto','Uncial Antiqua','UnifrakturMaguntia']);
  const fonts=new Set();
  (sections||[]).forEach(s=>(s.fonts||[]).forEach(f=>{if(supported.has(f))fonts.add(f);}));
  if(!fonts.size) return '';
  const query=Array.from(fonts).sort().map(f=>'family='+encodeURIComponent(f)).join('&');
  return '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'+escapeHtml_(query)+'&amp;display=swap">';
}

/**
 * Nettoyage de l'affichage : ne jamais supprimer le contenu de la version stockée.
 * La suppression de l'attribut open est limitée aux sous-sections générées par GLM.
 */
function webContentHtml_(html) {
  return String(html || '').replace(/(<details\b[^>]*\bclass="[^"]*\bglm-subsection\b[^"]*"[^>]*?)\s+open(?=[\s>])/gi, '$1')
    .replace(/^(?:\s*<p\s+class="glm-empty"[^>]*>\s*<\/p>)+/i, '');
}

function canonicalWebTitle_(raw) {
  return slug_(String(raw || '')
    .replace(/\s*\[(?:GLM|VF|VO|FR|version[^\]]*)\]\s*/gi, ' ')
    .replace(/^(?:la|le|les|l[’'])\s+/i, ''));
}

function isEmptyWebIntro_(section) {
  if (slug_(section.title) !== 'introduction' || (section.issues || []).length) return false;
  if (String(section.text || '').trim()) return false;
  const visible = String(section.html || '').replace(/<[^>]+>/g, '')
    .replace(/&(?:nbsp|#160|#xA0);/gi, '').trim();
  return !visible;
}

/**
 * Affichage de type GLM historique : aucun titre/résumé/bouton redondant.
 * Les styles sont propres à l'iframe Apps Script et ne touchent pas au thème Sites.
 * On ferme les sections au premier affichage, sans modifier les snapshots.
 */
function renderPublicHtml_(snapshot) {
  const css = `<style>
    :root{color-scheme:light;--glm-rule:#b9b9b9;--glm-ink:#171717;--glm-serif:Georgia,'Times New Roman',serif;--glm-gothic:'UnifrakturMaguntia',Georgia,serif}
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:var(--glm-ink)}
    body{font-family:var(--glm-serif);line-height:1.5;overflow-wrap:break-word}
    .glm{width:100%;max-width:800px;margin:0 auto;padding:0 12px 24px}
    .glm p{margin:.7em 0}.glm a{color:#a01e1e;text-decoration:underline}
    .glm h2,.glm h3,.glm h4,.glm h5,.glm h6{line-height:1.25}
    .glm-prelude{padding:4px 6px 18px}.glm-prelude:empty{display:none}
    .glm-section,.glm-subsection{border:0;border-bottom:1px solid var(--glm-rule);border-radius:0;background:#fff;margin:0;padding:0}
    .glm-section>summary,.glm-subsection>summary{display:flex!important;align-items:center;justify-content:center;position:relative;
      min-height:75px;padding:19px 38px 19px 28px;cursor:pointer;list-style:none!important;
      background:#fff!important;color:var(--glm-ink)!important;text-align:center!important;
      font-family:var(--glm-gothic)!important;font-size:clamp(1.15rem,2.15vw,1.42rem)!important;
      font-style:normal!important;font-weight:400!important;line-height:1.2!important;
      text-indent:0!important;letter-spacing:0;margin:0!important;outline-offset:-3px}
    .glm-section>summary::-webkit-details-marker,.glm-subsection>summary::-webkit-details-marker{display:none}
    .glm-section>summary::marker,.glm-subsection>summary::marker{content:''}
    .glm-section>summary::after,.glm-subsection>summary::after{content:'';position:absolute;right:14px;top:calc(50% - 5px);
      width:7px;height:7px;border-right:1px solid #6a6a6a;border-bottom:1px solid #6a6a6a;
      transform:rotate(45deg);transition:transform .16s ease}
    .glm-section[open]>summary::after,.glm-subsection[open]>summary::after{transform:rotate(225deg);top:calc(50% - 2px)}
    .glm-section>summary>*,.glm-subsection>summary>*{font-family:inherit!important;font-size:inherit!important;
      font-weight:inherit!important;font-style:inherit!important;color:inherit!important;line-height:inherit!important;
      text-decoration:none!important;background:transparent!important;text-align:inherit!important}
    .glm-section>summary:hover,.glm-subsection>summary:hover{background:#fafafa!important}
    .glm-section>summary:focus-visible,.glm-subsection>summary:focus-visible{outline:2px solid #444}
    .glm-section>div,.glm-subbody{padding:12px 14px 25px;line-height:1.5}
    .glm-subbody>.glm-subsection{margin:0 -14px}
    .glm-subbody>.glm-subsection>summary{min-height:63px}
    .glm-section>.glm-content>.glm-subsection{margin:0 -14px}
    .glm-section>.glm-content{padding:0 14px 12px}
    .glm-section>.glm-content>p:first-child,.glm-subbody>p:first-child{margin-top:.6em}
    .glm-list{padding-left:1.6rem}
    .glm-table-wrap{overflow-x:auto;max-width:100%;margin:12px 0}
    .glm-table{border-collapse:collapse;max-width:100%;width:100%}
    .glm-table td{border:1px solid #b5b5b5;padding:5px 8px;vertical-align:top}
    .glm-unsupported{color:#a01e1e}.glm-empty{height:.2em;margin:.2em 0}
    .glm-tab-grid{display:inline-grid;vertical-align:baseline;width:max-content;white-space:pre;max-width:none}
    .glm-tab-cell{display:block;min-width:0;white-space:pre}.glm-has-tabs{overflow-x:auto;max-width:100%}
    @media(max-width:680px){.glm{padding:0 8px 18px}
      .glm-section>summary,.glm-subsection>summary{min-height:59px;padding:15px 30px 15px 16px;font-size:1.2rem!important}
      .glm-section>summary::after,.glm-subsection>summary::after{right:11px}
      .glm-section>div,.glm-subbody{padding:10px 7px 18px}
      .glm-section>.glm-content{padding:0 7px 10px}
      .glm-subbody>.glm-subsection{margin:0 -7px}}
    @media(prefers-reduced-motion:reduce){.glm-section>summary::after,.glm-subsection>summary::after{transition:none}}
  </style>`;
  const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">'+
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
  if (!snapshot) return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'</head><body><main class="glm"><p>Aucune version publiée pour cette page.</p></main></body></html>';
  // Le nom de cette police est confirmé dans les styles Google Docs de GLM.
  // Même les anciens snapshots dépourvus de métadonnées de police profitent du chargement.
  const googleFonts = googleFontsLink_([{fonts:['UnifrakturMaguntia','Merriweather']}].concat(snapshot.sections || []));
  let html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+fontLink+googleFonts+css+'</head><body><main class="glm" aria-label="Texte de la traduction">';
  const docTitle = canonicalWebTitle_(snapshot.title || '');
  (snapshot.sections || []).forEach(s => {
    if (isEmptyWebIntro_(s)) return;
    const body = webContentHtml_(s.html || '');
    // Ne pas répéter le titre déjà présent dans l'en-tête Google Sites.
    // Son texte introductif reste affiché ; ses sous-sections deviennent les accordéons principaux.
    if (docTitle && canonicalWebTitle_(s.title) === docTitle) {
      html += '<div class="glm-prelude">'+body+'</div>';
    } else if (slug_(s.title) === 'introduction') {
      html += '<div class="glm-prelude">'+body+'</div>';
    } else {
      html += '<details class="glm-section" id="'+escapeHtml_(s.id)+'"><summary'+
        (s.headingCss ? ' style="'+escapeHtml_(s.headingCss)+'"' : '')+'>'+
        (s.headingHtml || escapeHtml_(s.title))+'</summary><div class="glm-content">'+body+'</div></details>';
    }
  });
  // Pas de bouton global, pas de sommaire artificiel : seulement les vrais titres repliables.
  return html+'</main></body></html>';
}