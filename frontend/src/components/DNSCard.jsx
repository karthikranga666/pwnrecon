import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INTERESTING_KEYWORDS = ['admin','login','dev','staging','test','backup','internal','jenkins','git','jira','vpn','secure'];

function Badge({ ok, label }) {
  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded ${ok ? 'badge-pass' : 'badge-fail'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function RecordRow({ type, records, delay }) {
  if (!records) return null;

  // Normalize everything to a flat array of displayable items
  const arr = Array.isArray(records) ? records : [records];
  if (arr.length === 0) return null;
  const flat = arr.flatMap(r => Array.isArray(r) ? r : [r]);
  if (flat.length === 0) return null;

  const display = (r) => {
    if (typeof r === 'object' && r !== null) return JSON.stringify(r);
    return String(r);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-start gap-3 py-1.5 border-b font-mono text-xs"
      style={{ borderColor: '#1C2333' }}
    >
      <span className="flex-shrink-0 w-12 font-semibold" style={{ color: '#4D9FFF' }}>{type}</span>
      <div className="flex-1 space-y-0.5">
        {flat.slice(0, 5).map((r, i) => (
          <div key={i} className="text-text-primary break-all">{display(r)}</div>
        ))}
        {flat.length > 5 && <div className="text-text-muted">+{flat.length - 5} more</div>}
      </div>
    </motion.div>
  );
}

export function DNSCard({ dns }) {
  const [showAll, setShowAll] = useState(false);
  if (!dns) return null;
  if (dns.error) return (
    <div className="rounded-lg p-5 card-red" style={{ background: '#0D1117' }}>
      <div className="font-mono text-xs text-red">DNS Error: {dns.error}</div>
    </div>
  );

  const subdomains = dns.subdomains || [];
  const interesting = subdomains.filter(s => INTERESTING_KEYWORDS.some(k => s.subdomain?.includes(k)));
  const visible = showAll ? subdomains : subdomains.slice(0, 8);
  const recordTypes = ['A','AAAA','MX','NS','TXT','SOA','CAA'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase">DNS Recon</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-muted">{subdomains.length} subdomains</span>
        </div>
      </div>

      {/* Email security badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge ok={dns.emailSecurity?.spf?.present} label="SPF" />
        <Badge ok={dns.emailSecurity?.dmarc?.present} label="DMARC" />
        <Badge ok={dns.emailSecurity?.dkim?.present} label="DKIM" />
        <span className={`font-mono text-xs px-2 py-0.5 rounded ${dns.zoneTransfer?.vulnerable ? 'badge-fail' : 'badge-pass'}`}>
          {dns.zoneTransfer?.vulnerable ? '⚠ AXFR VULN' : '✓ AXFR SECURE'}
        </span>
      </div>

      {/* DNS Records */}
      <div className="mb-4 rounded p-3" style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}>
        <div className="font-mono text-xs text-text-muted mb-2 uppercase tracking-wider">Records</div>
        {recordTypes.map((type, i) => (
          <RecordRow key={type} type={type} records={dns.records?.[type]} delay={i * 0.06} />
        ))}
      </div>

      {/* Subdomains */}
      {subdomains.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-xs text-text-muted uppercase tracking-wider">
              Subdomains {interesting.length > 0 && <span style={{ color: '#FFB800' }}>({interesting.length} sensitive)</span>}
            </div>
            <button
              onClick={() => {
                const text = subdomains.map(s => `${s.subdomain} → ${s.ips?.join(', ')}`).join('\n');
                navigator.clipboard.writeText(text);
              }}
              className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              COPY ALL
            </button>
          </div>
          <div className="space-y-1 max-h-48 scrollable">
            {visible.map((s, i) => {
              const isInteresting = INTERESTING_KEYWORDS.some(k => s.subdomain?.includes(k));
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-3 py-1.5 rounded font-mono text-xs"
                  style={{
                    background: isInteresting ? 'rgba(255,184,0,0.06)' : 'rgba(28,35,51,0.3)',
                    border: `1px solid ${isInteresting ? 'rgba(255,184,0,0.2)' : '#1C2333'}`
                  }}
                >
                  <span style={{ color: isInteresting ? '#FFB800' : '#E6EDF3' }}>{s.subdomain}</span>
                  <span className="text-text-muted">{s.ips?.[0] || '?'}</span>
                </motion.div>
              );
            })}
          </div>
          {subdomains.length > 8 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="mt-2 w-full font-mono text-xs text-text-muted hover:text-green transition-colors text-center py-1"
            >
              {showAll ? '▲ SHOW LESS' : `▼ SHOW ALL ${subdomains.length}`}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
