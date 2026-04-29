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
    lines.push(`TLS: Grade ${tls.grade || 'N/A'} | Protocol: ${tls.protocol || 'unknown'} | Cipher: ${tls.cipher?.name || 'unknown'} | Expires in: ${tls.cert?.daysRemaining ?? 'N/A'} days | Self-signed: ${tls.cert?.selfSigned ? 'YES' : 'no'}`);
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
    const openNums = new Set(open.map(p => p.port));

    // All 27 ports that were probed
    const ALL_SCANNED = [
      [21,'FTP'],[22,'SSH'],[23,'Telnet'],[25,'SMTP'],[53,'DNS'],[80,'HTTP'],
      [110,'POP3'],[143,'IMAP'],[443,'HTTPS'],[445,'SMB'],[587,'SMTP/TLS'],
      [993,'IMAPS'],[995,'POP3S'],[1433,'MSSQL'],[2222,'SSH-alt'],[3000,'Dev/Node'],
      [3306,'MySQL'],[3389,'RDP'],[4443,'HTTPS-alt'],[5432,'PostgreSQL'],[5900,'VNC'],
      [6379,'Redis'],[8080,'HTTP-alt'],[8443,'HTTPS-alt'],[8888,'HTTP-alt'],
      [9200,'Elasticsearch'],[27017,'MongoDB']
    ];

    const openList = open.map(p => {
      let entry = `${p.port}/${p.service}`;
      if (p.software && p.software !== p.service) entry += ` (${p.software}`;
      else if (p.software) entry += ` (${p.software}`;
      else entry += ' (';
      if (p.version) entry += ` ${p.version}`;
      if (p.poweredBy) entry += `, powered-by: ${p.poweredBy}`;
      entry += ')';
      if (p.httpStatus) entry += ` [HTTP ${p.httpStatus}]`;
      return entry.replace(' ()', '');
    }).join(', ');
    const closedList = ALL_SCANNED.filter(([p]) => !openNums.has(p)).map(([p, s]) => `${p}/${s}`).join(', ');

    lines.push(`Ports scanned: ${ports.total} total`);
    lines.push(`OPEN ports: ${open.length > 0 ? openList : 'none'}`);
    lines.push(`CLOSED/filtered ports: ${closedList}`);

    const risky = open.filter(p => [21,23,445,1433,3306,3389,5432,5900,6379,9200,27017].includes(p.port));
    if (risky.length) lines.push(`Risky open ports: ${risky.map(p => `${p.port}/${p.service}`).join(', ')}`);
  }
  if (risk?.findings?.length) {
    const top = risk.findings.slice(0, 5).map(f => `[${f.severity.toUpperCase()}] ${f.title}`);
    lines.push(`Findings: ${top.join(' | ')}`);
  }

  return lines.join('\n');
}

const GENERAL_QUESTION = /^what (is|are|does|do)|^explain|^define|^how does|^tell me about|^describe/i;

export function buildChatPrompt(message, context) {
  const isGeneral = GENERAL_QUESTION.test(message.trim()) && !/my|this site|the scan|the target|theaegis|finding|result/i.test(message);

  if (isGeneral) {
    return `User question: ${message}\n\nAnswer from your security knowledge. Be concise, under 100 words.`;
  }

  return `Scan data for target:

${buildScanContext(context)}

User question: ${message}

Answer using the scan data above. Trust the scan values exactly — do not contradict them. Be direct and concise. Under 200 words.`;
}
