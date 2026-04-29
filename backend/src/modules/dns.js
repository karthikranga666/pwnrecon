import dns from 'dns/promises';

const SUBDOMAINS = [
  'www','api','dev','staging','admin','vpn','mail','smtp','cdn','assets',
  'portal','login','auth','app','beta','prod','test','old','backup','git',
  'jenkins','ci','jira','confluence','s3','bucket','upload','media','img',
  'docs','help','support','blog','shop','store','pay','payment','secure',
  'internal','intranet','corp','office','remote','monitor','status',
  'dashboard','panel','manage','ftp','ssh','ns1','ns2','mx','webmail',
  'cpanel','whm','plesk','autodiscover','autoconfig','imap','pop','pop3'
];

async function resolveRecord(domain, type) {
  try {
    const result = await dns.resolve(domain, type);
    return { type, records: result, error: null };
  } catch (e) {
    return { type, records: [], error: e.code };
  }
}

async function checkSubdomain(subdomain, domain) {
  const fqdn = `${subdomain}.${domain}`;
  try {
    const addrs = await dns.resolve4(fqdn);
    return { subdomain: fqdn, ips: addrs, alive: true };
  } catch {
    return null;
  }
}

async function checkZoneTransfer(domain) {
  try {
    const nsRecords = await dns.resolveNs(domain);
    const results = [];
    for (const ns of nsRecords.slice(0, 3)) {
      try {
        // AXFR attempt via raw resolution — Node doesn't natively support AXFR
        // We try resolving with the specific NS and catch EREFUSED/ECONNREFUSED
        await dns.resolve(domain, 'ANY');
        results.push({ ns, vulnerable: false, note: 'AXFR not supported via standard DNS' });
      } catch (e) {
        results.push({ ns, vulnerable: false, note: e.code });
      }
    }
    return { attempted: true, results, vulnerable: false };
  } catch {
    return { attempted: false, results: [], vulnerable: false };
  }
}

function checkSPF(txtRecords) {
  const flat = txtRecords.flat();
  return flat.some(r => r.startsWith('v=spf1'));
}

function checkDMARC(domain) {
  return dns.resolve(`_dmarc.${domain}`, 'TXT')
    .then(r => ({ present: true, record: r.flat().join('') }))
    .catch(() => ({ present: false, record: null }));
}

function checkDKIM(domain) {
  const selectors = ['default','google','mail','smtp','k1','selector1','selector2'];
  return Promise.allSettled(
    selectors.map(s =>
      dns.resolve(`${s}._domainkey.${domain}`, 'TXT')
        .then(r => ({ selector: s, present: true, record: r.flat().join('') }))
        .catch(() => ({ selector: s, present: false }))
    )
  ).then(results => {
    const found = results.filter(r => r.status === 'fulfilled' && r.value.present).map(r => r.value);
    return { present: found.length > 0, selectors: found };
  });
}

export async function runDNS(domain) {
  const recordTypes = ['A','AAAA','MX','NS','TXT','SOA','CAA'];

  const [recordResults, subdomainResults] = await Promise.all([
    Promise.all(recordTypes.map(t => resolveRecord(domain, t))),
    Promise.allSettled(SUBDOMAINS.map(s => checkSubdomain(s, domain)))
  ]);

  const records = {};
  for (const r of recordResults) {
    records[r.type] = r.records;
  }

  const txtRecords = records['TXT'] || [];
  const [zoneTransfer, dmarc, dkim] = await Promise.all([
    checkZoneTransfer(domain),
    checkDMARC(domain),
    checkDKIM(domain)
  ]);

  const subdomains = subdomainResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  return {
    domain,
    records,
    subdomains,
    emailSecurity: {
      spf: { present: checkSPF(txtRecords), record: txtRecords.flat().find(r => r.startsWith('v=spf1')) || null },
      dmarc,
      dkim
    },
    zoneTransfer,
    findings: generateDNSFindings({ records, subdomains, emailSecurity: { spf: { present: checkSPF(txtRecords) }, dmarc, dkim }, zoneTransfer })
  };
}

function generateDNSFindings({ records, subdomains, emailSecurity, zoneTransfer }) {
  const findings = [];

  if (!emailSecurity.spf.present) {
    findings.push({ severity: 'high', title: 'No SPF Record', detail: 'Domain has no SPF record — email spoofing possible', remediation: 'Add TXT record: "v=spf1 include:_spf.google.com ~all"' });
  }
  if (!emailSecurity.dmarc.present) {
    findings.push({ severity: 'high', title: 'No DMARC Record', detail: 'No DMARC policy — phishing protection absent', remediation: 'Add TXT record at _dmarc: "v=DMARC1; p=reject; rua=mailto:dmarc@domain.com"' });
  }
  if (!emailSecurity.dkim.present) {
    findings.push({ severity: 'medium', title: 'No DKIM Found', detail: 'No DKIM selectors found — email integrity unverified', remediation: 'Configure DKIM with your email provider' });
  }
  if (subdomains.length > 10) {
    findings.push({ severity: 'info', title: `${subdomains.length} Subdomains Discovered`, detail: 'Large attack surface — check for subdomain takeover', remediation: 'Audit all subdomains, remove dangling CNAMEs' });
  }

  const interestingSubdomains = subdomains.filter(s =>
    ['admin','login','dev','staging','test','backup','internal','jenkins','git','jira'].some(k => s.subdomain.includes(k))
  );
  if (interestingSubdomains.length > 0) {
    findings.push({ severity: 'medium', title: 'Sensitive Subdomains Exposed', detail: `Found: ${interestingSubdomains.map(s => s.subdomain).join(', ')}`, remediation: 'Restrict access to internal tooling, add auth' });
  }

  return findings;
}
