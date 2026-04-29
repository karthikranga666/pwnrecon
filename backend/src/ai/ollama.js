import axios from 'axios';
import { buildAnalysisPrompt, buildChatPrompt } from './prompts.js';
import { analyzeWithFallback, chatWithFallback } from './fallback.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export async function getOllamaStatus() {
  try {
    const resp = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    const models = (resp.data?.models || []).map(m => m.name);
    return { available: true, models, url: OLLAMA_URL };
  } catch {
    return { available: false, models: [], url: OLLAMA_URL };
  }
}

async function ollamaGenerate(prompt, model) {
  const resp = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: model || DEFAULT_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.3, top_p: 0.9 }
  }, { timeout: 60000 });
  return resp.data?.response || '';
}

export async function analyzeRecon(domain, reconData, model) {
  const status = await getOllamaStatus();

  if (!status.available) {
    return {
      source: 'builtin',
      analysis: analyzeWithFallback(domain, reconData)
    };
  }

  try {
    const prompt = buildAnalysisPrompt(domain, reconData);
    const raw = await ollamaGenerate(prompt, model);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const analysis = JSON.parse(jsonMatch[0]);
    return { source: 'ollama', model: model || DEFAULT_MODEL, analysis };
  } catch (e) {
    console.error('Ollama analysis failed, using fallback:', e.message);
    return {
      source: 'builtin',
      analysis: analyzeWithFallback(domain, reconData)
    };
  }
}

export async function chatWithAI(message, context, model) {
  const status = await getOllamaStatus();

  if (!status.available) {
    return {
      source: 'builtin',
      response: chatWithFallback(message, context)
    };
  }

  try {
    const prompt = buildChatPrompt(message, context);
    const response = await ollamaGenerate(prompt, model);
    return { source: 'ollama', model: model || DEFAULT_MODEL, response };
  } catch (e) {
    return {
      source: 'builtin',
      response: chatWithFallback(message, context)
    };
  }
}
