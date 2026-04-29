import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { runDNS } from './modules/dns.js';
import { runTLS } from './modules/tls.js';
import { runHTTP } from './modules/http.js';
import { runHeaders } from './modules/headers.js';
import { runPorts } from './modules/ports.js';
import { runRisk } from './modules/risk.js';
import { analyzeRecon, chatWithAI, getOllamaStatus } from './ai/ollama.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const reconLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many scans. Slow down.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many AI requests.' } });

function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const clean = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  return /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/.test(clean);
}

function extractDomain(input) {
  return input.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
}

// POST /api/recon
app.post('/api/recon', reconLimiter, async (req, res) => {
  const { target, modules = ['dns', 'tls', 'http', 'headers'] } = req.body;

  if (!target) return res.status(400).json({ error: 'target required' });

  const domain = extractDomain(target);
  if (!validateDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });

  const startTime = Date.now();
  console.log(`[RECON] Starting scan: ${domain} | modules: ${modules.join(',')}`);

  const results = {};
  const tasks = [];

  if (modules.includes('dns')) {
    tasks.push(runDNS(domain).then(r => { results.dns = r; console.log(`[RECON] DNS done: ${domain}`); }).catch(e => { results.dns = { error: e.message }; }));
  }
  if (modules.includes('tls')) {
    tasks.push(runTLS(domain).then(r => { results.tls = r; console.log(`[RECON] TLS done: ${domain}`); }).catch(e => { results.tls = { error: e.message }; }));
  }
  if (modules.includes('http')) {
    tasks.push(runHTTP(domain).then(r => { results.http = r; console.log(`[RECON] HTTP done: ${domain}`); }).catch(e => { results.http = { error: e.message }; }));
  }
  if (modules.includes('headers')) {
    tasks.push(runHeaders(domain).then(r => { results.secHeaders = r; console.log(`[RECON] Headers done: ${domain}`); }).catch(e => { results.secHeaders = { error: e.message }; }));
  }
  if (modules.includes('ports')) {
    tasks.push(runPorts(domain).then(r => { results.ports = r; console.log(`[RECON] Ports done: ${domain} — ${r.open.length} open`); }).catch(e => { results.ports = { error: e.message }; }));
  }

  await Promise.all(tasks);

  const risk = runRisk(results);
  const elapsed = Date.now() - startTime;

  console.log(`[RECON] Complete: ${domain} | risk: ${risk.score} | ${elapsed}ms`);

  res.json({
    domain,
    timestamp: new Date().toISOString(),
    elapsed,
    modules: results,
    risk
  });
});

// POST /api/ai/analyze
app.post('/api/ai/analyze', aiLimiter, async (req, res) => {
  const { reconData, model, domain } = req.body;
  if (!reconData) return res.status(400).json({ error: 'reconData required' });

  try {
    const result = await analyzeRecon(domain || reconData.domain || 'target', reconData, model);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/chat
app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  const { message, context, model } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const result = await chatWithAI(message, context, model);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ai/status
app.get('/api/ai/status', async (req, res) => {
  const status = await getOllamaStatus();
  res.json(status);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// robots.txt with easter egg
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Disallow: /api/

# Hey hacker 👋
# Nice to see you checking robots.txt
# The real vulns aren't listed here
# Try: /api/recon on your own domain
# Happy hunting — PwnRecon`);
});

app.listen(PORT, () => {
  console.log(`\n🔍 PwnRecon backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/recon\n`);
});
