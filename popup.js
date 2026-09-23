const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];
const COLOR_HEX = {
  blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00', green: '#1e8e3e', pink: '#d01884',
  purple: '#9334e6', cyan: '#007b83', orange: '#fa903e', grey: '#5f6368',
};
const AI_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = `Tu ranges les onglets d'un navigateur en groupes.
Regroupe par projet, client ou sujet de travail, pas seulement par site : des sites différents qui parlent du même client ou du même sujet vont ensemble.
Règles :
- Entre 3 et 10 groupes.
- Nom de groupe court en français : 1 à 3 mots (ex. "Caro Confort", "Stripe", "Google Ads", "Immobilier LU").
- Chaque onglet apparaît dans un seul groupe au maximum.
- Un onglet qui ne va avec aucun autre peut être laissé de côté.
Réponds uniquement avec le JSON demandé, en utilisant les numéros d'onglets fournis.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          tabs: { type: 'array', items: { type: 'integer' } },
        },
        required: ['name', 'tabs'],
      },
    },
  },
  required: ['groups'],
};

const $ = id => document.getElementById(id);
const ui = {
  status: $('status'), engine: $('engine'), progress: $('progress'), bar: $('bar'),
  groups: $('groups'), download: $('download'), regroup: $('regroup'), ungroup: $('ungroup'),
  collapse: $('collapse'), useAi: $('useAi'), dedupe: $('dedupe'), sleep: $('sleep'),
  bookmarks: $('bookmarks'),
};

function setStatus(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', isError);
}

function setBusy(busy) {
  for (const b of [ui.regroup, ui.ungroup, ui.download]) b.disabled = busy;
}

// --- Onglets ---------------------------------------------------------------

async function windowTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true, pinned: false });
  return tabs.map(t => ({ id: t.id, url: t.url || t.pendingUrl || '', title: t.title || '', active: t.active, audible: t.audible }));
}

// Même adresse, à l'ancre (#…) près. On garde l'onglet actif, sinon le premier.
function duplicateKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}

async function closeDuplicates(tabs) {
  const keep = new Map();
  for (const t of tabs) {
    const key = duplicateKey(t.url);
    if (!keep.has(key) || t.active) keep.set(key, t.id);
  }
  const keptIds = new Set(keep.values());
  const toClose = tabs.filter(t => !keptIds.has(t.id)).map(t => t.id);
  if (toClose.length) await chrome.tabs.remove(toClose);
  return { tabs: tabs.filter(t => keptIds.has(t.id)), closed: toClose.length };
}

async function ungroupAll(tabs) {
  const ids = tabs.map(t => t.id);
  if (ids.length) await chrome.tabs.ungroup(ids);
}

async function applyGroups(groups, tabs) {
  await ungroupAll(tabs);
  const activeId = tabs.find(t => t.active)?.id;
  const created = [];
  for (const [i, g] of groups.entries()) {
    const color = COLORS[i % COLORS.length];
    const groupId = await chrome.tabs.group({ tabIds: g.tabIds });
    await chrome.tabGroups.update(groupId, {
      title: g.name,
      color,
      collapsed: ui.collapse.checked && !g.tabIds.includes(activeId),
    });
    await chrome.tabGroups.move(groupId, { index: -1 });
    created.push({ ...g, color, collapsed: ui.collapse.checked && !g.tabIds.includes(activeId) });
  }
  return created;
}

// Décharge de la mémoire les onglets des groupes repliés (ils se rechargent au clic).
// Chrome refuse de toute façon l'onglet actif ; on épargne aussi ceux qui jouent du son.
async function sleepCollapsed(groups, tabs) {
  const byId = new Map(tabs.map(t => [t.id, t]));
  let slept = 0;
  for (const g of groups.filter(g => g.collapsed)) {
    for (const id of g.tabIds) {
      const tab = byId.get(id);
      if (!tab || tab.active || tab.audible) continue;
      try {
        if (await chrome.tabs.discard(id)) slept++;
      } catch (err) {
        console.warn('[Rangeur] mise en veille refusée', id, err);
      }
    }
  }
  return slept;
}

function render(groups, tabs, engineLabel, closed, slept) {
  ui.groups.replaceChildren(...groups.map(g => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = COLOR_HEX[g.color];
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = g.name;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = g.tabIds.length;
    li.append(dot, name, count);
    return li;
  }));
  const grouped = groups.reduce((n, g) => n + g.tabIds.length, 0);
  const dupes = closed ? ` ${closed} doublon${closed > 1 ? 's' : ''} fermé${closed > 1 ? 's' : ''}.` : '';
  const sleeping = slept ? ` ${slept} mis en veille.` : '';
  setStatus(`${tabs.length} onglets : ${grouped} rangés en ${groups.length} groupes (${engineLabel}), ${tabs.length - grouped} laissés seuls.${dupes}${sleeping}`);
}

// --- IA locale -------------------------------------------------------------

async function groupWithAi(tabs, session) {
  // Numéros courts plutôt que les ids Chrome : le modèle se trompe moins.
  const candidates = tabs.filter(t => /^https?:/.test(t.url));
  const lines = candidates.map((t, i) => {
    const host = new URL(t.url).hostname.replace(/^www\./, '');
    return `${i + 1} | ${host} | ${t.title.slice(0, 90)}`;
  });
  const raw = await withTimeout(
    session.prompt(`Onglets (numéro | site | titre) :\n${lines.join('\n')}`, { responseConstraint: RESPONSE_SCHEMA }),
    AI_TIMEOUT_MS,
  );
  const parsed = JSON.parse(raw);

  const used = new Set();
  const groups = [];
  for (const g of parsed.groups || []) {
    const tabIds = [];
    for (const n of g.tabs || []) {
      const tab = candidates[n - 1];
      if (tab && !used.has(tab.id)) {
        used.add(tab.id);
        tabIds.push(tab.id);
      }
    }
    const name = String(g.name || '').trim().slice(0, 30);
    if (name && tabIds.length >= 2) groups.push({ name, tabIds });
    else tabIds.forEach(id => used.delete(id));
  }

  // Les onglets oubliés par l'IA passent par le regroupement par site.
  const leftovers = tabs.filter(t => !used.has(t.id));
  for (const h of groupByHeuristics(leftovers)) {
    const same = groups.find(g => g.name.toLowerCase() === h.name.toLowerCase());
    if (same) same.tabIds.push(...h.tabIds);
    else groups.push(h);
  }
  return groups;
}

// --- Orchestration ----------------------------------------------------------

async function run({ session = null } = {}) {
  setBusy(true);
  ui.groups.replaceChildren();
  try {
    let tabs = await windowTabs();
    let closed = 0;
    if (ui.dedupe.checked) ({ tabs, closed } = await closeDuplicates(tabs));
    let groups = null;
    let engineLabel = 'par site';

    if (ui.useAi.checked) {
      const state = session ? 'available' : await aiAvailability();
      if (state === 'available') {
        setStatus(`L'IA analyse ${tabs.length} onglets…`);
        const s = session || await createAiSession(SYSTEM_PROMPT);
        try {
          groups = await groupWithAi(tabs, s);
          engineLabel = 'IA locale';
        } catch (err) {
          console.warn('[Rangeur] IA en échec, secours par site', err);
          setStatus(`IA en échec (${err.message}), regroupement par site.`, true);
        } finally {
          s.destroy();
        }
      } else if (state === 'downloadable' || state === 'downloading') {
        ui.download.hidden = false;
      }
    }

    if (!groups) groups = groupByHeuristics(tabs);
    const created = await applyGroups(groups, tabs);
    const slept = ui.sleep.checked ? await sleepCollapsed(created, tabs) : 0;
    render(created, tabs, engineLabel, closed, slept);
  } catch (err) {
    console.error('[Rangeur]', err);
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function refreshEngineBadge() {
  const state = await aiAvailability();
  ui.engine.textContent = AI_STATE_LABELS[state] || state;
}

ui.download.addEventListener('click', async () => {
  // create() doit partir d'un clic : c'est lui qui déclenche le téléchargement du modèle.
  setBusy(true);
  ui.progress.hidden = false;
  setStatus('Téléchargement du modèle Gemini Nano (une seule fois)…');
  try {
    const session = await createAiSession(SYSTEM_PROMPT, loaded => {
      ui.bar.style.width = `${Math.round(loaded * 100)}%`;
    });
    ui.progress.hidden = true;
    ui.download.hidden = true;
    await refreshEngineBadge();
    await run({ session });
  } catch (err) {
    ui.progress.hidden = true;
    setStatus(`Téléchargement impossible : ${err.message}`, true);
    setBusy(false);
  }
});

ui.regroup.addEventListener('click', () => run());

ui.ungroup.addEventListener('click', async () => {
  await ungroupAll(await windowTabs());
  ui.groups.replaceChildren();
  setStatus('Tous les onglets ont été dégroupés.');
});

const OPTIONS = ['collapse', 'useAi', 'dedupe', 'sleep'];

// La mise en veille ne vise que les groupes repliés.
function syncSleepOption() {
  ui.sleep.disabled = !ui.collapse.checked;
}
ui.collapse.addEventListener('change', syncSleepOption);

ui.bookmarks.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
  window.close();
});
for (const key of OPTIONS) {
  ui[key].addEventListener('change', () => chrome.storage.local.set({ [key]: ui[key].checked }));
}

// Un clic sur l'icône = rangement immédiat.
(async () => {
  const saved = await chrome.storage.local.get(OPTIONS);
  for (const key of OPTIONS) {
    if (saved[key] !== undefined) ui[key].checked = saved[key];
  }
  syncSleepOption();
  await refreshEngineBadge();
  await run();
})();
