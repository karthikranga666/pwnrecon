export function buildAnalysisPrompt(domain, reconData) {
  const summary = {
    domain,
    subdomains: reconData.dns?.subdomains?.length || 0,
    tlsGrade: reconData.tls?.grade,
    httpsRedirect: reconData.http?.httpsRedirect,
    waf: reconData.http?.waf,
    headerScore: reconData.secHeaders?.score,
    spf: reconData.dns?.emailSecurity?.spf?.present,
    dmarc: reconData.dns?.emailSecurity?.dmarc?.present,
    openRedirect: reconData.http?.openRedirect?.vulnerable,
    riskScore: reconData.risk?.score,
    criticalFindings: reconData.risk?.findings?.filter(f => f.severity === 'critical').map(f => f.title) || [],
    highFindings: reconData.risk?.findings?.filter(f => f.severity === 'high').map(f => f.title) || []
  };

  return `You are a senior penetration tester. Analyze this recon data for ${domain}:

${JSON.stringify(summary, null, 2)}

Provide ONLY valid JSON (no markdown, no explanation):
{
  "attackVectors": ["specific exploitable path 1", "specific exploitable path 2", "specific exploitable path 3"],
  "quickWins": ["quick test 1", "quick test 2", "quick test 3"],
  "interesting": ["anomaly 1", "anomaly 2"],
  "tools": ["nmap -sV ${domain}", "nuclei -u https://${domain}"]
}

Be technical, specific, actionable. Include actual domain in tool commands.`;
}

export function buildScanContext(context) {
  if (!context?.scanData) {
    return `Target: ${context?.domain || 'unknown'}. Risk: ${context?.riskScore ?? 'N/A'}/100. No scan data available yet.`;
  }

  const { domain, modules, risk } = context.scanData;
  const dns = modules?.dns;
  const tls = modules?.tls;
  const http = modules?.http;
  const headers = modules?.secHeaders;
  const ports = modules?.ports;

  const scannedModules = [dns && 'DNS', tls && 'TLS', http && 'HTTP', headers && 'SecurityHeaders', ports && 'Ports'].filter(Boolean).join(', ');
  const notScanned = ['application logic', 'databases', !ports && 'SSH/services'].filter(Boolean).join(', ');
  const lines = [
    `Target: ${domain} | Risk score: ${risk?.score}/100 (${risk?.category})`,
    `Scanned modules: ${scannedModules}. NOT scanned: ${notScanned}.`
  ];

  if (dns) {
    lines.push(`DNS: ${dns.subdomains?.length || 0} live subdomains | SPF: ${dns.emailSecurity?.spf?.present ? 'present' : 'MISSING'} | DMARC: ${dns.emailSecurity?.dmarc?.present ? 'present' : 'MISSING'} | DKIM: ${dns.emailSecurity?.dkim?.present ? 'present' : 'MISSING'}`);
    const sensitive = (dns.subdomains || []).filter(s =>
      ['admin','login','dev','staging','jenkins','git','backup','vpn','internal'].some(k => s.subdomain?.includes(k))
    );
    if (sensitive.length) lines.push(`Sensitive subdomains: ${sensitive.map(s => s.subdomain).join(', ')}`);
  }
  if (tls) {
    lines.push(`TLS: Grade ${tls.grade || 'N/A'} | Protocol: ${tls.protocol || 'unknown'} | Cipher: ${tls.cipher?.name || 'unknown'} | Expires in: ${tls.cert?.daysRemaining ?? 'N/A'} days | Certificate: ${tls.cert?.selfSigned ? 'SELF-SIGNED (untrusted)' : 'valid CA-signed (trusted)'}`);
  }
  if (http) {
    lines.push(`HTTP: HTTPS redirect: ${http.httpsRedirect ? 'yes' : 'NO'} | WAF: ${http.waf || 'none detected'} | Open redirect: ${http.openRedirect?.vulnerable ? 'VULNERABLE' : 'no'} | Server: ${http.server || 'hidden'} | Tech: ${http.techStack?.map(t => t.name).join(', ') || 'none detected'}`);
  }
  if (headers) {
    const failed = (headers.results || []).filter(r => r.status === 'fail').map(r => r.name);
    lines.push(`Security headers: score ${headers.score}/100 | Missing: ${failed.length ? failed.join(', ') : 'none'}`);
  }
  if (ports) {
    const open = ports.open || [];
    const openList = open.map(p => {
      let entry = `${p.port}/${p.service}`;
      if (p.software && p.software !== p.service) entry += ` (${p.software}${p.version ? ' ' + p.version : ''})`;
      else if (p.version) entry += ` (${p.version})`;
      if (p.httpStatus) entry += ` HTTP:${p.httpStatus}`;
      return entry;
    }).join(', ');

    lines.push(`Port scan: ${ports.total} ports checked. Only these are OPEN: ${open.length > 0 ? openList : 'none — all ports closed'}. All other ports are closed/filtered.`);

    const risky = open.filter(p => [21,23,445,1433,3306,3389,5432,5900,6379,9200,27017].includes(p.port));
    if (risky.length) lines.push(`Dangerous open ports: ${risky.map(p => `${p.port}/${p.service}`).join(', ')}`);
  }
  if (risk?.findings?.length) {
    const top = risk.findings.slice(0, 5).map(f => `[${f.severity.toUpperCase()}] ${f.title}`);
    lines.push(`Findings: ${top.join(' | ')}`);
  }

  return lines.join('\n');
}

export function buildChatPrompt(message, context) {
  const scanContext = buildScanContext(context);
  const { domain, modules, risk } = context?.scanData || {};

  // Pull key facts to remind model what's real
  const facts = [];
  if (domain) facts.push(`Target domain: ${domain}`);
  if (modules?.ports?.open?.length > 0)
    facts.push(`Open ports: ${modules.ports.open.map(p => `${p.port}/${p.service}`).join(', ')}`);
  if (modules?.ports?.open?.length === 0)
    facts.push(`Open ports: none — all 27 ports closed`);
  if (modules?.http?.httpsRedirect === false) facts.push(`No HTTPS redirect (HTTP port 80 unprotected)`);
  if (modules?.http?.openRedirect?.vulnerable) facts.push(`Open redirect: VULNERABLE`);
  if (modules?.tls?.grade) facts.push(`TLS grade: ${modules.tls.grade} (${modules.tls.protocol})`);
  if (modules?.tls?.cert?.selfSigned === false) facts.push(`TLS certificate: CA-signed (not self-signed)`);
  if (!modules?.dns?.emailSecurity?.spf?.present) facts.push(`SPF: missing`);
  if (!modules?.dns?.emailSecurity?.dmarc?.present) facts.push(`DMARC: missing`);

  return `Scan data:
${scanContext}

Confirmed facts about ${domain || 'this target'}:
${facts.map(f => `- ${f}`).join('\n')}

Question: ${message}

Answer using ONLY the confirmed facts above. Reference the actual domain name and real values. Do not invent data.`;
}
