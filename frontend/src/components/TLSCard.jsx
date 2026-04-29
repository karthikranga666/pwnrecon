import { motion } from 'framer-motion';

const GRADE_CONFIG = {
  A: { color: '#00FF88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.4)', glow: '0 0 30px rgba(0,255,136,0.3)' },
  B: { color: '#4D9FFF', bg: 'rgba(77,159,255,0.1)', border: 'rgba(77,159,255,0.4)', glow: '0 0 30px rgba(77,159,255,0.2)' },
  C: { color: '#FFB800', bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.4)', glow: '0 0 30px rgba(255,184,0,0.2)' },
  D: { color: '#FF6432', bg: 'rgba(255,100,50,0.1)', border: 'rgba(255,100,50,0.4)', glow: '0 0 30px rgba(255,100,50,0.2)' },
  F: { color: '#FF4444', bg: 'rgba(255,68,68,0.1)', border: 'rgba(255,68,68,0.4)', glow: '0 0 30px rgba(255,68,68,0.3)' }
};

function ValidityBar({ cert }) {
  if (!cert) return null;
  const from = new Date(cert.validFrom);
  const to = new Date(cert.validTo);
  const now = new Date();
  const total = to - from;
  const elapsed = now - from;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const expired = cert.expired;
  const soon = cert.expiringSoon;

  const barColor = expired ? '#FF4444' : soon ? '#FFB800' : '#00FF88';

  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs text-text-muted">
        <span>{new Date(cert.validFrom).toLocaleDateString()}</span>
        <span style={{ color: expired ? '#FF4444' : soon ? '#FFB800' : '#00CC6A' }}>
          {expired ? `Expired ${Math.abs(cert.daysRemaining)}d ago` : `${cert.daysRemaining}d left`}
        </span>
        <span>{new Date(cert.validTo).toLocaleDateString()}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#1C2333' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: barColor, boxShadow: `0 0 6px ${barColor}80` }}
        />
      </div>
    </div>
  );
}

export function TLSCard({ tls }) {
  if (!tls) return null;
  if (!tls.available) return (
    <div className="rounded-lg p-5 card-red" style={{ background: '#0D1117' }}>
      <div className="font-mono text-xs text-red">TLS unavailable: {tls.error || 'Could not connect'}</div>
    </div>
  );

  const grade = tls.grade || 'F';
  const cfg = GRADE_CONFIG[grade] || GRADE_CONFIG.F;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      <div className="flex items-start gap-4 mb-5">
        {/* Grade badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="flex-shrink-0 w-20 h-20 rounded-xl flex items-center justify-center font-display font-black text-4xl"
          style={{
            background: cfg.bg,
            border: `2px solid ${cfg.border}`,
            color: cfg.color,
            boxShadow: cfg.glow
          }}
        >
          {grade}
        </motion.div>

        <div className="flex-1">
          <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase mb-2">TLS Analysis</div>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-20">Protocol</span>
              <span style={{ color: ['TLSv1.3'].includes(tls.protocol) ? '#00FF88' : '#FFB800' }}>{tls.protocol || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-20">Cipher</span>
              <span className="text-text-primary truncate max-w-48">{tls.cipher?.name || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-20">Key Size</span>
              <span className="text-text-primary">{tls.cipher?.bits ? `${tls.cipher.bits} bits` : 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-20">Trusted</span>
              <span style={{ color: tls.authorized ? '#00FF88' : '#FF4444' }}>{tls.authorized ? '✓ Yes' : '✗ No'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate details */}
      {tls.cert && (
        <div className="space-y-4">
          <div className="rounded p-3 space-y-2" style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}>
            <div className="font-mono text-xs text-text-muted uppercase tracking-wider">Certificate</div>
            <div className="font-mono text-xs space-y-1">
              <div className="flex gap-2">
                <span className="text-text-muted w-16">Subject</span>
                <span className="text-text-primary">{tls.cert.subject}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-text-muted w-16">Issuer</span>
                <span className="text-text-primary">{tls.cert.issuer}</span>
              </div>
              {tls.cert.selfSigned && (
                <div className="flex gap-2">
                  <span className="badge-fail text-xs px-2 py-0.5 rounded">SELF-SIGNED</span>
                </div>
              )}
            </div>
            <ValidityBar cert={tls.cert} />
          </div>

          {/* SAN chips */}
          {tls.cert.san?.length > 0 && (
            <div>
              <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">SANs ({tls.cert.san.length})</div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollable">
                {tls.cert.san.slice(0, 20).map((san, i) => (
                  <span key={i} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(77,159,255,0.08)', color: '#4D9FFF', border: '1px solid rgba(77,159,255,0.2)' }}>
                    {san}
                  </span>
                ))}
                {tls.cert.san.length > 20 && (
                  <span className="font-mono text-xs text-text-muted">+{tls.cert.san.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {/* Findings */}
          {tls.findings?.length > 0 && (
            <div className="space-y-1">
              {tls.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 font-mono text-xs p-2 rounded" style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>
                  <span style={{ color: '#FF4444' }}>⚠</span>
                  <span className="text-text-primary">{f.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
