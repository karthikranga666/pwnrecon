import { runDNS } from '../../backend/src/modules/dns.js';
import { runTLS } from '../../backend/src/modules/tls.js';
import { runHTTP } from '../../backend/src/modules/http.js';
import { runHeaders } from '../../backend/src/modules/headers.js';
import { runPorts } from '../../backend/src/modules/ports.js';
import { runRisk } from '../../backend/src/modules/risk.js';

function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const clean = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  return /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/.test(clean);
}

function extractDomain(input) {
  return input.replace(/^https?:\/\//, '').split('/')[0].toLowerCase().trim();
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { target, modules = ['dns', 'tls', 'http', 'headers'] } = req.body;
  if (!target) return res.status(400).json({ error: 'target required' });

  const domain = extractDomain(target);
  if (!validateDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });

  const startTime = Date.now();
  const results = {};
  const tasks = [];

  if (modules.includes('dns'))
    tasks.push(runDNS(domain).then(r => { results.dns = r; }).catch(e => { results.dns = { error: e.message }; }));
  if (modules.includes('tls'))
    tasks.push(runTLS(domain).then(r => { results.tls = r; }).catch(e => { results.tls = { error: e.message }; }));
  if (modules.includes('http'))
    tasks.push(runHTTP(domain).then(r => { results.http = r; }).catch(e => { results.http = { error: e.message }; }));
  if (modules.includes('headers'))
    tasks.push(runHeaders(domain).then(r => { results.secHeaders = r; }).catch(e => { results.secHeaders = { error: e.message }; }));
  if (modules.includes('ports'))
    tasks.push(runPorts(domain).then(r => { results.ports = r; }).catch(e => { results.ports = { error: e.message }; }));

  await Promise.all(tasks);

  const risk = runRisk(results);
  const elapsed = Date.now() - startTime;

  return res.json({ domain, timestamp: new Date().toISOString(), elapsed, modules: results, risk });
}
