import axios from 'axios';

const SECURITY_HEADERS = [
  {
    name: 'Strict-Transport-Security',
    key: 'strict-transport-security',
    description: 'Forces HTTPS connections',
    remediation: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    check(value) {
      if (!value) return { status: 'fail', detail: 'Missing' };
      const maxAge = parseInt((value.match(/max-age=(\d+)/) || [])[1] || '0');
      if (maxAge < 31536000) return { status: 'warn', detail: `max-age too low: ${maxAge}s (need ≥31536000)` };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Content-Security-Policy',
    key: 'content-security-policy',
    description: 'Prevents XSS and injection attacks',
    remediation: "Add CSP header: Content-Security-Policy: default-src 'self'; script-src 'self'",
    check(value) {
      if (!value) return { status: 'fail', detail: 'Missing' };
      const issues = [];
      if (value.includes("'unsafe-inline'")) issues.push("unsafe-inline present");
      if (value.includes("'unsafe-eval'")) issues.push("unsafe-eval present");
      if (value.includes('*')) issues.push("wildcard source present");
      if (issues.length) return { status: 'warn', detail: `Weak CSP: ${issues.join(', ')}` };
      return { status: 'pass', detail: 'CSP configured' };
    }
  },
  {
    name: 'X-Frame-Options',
    key: 'x-frame-options',
    description: 'Prevents clickjacking attacks',
    remediation: 'Add: X-Frame-Options: DENY (or use CSP frame-ancestors)',
    check(value) {
      if (!value) return { status: 'fail', detail: 'Missing — clickjacking possible' };
      if (!['DENY','SAMEORIGIN'].includes(value.toUpperCase().trim())) {
        return { status: 'warn', detail: `Non-standard value: ${value}` };
      }
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'X-Content-Type-Options',
    key: 'x-content-type-options',
    description: 'Prevents MIME sniffing',
    remediation: 'Add: X-Content-Type-Options: nosniff',
    check(value) {
      if (!value) return { status: 'fail', detail: 'Missing' };
      if (value.toLowerCase() !== 'nosniff') return { status: 'warn', detail: `Expected nosniff, got: ${value}` };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Referrer-Policy',
    key: 'referrer-policy',
    description: 'Controls referrer information leakage',
    remediation: 'Add: Referrer-Policy: strict-origin-when-cross-origin',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing — default browser behavior' };
      const safe = ['no-referrer','no-referrer-when-downgrade','strict-origin','strict-origin-when-cross-origin','same-origin'];
      if (!safe.includes(value.toLowerCase())) return { status: 'warn', detail: `Leaky policy: ${value}` };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Permissions-Policy',
    key: 'permissions-policy',
    description: 'Controls browser feature access',
    remediation: 'Add: Permissions-Policy: camera=(), microphone=(), geolocation=()',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing — all browser features permitted' };
      return { status: 'pass', detail: 'Configured' };
    }
  },
  {
    name: 'X-XSS-Protection',
    key: 'x-xss-protection',
    description: 'Legacy XSS filter (informational)',
    remediation: 'Add: X-XSS-Protection: 1; mode=block (legacy, use CSP instead)',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing (legacy but useful for old browsers)' };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Cache-Control',
    key: 'cache-control',
    description: 'Controls sensitive data caching',
    remediation: 'For sensitive pages: Cache-Control: no-store, no-cache, must-revalidate',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing — sensitive data may be cached' };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    key: 'cross-origin-opener-policy',
    description: 'Isolates browsing context',
    remediation: 'Add: Cross-Origin-Opener-Policy: same-origin',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing — cross-origin attacks possible' };
      return { status: 'pass', detail: value };
    }
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    key: 'cross-origin-resource-policy',
    description: 'Prevents cross-origin resource reads',
    remediation: 'Add: Cross-Origin-Resource-Policy: same-origin',
    check(value) {
      if (!value) return { status: 'warn', detail: 'Missing' };
      return { status: 'pass', detail: value };
    }
  }
];

function generateRemediationConfig(results) {
  const failed = results.filter(r => r.status === 'fail' || r.status === 'warn');
  if (failed.length === 0) return null;

  const nginx = failed.map(r => `add_header ${r.name} "${r.recommended}";`).join('\n');
  const apache = failed.map(r => `Header always set ${r.name} "${r.recommended}"`).join('\n');

  return { nginx, apache };
}

export async function runHeaders(domain) {
  let headers = {};
  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 10000,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PwnRecon/1.0)' }
    });
    headers = resp.headers;
  } catch (e) {
    try {
      const resp = await axios.get(`http://${domain}`, {
        timeout: 10000,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PwnRecon/1.0)' }
      });
      headers = resp.headers;
    } catch {
      return { error: 'Could not fetch headers', results: [], score: 0 };
    }
  }

  const results = SECURITY_HEADERS.map(hdr => {
    const value = headers[hdr.key] || null;
    const check = hdr.check(value);
    return {
      name: hdr.name,
      key: hdr.key,
      description: hdr.description,
      value,
      status: check.status,
      detail: check.detail,
      remediation: hdr.remediation,
      recommended: hdr.remediation.split(': ').slice(1).join(': ')
    };
  });

  const passed = results.filter(r => r.status === 'pass').length;
  const score = Math.round((passed / results.length) * 100);

  const findings = results
    .filter(r => r.status === 'fail')
    .map(r => ({ severity: 'medium', title: `Missing: ${r.name}`, detail: r.detail, remediation: r.remediation }));

  return {
    results,
    score,
    passed,
    total: results.length,
    remediationConfig: generateRemediationConfig(results),
    findings
  };
}
