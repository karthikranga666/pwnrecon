export function analyzeWithFallback(domain, reconData) {
  const { dns, tls, http, secHeaders, risk } = reconData;
  const attackVectors = [];
  const quickWins = [];
  const interesting = [];
  const tools = [];

  if (!dns?.emailSecurity?.spf?.present) {
    attackVectors.push(`Email spoofing via missing SPF — send phishing emails appearing from ${domain}`);
    tools.push(`swaks --to target@victim.com --from ceo@${domain} --server mail.${domain}`);
  }
  if (tls?.grade === 'C' || tls?.grade === 'F') {
    attackVectors.push(`TLS downgrade — ${tls?.protocol || 'weak protocol'} enables BEAST/POODLE on HTTPS traffic`);
    tools.push(`testssl.sh --protocols --ciphers ${domain}`);
  }
  if (!http?.httpsRedirect) {
    attackVectors.push(`HTTP SSLstrip — traffic interceptable before HTTPS upgrade`);
  }
  if (http?.openRedirect?.vulnerable) {
    attackVectors.push(`Open redirect at ${domain} — use for phishing and OAuth token theft`);
  }
  if (dns?.subdomains?.length > 0) {
    const adminSubs = (dns.subdomains || []).filter(s =>
      ['admin','login','jenkins','git','jira','backup'].some(k => s.subdomain?.includes(k))
    );
    if (adminSubs.length > 0) {
      attackVectors.push(`Sensitive subdomains: ${adminSubs.map(s => s.subdomain).join(', ')} — direct access to internal tools`);
    }
  }

  const missedHeaders = secHeaders?.results?.filter(r => r.status === 'fail') || [];
  if (missedHeaders.length > 0) {
    quickWins.push(`Test XSS — ${missedHeaders.length} security headers missing including CSP`);
    tools.push(`dalfox url https://${domain} --skip-bav`);
  }
  if (tls?.cert?.san?.length > 0) {
    quickWins.push(`Inspect cert SANs: ${tls.cert.san.slice(0, 3).join(', ')} — discover related infrastructure`);
  }
  if (http?.techStack?.length > 0) {
    quickWins.push(`Tech stack: ${http.techStack.map(t => t.name).join(', ')} — check CVEs`);
    tools.push(`nuclei -u https://${domain} -t vulnerabilities/ -severity high,critical`);
  }
  quickWins.push(`Full port scan to discover non-web services`);
  tools.push(`nmap -sV -sC -p- --min-rate 5000 ${domain}`);

  if (http?.waf) {
    interesting.push(`WAF: ${http.waf} — rate limiting active, use slow scan techniques`);
  }
  if (dns?.zoneTransfer?.vulnerable) {
    interesting.push(`Zone transfer VULNERABLE — full DNS zone exposed`);
    tools.push(`dig @ns1.${domain} ${domain} AXFR`);
  }
  if ((tls?.cert?.san?.length || 0) > 3) {
    interesting.push(`Cert covers ${tls.cert.san.length} domains — infrastructure reuse detected`);
  }
  if (!dns?.emailSecurity?.dmarc?.present && !dns?.emailSecurity?.spf?.present) {
    interesting.push(`No email auth (SPF + DMARC missing) — domain wide open for spoofing`);
  }
  if ((dns?.subdomains?.length || 0) > 20) {
    interesting.push(`Large attack surface: ${dns.subdomains.length} live subdomains — check subdomain takeover`);
    tools.push(`subjack -w subdomains.txt -t 100 -timeout 30 -ssl`);
  }

  tools.push(`nikto -h https://${domain}`);

  return {
    attackVectors: attackVectors.slice(0, 3),
    quickWins: quickWins.slice(0, 4),
    interesting: interesting.slice(0, 4),
    tools: [...new Set(tools)].slice(0, 6)
  };
}

export function chatWithFallback(message, context) {
  const domain = context?.domain || 'the target';
  const riskScore = context?.riskScore || 0;
  const msg = message.toLowerCase();

  if (msg.includes('test first') || msg.includes('start') || msg.includes('begin')) {
    return `Start passive: crt.sh, Shodan, DNS enum. Then active: nmap port scan, ffuf web fuzzing, nuclei vuln scan. Risk ${riskScore}/100 — ${riskScore > 60 ? 'critical findings first' : 'systematic sweep'}.`;
  }
  if (msg.includes('tls') || msg.includes('ssl') || msg.includes('cert')) {
    return `TLS testing on ${domain}: testssl.sh --full ${domain}. Check BEAST (TLS1.0+CBC), POODLE (SSL3), HEARTBLEED (OpenSSL). Grade below B = exploitable.`;
  }
  if (msg.includes('subdomain')) {
    return `Subdomain enum for ${domain}: subfinder + amass passive + crt.sh. Active: ffuf with SecLists. Takeover check: subjack or nuclei takeover templates. Priority: dev/staging/admin/jenkins.`;
  }
  if (msg.includes('checklist') || msg.includes('pentest')) {
    return `Pentest checklist for ${domain}: 1) Recon (DNS, certs, Shodan) 2) Network (nmap) 3) Web (nikto, nuclei, manual) 4) Auth 5) Business logic 6) API enum 7) Report. Risk ${riskScore}/100.`;
  }
  if (msg.includes('tool')) {
    return `Key tools for ${domain}: nmap, nuclei, ffuf, testssl.sh, amass, nikto, burpsuite. Quick install: go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`;
  }
  if (msg.includes('xss')) {
    return `XSS on ${domain}: dalfox url https://${domain} --deep-domxss --follow-redirects. Also check CSP — if missing, stored XSS impact is critical.`;
  }
  if (msg.includes('sql') || msg.includes('injection')) {
    return `SQLi on ${domain}: sqlmap -u "https://${domain}/?id=1" --dbs --level=3 --risk=2. Test all input fields manually with burpsuite first.`;
  }
  return `Analyzing ${domain} (risk: ${riskScore}/100). Ask about: TLS, subdomains, XSS, SQLi, API testing, or "pentest checklist".`;
}
