import { useState } from 'react';
import { motion } from 'framer-motion';

const STATUS_ICON = { pass: '✓', warn: '◐', fail: '✗' };
const STATUS_CLASS = { pass: 'badge-pass', warn: 'badge-warn', fail: 'badge-fail' };

export function HeadersCard({ secHeaders }) {
  const [copied, setCopied] = useState(null);
  if (!secHeaders) return null;
  if (secHeaders.error) return (
    <div className="rounded-lg p-5 card-red" style={{ background: '#0D1117' }}>
      <div className="font-mono text-xs text-red">{secHeaders.error}</div>
    </div>
  );

  const copyConfig = (type) => {
    const cfg = secHeaders.remediationConfig?.[type];
    if (!cfg) return;
    navigator.clipboard.writeText(cfg).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const scoreColor = secHeaders.score >= 80 ? '#00FF88' : secHeaders.score >= 50 ? '#FFB800' : '#FF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase">Security Headers</div>
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm font-bold" style={{ color: scoreColor }}>
            {secHeaders.passed}/{secHeaders.total}
          </div>
          <div className="w-24 h-1.5 rounded-full" style={{ background: '#1C2333' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${secHeaders.score}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ background: scoreColor }}
            />
          </div>
        </div>
      </div>

      {/* Headers grid */}
      <div className="space-y-1.5 mb-4">
        {(secHeaders.results || []).map((h, i) => (
          <motion.div
            key={h.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-start gap-3 p-2.5 rounded"
            style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}
          >
            <span className={`${STATUS_CLASS[h.status]} text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 w-6 text-center`}>
              {STATUS_ICON[h.status]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-text-primary truncate">{h.name}</div>
              {h.value && h.status === 'pass' && (
                <div className="font-mono text-xs text-text-muted truncate mt-0.5">{h.value}</div>
              )}
              {h.status !== 'pass' && (
                <div className="font-mono text-xs text-text-muted mt-0.5">{h.detail}</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Remediation config */}
      {secHeaders.remediationConfig && (
        <div className="space-y-2">
          <div className="font-mono text-xs text-text-muted uppercase tracking-wider">Quick Fix Config</div>
          <div className="flex gap-2">
            {['nginx', 'apache'].map(type => (
              <button
                key={type}
                onClick={() => copyConfig(type)}
                className="flex-1 py-2 rounded font-mono text-xs transition-all"
                style={{
                  background: copied === type ? 'rgba(0,255,136,0.1)' : 'rgba(28,35,51,0.5)',
                  border: `1px solid ${copied === type ? 'rgba(0,255,136,0.3)' : '#1C2333'}`,
                  color: copied === type ? '#00FF88' : '#7D8590'
                }}
              >
                {copied === type ? '✓ COPIED' : `COPY ${type.toUpperCase()} CONFIG`}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
