// Regroupement sans IA : par famille d'outils connue, sinon par domaine.
// Sert de secours quand Gemini Nano est indisponible, et pour les onglets que l'IA oublie.

const FAMILIES = [
  { name: 'IA', hosts: ['gemini.google.com', 'chatgpt.com', 'claude.ai', 'perplexity.ai', 'aistudio.google.com'] },
  { name: 'Google Marketing', hosts: ['analytics.google.com', 'ads.google.com', 'tagmanager.google.com', 'search.google.com', 'lookerstudio.google.com', 'merchants.google.com'] },
  { name: 'Google Docs', hosts: ['docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com'] },
  { name: 'Mail & agenda', hosts: ['mail.google.com', 'calendar.google.com', 'outlook.office.com', 'outlook.live.com'] },
  { name: 'Microsoft 365', hosts: ['sharepoint.com', 'office.com', 'onedrive.live.com'] },
  { name: 'Stripe', hosts: ['stripe.com'] },
  { name: 'Dev', hosts: ['github.com', 'supabase.com', 'netlify.com', 'netlify.app', 'vercel.com', 'vercel.app', 'localhost'] },
  { name: 'SEO', hosts: ['semrush.com', 'ahrefs.com', 'similarweb.com'] },
  { name: 'Recherche', hosts: ['www.google.com', 'google.com', 'bing.com', 'duckduckgo.com'] },
  { name: 'Administration', hosts: ['public.lu', 'belgium.be', 'service-public.fr', 'admin.ch'] },
];

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function matchesHost(host, pattern) {
  return host === pattern || host.endsWith('.' + pattern);
}

// Domaine "racine" approximatif : maisonscompere.lu, thomas-piron.fr…
function rootDomain(host) {
  const parts = host.replace(/^www\./, '').split('.');
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}

// Nom lisible d'un domaine : "thomas-piron.lu" -> "Thomas Piron"
function prettyDomain(root) {
  const label = root.split('.')[0].replace(/[-_]/g, ' ');
  return label.replace(/\b\w/g, c => c.toUpperCase());
}

// tabs : [{id, url, title}] -> [{name, tabIds}]
function groupByHeuristics(tabs) {
  const buckets = new Map();
  for (const tab of tabs) {
    const host = hostOf(tab.url);
    if (!host || tab.url.startsWith('chrome://')) continue;
    const family = FAMILIES.find(f => f.hosts.some(p => matchesHost(host, p)));
    const key = family ? family.name : prettyDomain(rootDomain(host));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(tab.id);
  }
  return [...buckets.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([name, tabIds]) => ({ name, tabIds }));
}
