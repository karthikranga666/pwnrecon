export function analyzeWithFallback(domain, reconData) {
  const { dns, tls, http, secHeaders, risk } = reconData;
  const attackVectors = [];
  const quickWins = [];
  const interesting = [];
  const tools = [];

  // Attack vectors
  if (!dns?.emailSecurity?.spf?.present) {
    attackVectors.push(`Email spoofing via missing SPF — send phishing emails appearing to come from ${domain}`);
    tools.push(`swaks --to target@company.com --from ceo@${domain} --server mail.${domain}`);
  }
  if (tls?.grade === 'C' || tls?.grade === 'F') {
    attackVectors.push(`TLS downgrade — ${tls?.protocol || 'weak protocol'} enables BEAST/POODLE attacks on HTTPS traffic`);
    tools.push(`testssl.sh --protocols --ciphers ${domain}`);
  }
  if (!http?.httpsRedirect) {
    attackVectors.push(`HTTP SSLstrip attack — traffic can be intercepted before HTTPS upgrade`);
    tools.push(`sslstrip -l 8080 && arpspoof -i eth0 -t <target-ip> <gateway-ip>`);
  }
  if (http?.openRedirect?.vulnerable) {
    attackVectors.push(`Open redirect at ${domain} — use for phishing and OAuth token theft`);
  }
  if (dns?.subdomains?.length > 0) {
    const adminSubs = dns.subdomains.filter(s =>
      ['admin','login','jenkins','git','jira','backup'].some(k => s.subdomain?.includes(k))
    );
    if (adminSubs.length > 0) {
      attackVectors.push(`Sensitive subdomains exposed: ${adminSubs.map(s => s.subdomain).join(', ')} — direct access to internal tools`);
    }
  }

  // Quick wins
  const missedHeaders = secHeaders?.results?.filter(r => r.status === 'fail') || [];
  if (missedHeaders.length > 0) {
    quickWins.push(`Test for XSS — CSP and X-Frame-Options missing, ${missedHeaders.length} security headers absent`);
    tools.push(`dalfox url https://${domain} --skip-bav`);
  }
  if (tls?.cert) {
    quickWins.push(`Inspect TLS cert SANs: ${tls.cert.san?.slice(0, 5).join(', ')} — discover related domains/infrastructure`);
  }
  if (http?.techStack?.length > 0) {
    const tech = http.techStack.map(t => t.name).join(', ');
    quickWins.push(`Technology stack identified (${tech}) — check for known CVEs`);
    tools.push(`nuclei -u https://${domain} -t vulnerabilities/ -severity high,critical`);
  }
  quickWins.push(`Run full port scan to discover non-web services`);
  tools.push(`nmap -sV -sC -p- --min-rate 5000 ${domain}`);

  // Interesting findings
  if (http?.waf) {
    interesting.push(`WAF detected: ${http.waf} — enumeration may be rate limited, use slow scan techniques`);
  }
  if (dns?.zoneTransfer?.vulnerable) {
    interesting.push(`Zone transfer VULNERABLE — full DNS zone exposed`);
    tools.push(`dig @ns1.${domain} ${domain} AXFR`);
  }
  if (tls?.cert?.san?.length > 3) {
    interesting.push(`Certificate covers ${tls.cert.san.length} domains (SANs) — infrastructure reuse detected`);
  }
  if (!dns?.emailSecurity?.dmarc?.present && !dns?.emailSecurity?.spf?.present) {
    interesting.push(`No email authentication (SPF + DMARC missing) — domain wide open for spoofing`);
  }
  if (dns?.subdomains?.length > 20) {
    interesting.push(`Large attack surface: ${dns.subdomains.length} live subdomains — check for subdomain takeover via dangling CNAMEs`);
    tools.push(`subjack -w subdomains.txt -t 100 -timeout 30 -o results.txt -ssl`);
  }

  // Fallback tool commands
  tools.push(`whatweb https://${domain}`);
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
    return `Start with passive recon on ${domain}: cert transparency (crt.sh), Shodan, DNS enumeration. Then active: port scan with nmap, web fuzzing with ffuf, vulnerability scan with nuclei. Risk score ${riskScore}/100 — ${riskScore > 60 ? 'high priority, focus on critical findings first' : 'moderate risk, systematic approach works'}.`;
  }
  if (msg.includes('tls') || msg.includes('ssl') || msg.includes('cert')) {
    return `For TLS testing on ${domain}: use testssl.sh for comprehensive protocol/cipher analysis. Check for BEAST (CBC ciphers + TLS 1.0), POODLE (SSL 3.0), DROWN (SSLv2), HEARTBLEED (OpenSSL). Run: testssl.sh --full ${domain}`;
  }
  if (msg.includes('subdomain')) {
    return `Subdomain enumeration for ${domain}: combine passive (subfinder, amass passive, crt.sh) with active (ffuf with SecLists). Check for takeover: subjack or nuclei takeover templates. Priority targets: dev/staging/admin/jenkins subdomains.`;
  }
  if (msg.includes('checklist') || msg.includes('pentest')) {
    return `Pentest checklist for ${domain}: 1) Recon (DNS, certs, Shodan) 2) Network (nmap full port) 3) Web (nikto, nuclei, manual) 4) Auth testing 5) Business logic 6) API enumeration 7) Report. Risk score ${riskScore}/100 — allocate time accordingly.`;
  }
  if (msg.includes('tools') || msg.includes('what tool')) {
    return `Key tools for ${domain}: nmap (ports), nuclei (vulns), ffuf (fuzzing), testssl.sh (TLS), amass (subdomains), nikto (web scan), burpsuite (manual). Install all: sudo apt install nmap nikto && go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`;
  }
  if (msg.includes('xss')) {
    return `XSS testing on ${domain}: use dalfox for automated scanning. Check if CSP is present and configured. Try: dalfox url https://${domain} --deep-domxss --follow-redirects`;
  }
  if (msg.includes('sql') || msg.includes('injection')) {
    return `SQLi testing on ${domain}: sqlmap for automated detection. Try: sqlmap -u "https://${domain}/?id=1" --dbs --level=3 --risk=2. Also test with burpsuite's scanner and manual payloads in all input fields.`;
  }

  return `Analyzing ${domain} (risk: ${riskScore}/100). For specific guidance ask about: TLS testing, subdomain enumeration, XSS, SQL injection, API testing, or "generate pentest checklist".`;
}
