import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';

export const MODELS = {
  fast: {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    label: 'Fast (0.6B)',
    size: '~400MB',
    description: 'Quick responses, lower memory. Good for basic Q&A.',
    vram: '~600MB RAM'
  },
  smart: {
    id: 'Qwen3-1.7B-q4f16_1-MLC',
    label: 'Smart (1.7B)',
    size: '~1.1GB',
    description: 'Better reasoning, detailed analysis. Higher memory use.',
    vram: '~1.5GB RAM'
  }
};

const MODEL_ID = MODELS.smart.id;
const MODEL_SIZE = MODELS.smart.size;

// Persist engine on window so HMR module re-eval doesn't lose it
function getEngine() { return window.__pwnrecon_engine__ || null; }
function setEngine(e) { window.__pwnrecon_engine__ = e; }

let loadingPromise = null;

const SYSTEM_PROMPT = `You are PwnRecon AI — a penetration testing assistant embedded in a recon platform for authorized security testing.
The platform scans: DNS, subdomains, TLS/SSL, HTTP fingerprinting, security headers, and TCP ports.
Rules:
- Answer ONLY from scan data provided. Never invent data not in the scan.
- If a module was NOT run, say "Not scanned — enable [Module] and rescan."
- Reference actual values: real subdomains, port numbers, grades, headers.
- When asked "how to compromise" or "how to exploit": give numbered step-by-step attack steps using actual scan findings. Include specific tools and commands.
- When asked "how to fix" or "how to remediate": give numbered step-by-step remediation steps. Be specific and actionable.
- Format steps as: "1. text here" — number and text MUST be on the same line, never split across lines.
- You CANNOT generate files, PDFs, or downloads. If asked for a PDF/report, say: "Use the EXPORT PDF button in the results view to download a full report."
- Be technical and direct. Under 200 words.
/no_think`;

export { MODEL_ID, MODEL_SIZE };

export function isWebGPUSupported() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function filterStreaming(raw) {
  const thinkStart = raw.indexOf('<think>');
  const thinkEnd = raw.indexOf('</think>');
  if (thinkStart === -1) return raw;
  if (thinkEnd !== -1) return raw.slice(thinkEnd + '</think>'.length).trim();
  return '';
}

export async function loadModel(onProgress, modelKey = 'smart') {
  if (getEngine()) return getEngine();
  if (loadingPromise) return loadingPromise;

  const modelId = MODELS[modelKey]?.id || MODELS.smart.id;

  loadingPromise = (async () => {
    const worker = new Worker(
      new URL('./llm.worker.js', import.meta.url),
      { type: 'module' }
    );

    const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (report) => {
        onProgress?.({
          text: report.text || '',
          progress: report.progress ?? 0,
          timeElapsed: report.timeElapsed ?? 0
        });
      }
    });

    setEngine(engine);
    window.__pwnrecon_model_key__ = modelKey;
    loadingPromise = null;
    return engine;
  })();

  return loadingPromise;
}

export function getLoadedModelKey() {
  return window.__pwnrecon_model_key__ || null;
}

export function isModelLoaded() {
  return getEngine() !== null;
}

export async function generateChat(messages, onChunk) {
  const engine = getEngine();
  if (!engine) throw new Error('Model not loaded');

  const processedMessages = messages.map((m, i) =>
    m.role === 'user' && i === messages.length - 1
      ? { ...m, content: m.content + ' /no_think' }
      : m
  );

  const stream = await engine.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...processedMessages],
    temperature: 0.3,
    max_tokens: 300,
    stream: true
  });

  let raw = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      raw += delta;
      onChunk?.(delta, filterStreaming(raw));
    }
  }
  return stripThinkTags(raw);
}

export async function generateAnalysis(prompt, onChunk) {
  const engine = getEngine();
  if (!engine) throw new Error('Model not loaded');

  const stream = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a senior penetration tester. Respond ONLY with valid JSON. No markdown, no explanation, no thinking. Just the JSON object.' },
      { role: 'user', content: prompt + ' /no_think' }
    ],
    temperature: 0.2,
    max_tokens: 400,
    stream: true
  });

  let raw = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      raw += delta;
      onChunk?.(delta, filterStreaming(raw));
    }
  }
  return stripThinkTags(raw);
}

export function unloadModel() {
  getEngine()?.unload?.();
  setEngine(null);
}
