const SEVERITY_WEIGHTS = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

function scoreFromFindings(findings) {
  let score = 0;
  for (const f of findings) {
    score += SEVERITY_WEIGHTS[f.severity] || 0;
  }
  return Math.min(100, score);
}

function categorize(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Info';
}

export function runRisk({ dns, tls, http, secHeaders, ports }) {
  const allFindings = [
    ...(dns?.findings || []),
    ...(tls?.findings || []),
    ...(http?.findings || []),
    ...(secHeaders?.findings || []),
    ...(ports?.findings || [])
  ];

  const score = scoreFromFindings(allFindings);
  const category = categorize(score);

  const sortOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...allFindings].sort((a, b) => (sortOrder[a.severity] || 9) - (sortOrder[b.severity] || 9));

  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allFindings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  const attackSurface = buildAttackSurface({ dns, tls, http, secHeaders, allFindings });

  return {
    score,
    category,
    counts,
    findings: sorted,
    attackSurface,
    total: allFindings.length
  };
}

function buildAttackSurface({ dns, tls, http, secHeaders, allFindings }) {
  const vectors = [];

  if (dns?.subdomains?.length > 0) {
    vectors.push(`${dns.subdomains.length} subdomains discovered`);
  }
  if (!dns?.emailSecurity?.spf?.present) {
    vectors.push('Email spoofing possible (no SPF)');
  }
  if (tls?.grade === 'F' || tls?.grade === 'C') {
    vectors.push(`Weak TLS configuration (grade ${tls.grade})`);
  }
  if (!http?.httpsRedirect) {
    vectors.push('HTTP downgrade attack surface');
  }
  if (http?.openRedirect?.vulnerable) {
    vectors.push('Open redirect vulnerability');
  }
  if (secHeaders?.score < 50) {
    vectors.push('Missing critical security headers');
  }

  const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
  const highCount = allFindings.filter(f => f.severity === 'high').length;

  return {
    vectors,
    summary: `${criticalCount} critical, ${highCount} high severity issues across ${vectors.length} attack vectors`
  };
}
