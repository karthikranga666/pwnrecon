import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: BASE,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' }
});

export async function startRecon(target, modules) {
  const { data } = await client.post('/api/recon', { target, modules });
  return data;
}

export async function analyzeWithAI(reconData, domain, model) {
  const { data } = await client.post('/api/ai/analyze', { reconData, domain, model });
  return data;
}

export async function chatWithAI(message, context, model) {
  const { data } = await client.post('/api/ai/chat', { message, context, model });
  return data;
}

export async function getAIStatus() {
  const { data } = await client.get('/api/ai/status');
  return data;
}
