import axios from 'axios';

const WAF_SIGNATURES = {
  cloudflare: ['cf-ray', 'cf-cache-status', '__cfduid', 'cloudflare'],
  akamai: ['akamai', 'x-check-cacheable', 'x-akamai-transformed'],
  awswaf: ['x-amz-cf-id', 'x-amzn-requestid', 'awselb'],
  sucuri: ['x-sucuri-id', 'x-sucuri-cache'],
  imperva: ['x-iinfo', 'incap_ses', 'visid_incap'],
  f5: ['bigip', 'f5', 'ts'],
};

function detectWAF(headers, body) {
  const headerStr = JSON.stringify(headers).toLowerCase();
  const bodyStr = (body || '').toLowerCase();

  for (const [waf, sigs] of Object.entries(WAF_SIGNATURES)) {
    if (sigs.some(sig => headerStr.includes(sig) || bodyStr.includes(sig))) {
      return waf;
    }
  }
  return null;
}

function detectTechStack(headers) {
  const tech = [];
  const h = headers;

  if (h['server']) tech.push({ name: h['server'], category: 'server' });
  if (h['x-powered-by']) tech.push({ name: h['x-powered-by'], category: 'runtime' });
  if (h['via']) tech.push({ name: h['via'], category: 'proxy' });
  if (h['x-generator']) tech.push({ name: h['x-generator'], category: 'cms' });
  if (h['x-drupal-cache'] || h['x-drupal-dynamic-cache']) tech.push({ name: 'Drupal', category: 'cms' });
  if (h['x-wordpress-cache'] || h['link']?.includes('wp-json')) tech.push({ name: 'WordPress', category: 'cms' });

  return tech;
}

async function probeURL(url, followRedirects = true) {
  const start = Date.now();
  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PwnRecon/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    return {
      url,
      status: resp.status,
      headers: resp.headers,
      body: (resp.data || '').toString().slice(0, 5000),
      responseTime: Date.now() - start,
      error: null
    };
  } catch (e) {
    if (e.response) {
      return {
        url,
        status: e.response.status,
        headers: e.response.headers || {},
        body: '',
        responseTime: Date.now() - start,
        error: null
      };
    }
    return { url, status: null, headers: {}, body: '', responseTime: Date.now() - start, error: e.message };
  }
}

async function checkOpenRedirect(domain) {
  try {
    const testUrl = `https://${domain}/?url=https://evil-pwnrecon-test.com&redirect=https://evil-pwnrecon-test.com`;
    const resp = await axios.get(testUrl, {
      timeout: 5000,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PwnRecon/1.0)' }
    });
    const location = resp.headers['location'] || '';
    if (location.includes('evil-pwnrecon-test.com')) {
      return { vulnerable: true, detail: `Redirects to: ${location}` };
    }
    return { vulnerable: false };
  } catch {
    return { vulnerable: false };
  }
}

export async function runHTTP(domain) {
  const [httpResult, httpsResult] = await Promise.all([
    probeURL(`http://${domain}`),
    probeURL(`https://${domain}`)
  ]);

  const primary = httpsResult.error ? httpResult : httpsResult;
  const waf = detectWAF(primary.headers, primary.body);
  const techStack = detectTechStack(primary.headers);

  const httpsRedirect = httpResult.status >= 300 && httpResult.status < 400 &&
    (httpResult.headers['location'] || '').startsWith('https://');

  const openRedirect = await checkOpenRedirect(domain);

  const findings = generateHTTPFindings({ httpsResult, httpResult, httpsRedirect, waf, openRedirect, techStack });

  return {
    http: {
      status: httpResult.status,
      responseTime: httpResult.responseTime,
      error: httpResult.error
    },
    https: {
      status: httpsResult.status,
      responseTime: httpsResult.responseTime,
      error: httpsResult.error
    },
    httpsRedirect,
    waf,
    techStack,
    openRedirect,
    server: primary.headers['server'] || null,
    poweredBy: primary.headers['x-powered-by'] || null,
    findings
  };
}

function generateHTTPFindings({ httpsResult, httpResult, httpsRedirect, waf, openRedirect, techStack }) {
  const findings = [];

  if (!httpsRedirect && httpResult.status && httpResult.status < 400) {
    findings.push({ severity: 'high', title: 'No HTTPS Redirect', detail: 'HTTP traffic not redirected to HTTPS — susceptible to SSLstrip', remediation: 'Add 301 redirect from HTTP to HTTPS in server config' });
  }

  if (openRedirect.vulnerable) {
    findings.push({ severity: 'high', title: 'Open Redirect Detected', detail: openRedirect.detail, remediation: 'Validate redirect URLs against allowlist before redirecting' });
  }

  const serverHeader = httpsResult.headers?.['server'] || httpResult.headers?.['server'];
  if (serverHeader) {
    findings.push({ severity: 'info', title: 'Server Version Disclosed', detail: `Server header: ${serverHeader}`, remediation: 'Remove or genericize Server header in web server config' });
  }

  const poweredBy = httpsResult.headers?.['x-powered-by'] || httpResult.headers?.['x-powered-by'];
  if (poweredBy) {
    findings.push({ severity: 'low', title: 'Technology Fingerprint Leaked', detail: `X-Powered-By: ${poweredBy}`, remediation: 'Remove X-Powered-By header' });
  }

  if (waf) {
    findings.push({ severity: 'info', title: `WAF Detected: ${waf}`, detail: `${waf} WAF signatures found in response`, remediation: 'Ensure WAF rules are current and tuned' });
  }

  return findings;
}
