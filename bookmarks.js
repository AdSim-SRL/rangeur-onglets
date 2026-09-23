// Tri des favoris par l'IA locale : analyse -> aperçu -> sauvegarde -> application, restauration possible.
// Périmètre : "Barre de favoris" et "Autres favoris". "Favoris sur mobile" n'est jamais touché.

const BATCH_SIZE = 25;
const AI_TIMEOUT_MS = 90_000;
const BACKUP_KEY = 'bookmarkBackup';
const MISC = 'Divers';

const SYSTEM_PROMPT = `Tu classes les favoris d'un navigateur par thème, en t'adaptant au métier et aux centres d'intérêt qui ressortent des favoris eux-mêmes.
Pour chaque favori, choisis un dossier de destination.
Règles :
- Noms de dossiers en français, courts (1 à 3 mots), orthographe correcte (ex. "Google Analytics", pas "Google Annalytics").
- Réutilise en priorité un dossier de la liste "Dossiers déjà créés", à l'identique.
- Au maximum deux niveaux, écrits "Parent / Enfant" (ex. "Veille / SEO"). N'utilise un sous-dossier que si le thème est vaste.
- Vise 8 à 15 dossiers principaux au total, pas un dossier par favori.
- Le dossier actuel est un indice utile, mais fusionne les doublons (ex. un "SEO" rangé à deux endroits) et corrige les fautes.
Réponds uniquement avec le JSON demandé, en utilisant les numéros fournis.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, folder: { type: 'string' } },
        required: ['n', 'folder'],
      },
    },
  },
  required: ['items'],
};

const $ = id => document.getElementById(id);
const ui = {
  engine: $('engine'), status: $('status'), progress: $('progress'), bar: $('bar'),
  analyze: $('analyze'), includeLoose: $('includeLoose'),
  preview: $('preview'), summary: $('summary'), tree: $('tree'), apply: $('apply'), reanalyze: $('reanalyze'),
  backup: $('backup'), backupInfo: $('backupInfo'), restore: $('restore'), export: $('export'),
};

let plan = null; // [{ path: ['Parent', 'Enfant'?], bookmarks: [...] }]

function setStatus(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', isError);
}

function setProgress(ratio) {
  ui.progress.hidden = ratio === null;
  if (ratio !== null) ui.bar.style.width = `${Math.round(ratio * 100)}%`;
}

function setBusy(busy) {
  for (const b of [ui.analyze, ui.apply, ui.reanalyze, ui.restore]) b.disabled = busy;
}

// --- Lecture des favoris ----------------------------------------------------

async function roots() {
  const [tree] = await chrome.bookmarks.getTree();
  const bar = tree.children.find(n => n.folderType === 'bookmarks-bar' || n.id === '1');
  const other = tree.children.find(n => n.folderType === 'other' || n.id === '2');
  return { bar, other };
}

async function collectBookmarks() {
  const { bar, other } = await roots();
  const out = [];
  const walk = (node, path, isBarRoot) => {
    for (const child of node.children || []) {
      if (child.unmodifiable) continue;
      if (child.url) {
        if (isBarRoot && !ui.includeLoose.checked) continue;
        out.push({ id: child.id, title: child.title || child.url, url: child.url, from: path.join(' / ') || 'racine' });
      } else {
        walk(child, [...path, child.title], false);
      }
    }
  };
  walk(bar, [], true);
  walk(other, ['Autres favoris'], false);
  return out;
}

// --- Classement par l'IA ----------------------------------------------------

function cleanPath(raw) {
  const parts = String(raw || '')
    .split('/')
    .map(p => p.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  return parts.length ? parts : null;
}

// Même dossier à la casse près -> un seul nom.
function canonicalizer() {
  const known = new Map();
  return parts => parts.map((p, i) => {
    const key = parts.slice(0, i + 1).join('/').toLowerCase();
    if (!known.has(key)) known.set(key, p);
    return known.get(key);
  });
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function classify(bookmarks, onBatch) {
  const base = await createAiSession(SYSTEM_PROMPT);
  const canon = canonicalizer();
  const folders = new Set();
  const assignment = new Map(); // bookmark id -> path[]

  const runBatch = async batch => {
    const lines = batch.map((b, i) => `${i + 1} | ${b.title.slice(0, 80)} | ${hostOf(b.url)} | ${b.from}`);
    const session = await base.clone();
    try {
      const raw = await withTimeout(session.prompt(
        `Dossiers déjà créés : ${[...folders].join(', ') || 'aucun'}\n\n` +
        `Favoris (numéro | titre | site | dossier actuel) :\n${lines.join('\n')}`,
        { responseConstraint: RESPONSE_SCHEMA },
      ), AI_TIMEOUT_MS);
      for (const item of JSON.parse(raw).items || []) {
        const b = batch[item.n - 1];
        const path = cleanPath(item.folder);
        if (b && path && !assignment.has(b.id)) {
          const p = canon(path);
          assignment.set(b.id, p);
          folders.add(p.join(' / '));
        }
      }
    } catch (err) {
      console.warn('[Rangeur] lot de favoris en échec', err);
    } finally {
      session.destroy();
    }
  };

  try {
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      await runBatch(bookmarks.slice(i, i + BATCH_SIZE));
      onBatch(Math.min(i + BATCH_SIZE, bookmarks.length) / bookmarks.length);
    }
    // Deuxième chance pour les favoris oubliés, en petits lots.
    const missed = bookmarks.filter(b => !assignment.has(b.id));
    for (let i = 0; i < missed.length; i += 10) await runBatch(missed.slice(i, i + 10));
  } finally {
    base.destroy();
  }

  // Toujours oubliés : on garde leur dossier actuel.
  for (const b of bookmarks) {
    if (!assignment.has(b.id)) {
      assignment.set(b.id, canon(cleanPath(b.from.replace(/^racine$/, MISC)) || [MISC]));
    }
  }
  return buildPlan(bookmarks, assignment);
}

// Regroupe par dossier et évite les dossiers à un seul favori.
function buildPlan(bookmarks, assignment) {
  const count = new Map();
  for (const path of assignment.values()) {
    for (let d = 1; d <= path.length; d++) {
      const key = path.slice(0, d).join(' / ');
      count.set(key, (count.get(key) || 0) + 1);
    }
  }
  const byFolder = new Map();
  for (const b of bookmarks) {
    let path = assignment.get(b.id);
    if (path.length === 2 && count.get(path.join(' / ')) < 2) path = [path[0]];
    if (count.get(path[0]) < 2) path = [MISC];
    const key = path.join(' / ');
    if (!byFolder.has(key)) byFolder.set(key, { path, bookmarks: [] });
    byFolder.get(key).bookmarks.push(b);
  }
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  const folders = [...byFolder.values()];
  for (const f of folders) f.bookmarks.sort((a, b) => collator.compare(a.title, b.title));
  // Ordre alphabétique, "Divers" à la fin.
  const sortKey = f => (f.path[0] === MISC ? '￿' : '') + f.path.join(' / ');
  return folders.sort((a, b) => collator.compare(sortKey(a), sortKey(b)));
}

// --- Aperçu -----------------------------------------------------------------

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function bookmarkList(bookmarks) {
  const ul = el('ul');
  for (const b of bookmarks) {
    const li = el('li');
    const title = el('span', 'title', b.title);
    title.title = b.url;
    li.append(title, el('span', 'from', `depuis ${b.from}`));
    ul.append(li);
  }
  return ul;
}

function folderBlock(name, count) {
  const details = el('details');
  const summary = el('summary');
  summary.append(el('span', 'name', name), el('span', 'count', `${count} favori${count > 1 ? 's' : ''}`));
  details.append(summary);
  return details;
}

function renderPlan() {
  const tops = new Map();
  for (const f of plan) {
    const top = f.path[0];
    if (!tops.has(top)) tops.set(top, { own: [], subs: [] });
    if (f.path.length === 1) tops.get(top).own.push(...f.bookmarks);
    else tops.get(top).subs.push(f);
  }
  const blocks = [];
  for (const [name, t] of tops) {
    const total = t.own.length + t.subs.reduce((n, s) => n + s.bookmarks.length, 0);
    const block = folderBlock(name, total);
    for (const s of t.subs) {
      const sub = folderBlock(s.path[1], s.bookmarks.length);
      sub.append(bookmarkList(s.bookmarks));
      block.append(sub);
    }
    if (t.own.length) block.append(bookmarkList(t.own));
    blocks.push(block);
  }
  ui.tree.replaceChildren(...blocks);
  const n = plan.reduce((sum, f) => sum + f.bookmarks.length, 0);
  ui.summary.textContent = `${n} favoris répartis dans ${tops.size} dossiers principaux (${plan.length} dossiers au total). Clique sur un dossier pour voir son contenu.`;
  ui.preview.hidden = false;
}

// --- Sauvegarde et restauration ---------------------------------------------

async function snapshot() {
  const { bar, other } = await roots();
  const nodes = [];
  const walk = (node, depth) => {
    for (const child of node.children || []) {
      nodes.push({ id: child.id, parentId: child.parentId, index: child.index, depth, title: child.title, url: child.url || null });
      if (!child.url) walk(child, depth + 1);
    }
  };
  walk(bar, 0);
  walk(other, 0);
  return { date: new Date().toISOString(), nodes };
}

async function restore(backup) {
  const idMap = new Map(); // ancien id de dossier -> id actuel
  const mapped = id => idMap.get(id) || id;
  const exists = async id => {
    try { await chrome.bookmarks.get(id); return true; } catch { return false; }
  };
  const ordered = [...backup.nodes].sort((a, b) => a.depth - b.depth || a.index - b.index);
  const keep = new Set();

  for (const n of ordered) {
    const parentId = mapped(n.parentId);
    if (await exists(n.id)) {
      await chrome.bookmarks.move(n.id, { parentId, index: n.index });
      if (!n.url) await chrome.bookmarks.update(n.id, { title: n.title });
      keep.add(n.id);
    } else if (!n.url) {
      // Dossier supprimé par le tri : on le recrée.
      const created = await chrome.bookmarks.create({ parentId, index: n.index, title: n.title });
      idMap.set(n.id, created.id);
      keep.add(created.id);
    }
    // Un favori supprimé depuis le tri n'est pas recréé.
  }

  // Les dossiers créés par le tri, désormais vides, disparaissent.
  const { bar, other } = await roots();
  await removeEmptyFolders([bar, other], keep);
}

async function removeEmptyFolders(rootNodes, protectedIds) {
  const removeIn = async node => {
    for (const child of node.children || []) {
      if (child.url) continue;
      await removeIn(child);
      if (protectedIds.has(child.id)) continue;
      const fresh = await chrome.bookmarks.getChildren(child.id);
      if (fresh.length === 0) await chrome.bookmarks.remove(child.id);
    }
  };
  for (const root of rootNodes) {
    const [sub] = await chrome.bookmarks.getSubTree(root.id);
    await removeIn(sub);
  }
}

async function showBackup() {
  const { [BACKUP_KEY]: backup } = await chrome.storage.local.get(BACKUP_KEY);
  ui.backup.hidden = !backup;
  if (backup) {
    const when = new Date(backup.date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const count = backup.nodes.filter(n => n.url).length;
    ui.backupInfo.textContent = `Sauvegarde du ${when} (${count} favoris).`;
  }
}

// --- Application du classement ----------------------------------------------

async function findOrCreateFolder(parentId, title) {
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(c => !c.url && c.title.toLowerCase() === title.toLowerCase());
  if (existing) {
    if (existing.title !== title) await chrome.bookmarks.update(existing.id, { title });
    return existing.id;
  }
  return (await chrome.bookmarks.create({ parentId, title })).id;
}

async function applyPlan() {
  const { bar, other } = await roots();
  const used = new Set();
  const total = plan.reduce((n, f) => n + f.bookmarks.length, 0);
  let done = 0;

  // Dossiers principaux, dans l'ordre, après les liens posés dans la barre.
  const tops = [...new Set(plan.map(f => f.path[0]))];
  const topIds = new Map();
  for (const name of tops) {
    const id = await findOrCreateFolder(bar.id, name);
    await chrome.bookmarks.move(id, { parentId: bar.id });
    topIds.set(name, id);
    used.add(id);
  }

  for (const f of plan) {
    let folderId = topIds.get(f.path[0]);
    if (f.path.length === 2) {
      folderId = await findOrCreateFolder(folderId, f.path[1]);
      used.add(folderId);
    }
    for (const b of f.bookmarks) {
      await chrome.bookmarks.move(b.id, { parentId: folderId });
      setProgress(++done / total);
    }
  }

  // Dans chaque dossier : sous-dossiers d'abord, puis favoris, par ordre alphabétique.
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  for (const id of used) {
    const children = await chrome.bookmarks.getChildren(id);
    const sorted = [...children].sort((a, b) => (!!a.url - !!b.url) || collator.compare(a.title, b.title));
    for (const [index, c] of sorted.entries()) await chrome.bookmarks.move(c.id, { parentId: id, index });
  }

  await removeEmptyFolders([bar, other], used);
}

// --- Actions ----------------------------------------------------------------

async function ensureAi() {
  const state = await aiAvailability();
  ui.engine.textContent = AI_STATE_LABELS[state] || state;
  if (state === 'unavailable') {
    throw new Error("l'IA locale de Chrome n'est pas disponible sur ce navigateur.");
  }
  if (state !== 'available') {
    // Le clic sur "Analyser" autorise le téléchargement du modèle.
    setStatus('Téléchargement du modèle Gemini Nano (une seule fois)…');
    const s = await createAiSession(SYSTEM_PROMPT, loaded => setProgress(loaded));
    s.destroy();
    ui.engine.textContent = AI_STATE_LABELS.available;
  }
}

async function analyze() {
  setBusy(true);
  ui.preview.hidden = true;
  try {
    await ensureAi();
    const bookmarks = await collectBookmarks();
    if (!bookmarks.length) throw new Error('aucun favori à trier.');
    setStatus(`L'IA classe ${bookmarks.length} favoris… (la page doit rester ouverte)`);
    setProgress(0);
    plan = await classify(bookmarks, setProgress);
    setProgress(null);
    setStatus('Analyse terminée. Vérifie le classement ci-dessous avant de l\'appliquer.');
    renderPlan();
  } catch (err) {
    setProgress(null);
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    setBusy(false);
  }
}

ui.analyze.addEventListener('click', analyze);
ui.reanalyze.addEventListener('click', analyze);

ui.apply.addEventListener('click', async () => {
  if (!plan) return;
  setBusy(true);
  try {
    setStatus('Sauvegarde des favoris actuels…');
    await chrome.storage.local.set({ [BACKUP_KEY]: await snapshot() });
    setStatus('Rangement en cours…');
    await applyPlan();
    setProgress(null);
    plan = null;
    ui.preview.hidden = true;
    setStatus('Favoris rangés. La sauvegarde ci-dessous permet de revenir en arrière.');
    await showBackup();
  } catch (err) {
    setProgress(null);
    setStatus(`Erreur pendant le rangement : ${err.message}. Tu peux restaurer la sauvegarde.`, true);
    await showBackup();
  } finally {
    setBusy(false);
  }
});

ui.restore.addEventListener('click', async () => {
  const { [BACKUP_KEY]: backup } = await chrome.storage.local.get(BACKUP_KEY);
  if (!backup) return;
  setBusy(true);
  try {
    setStatus('Restauration…');
    await restore(backup);
    setStatus('Favoris remis dans leur état d\'avant le tri.');
  } catch (err) {
    setStatus(`Erreur de restauration : ${err.message}`, true);
  } finally {
    setBusy(false);
  }
});

ui.export.addEventListener('click', async () => {
  const { [BACKUP_KEY]: backup } = await chrome.storage.local.get(BACKUP_KEY);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = `favoris-sauvegarde-${backup.date.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

(async () => {
  ui.engine.textContent = AI_STATE_LABELS[await aiAvailability()];
  await showBackup();
})();
