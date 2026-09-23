// IA locale de Chrome (Prompt API / Gemini Nano), partagée par le popup et la page des favoris.

let modelOptions = null; // options de langue acceptées par le modèle local

async function aiAvailability() {
  if (typeof LanguageModel === 'undefined') return 'unavailable';
  for (const lang of ['fr', 'en']) {
    const opts = {
      expectedInputs: [{ type: 'text', languages: [lang] }],
      expectedOutputs: [{ type: 'text', languages: [lang] }],
    };
    const state = await LanguageModel.availability(opts);
    if (state !== 'unavailable') {
      modelOptions = opts;
      return state;
    }
  }
  return 'unavailable';
}

async function createAiSession(systemPrompt, onProgress) {
  if (!modelOptions) await aiAvailability();
  return LanguageModel.create({
    ...modelOptions,
    initialPrompts: [{ role: 'system', content: systemPrompt }],
    monitor(m) {
      m.addEventListener('downloadprogress', e => onProgress?.(e.loaded));
    },
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), ms)),
  ]);
}

const AI_STATE_LABELS = {
  available: 'IA locale prête',
  downloadable: 'IA à activer',
  downloading: 'IA en téléchargement',
  unavailable: 'IA indisponible',
};
