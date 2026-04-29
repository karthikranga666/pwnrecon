import { useState } from 'react';
import { motion } from 'framer-motion';

const SENSITIVE = ['admin','login','dev','staging','test','backup','internal','jenkins','git','jira','vpn','secure','panel','manage'];

export function SubdomainCard({ dns }) {
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  if (!dns || !dns.subdomains?.length) return null;

  const subdomains = dns.subdomains || [];
  const sensitive = subdomains.filter(s => SENSITIVE.some(k => s.subdomain?.includes(k)));
  const displayed = filter === 'sensitive' ? sensitive : subdomains;

  const copyAll = () => {
    const text = subdomains.map(s => s.subdomain).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase">Subdomains</div>
          <div className="font-mono text-xs text-text-muted mt-0.5">
            {subdomains.length} live
            {sensitive.length > 0 && <span style={{ color: '#FFB800' }}> · {sensitive.length} sensitive</span>}
          </div>
        </div>
        <button
          onClick={copyAll}
          className="font-mono text-xs px-3 py-1.5 rounded transition-all"
          style={{
            background: copied ? 'rgba(0,255,136,0.1)' : 'rgba(28,35,51,0.5)',
            border: `1px solid ${copied ? 'rgba(0,255,136,0.3)' : '#1C2333'}`,
            color: copied ? '#00FF88' : '#7D8590'
          }}
        >
          {copied ? '✓ COPIED' : 'COPY ALL'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-3">
        {[['all', 'All'], ['sensitive', 'Sensitive']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className="font-mono text-xs px-3 py-1 rounded transition-all"
            style={{
              background: filter === val ? 'rgba(0,255,136,0.08)' : 'transparent',
              color: filter === val ? '#00FF88' : '#7D8590',
              border: `1px solid ${filter === val ? 'rgba(0,255,136,0.25)' : '#1C2333'}`
            }}
          >
            {label}
            {val === 'sensitive' && sensitive.length > 0 && (
              <span className="ml-1.5 px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,184,0,0.2)', color: '#FFB800' }}>
                {sensitive.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="max-h-64 scrollable space-y-1">
        {displayed.map((s, i) => {
          const isSensitive = SENSITIVE.some(k => s.subdomain?.includes(k));
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 px-3 py-2 rounded font-mono text-xs"
              style={{
                background: isSensitive ? 'rgba(255,184,0,0.05)' : 'rgba(28,35,51,0.3)',
                border: `1px solid ${isSensitive ? 'rgba(255,184,0,0.2)' : '#1C2333'}`
              }}
            >
              <span className="flex-1 truncate" style={{ color: isSensitive ? '#FFB800' : '#E6EDF3' }}>
                {isSensitive && <span className="mr-1">★</span>}
                {s.subdomain}
              </span>
              <span className="text-text-muted flex-shrink-0">{s.ips?.[0] || '?'}</span>
              {isSensitive && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.25)' }}>
                  SENSITIVE
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Zone transfer result */}
      {dns.zoneTransfer && (
        <div className="mt-3 p-2.5 rounded font-mono text-xs" style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}>
          <span className="text-text-muted">Zone Transfer (AXFR): </span>
          <span style={{ color: dns.zoneTransfer.vulnerable ? '#FF4444' : '#00CC6A' }}>
            {dns.zoneTransfer.vulnerable ? '⚠ VULNERABLE' : '✓ SECURE'}
          </span>
        </div>
      )}
    </motion.div>
  );
}
