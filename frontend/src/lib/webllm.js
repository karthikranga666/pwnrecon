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

const SYSTEM_PROMPT = `You are PwnRecon AI — a penetration testing and security assistant.

Two types of questions, handle differently:

TYPE 1 — General security questions ("what is TLS", "explain XSS", "how does DNS work"):
- Answer from your knowledge. Do NOT force scan data into the answer.
- Be clear, concise, educational. Under 100 words.

TYPE 2 — Scan-specific questions ("what did the scan find", "is port 22 open", "what's my risk score", "how do I fix MY site"):
- Answer ONLY from the scan data provided. Never contradict or invent values not explicitly in the scan data.
- If scan data says "Self-signed: no" — it is NOT self-signed. Trust the data exactly.
- If a module was not run, say "Not scanned — enable [Module] and rescan."

Both types:
- When asked for steps ("how to", "give me steps", "walk me through"), give numbered steps: "1. text" — number and text on same line always.
- You CANNOT generate PDFs. If asked, say: "Use the EXPORT PDF button in the results."
- Be direct and technical. Under 200 words.
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
