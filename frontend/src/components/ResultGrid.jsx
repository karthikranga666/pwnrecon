import { motion } from 'framer-motion';
import { RiskCard } from './RiskCard';
import { DNSCard } from './DNSCard';
import { TLSCard } from './TLSCard';
import { HeadersCard } from './HeadersCard';
import { SubdomainCard } from './SubdomainCard';
import { PortsCard } from './PortsCard';
import { exportPDF } from '../lib/exportPDF';

function HTTPCard({ http }) {
  if (!http) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase mb-4">HTTP Fingerprint</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[['HTTP', http.http], ['HTTPS', http.https]].map(([proto, d]) => (
          <div key={proto} className="p-3 rounded" style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}>
            <div className="font-mono text-xs text-text-muted mb-1">{proto}</div>
            <div className="font-mono text-sm font-bold" style={{ color: d?.status < 400 ? '#00FF88' : '#FF4444' }}>
              {d?.status || '—'}
            </div>
            <div className="font-mono text-xs text-text-muted">{d?.responseTime}ms</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-muted w-24">HTTPS Redirect</span>
          <span style={{ color: http.httpsRedirect ? '#00FF88' : '#FF4444' }}>{http.httpsRedirect ? '✓ Yes' : '✗ No'}</span>
        </div>
        {http.waf && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-24">WAF</span>
            <span className="px-2 py-0.5 rounded capitalize" style={{ background: 'rgba(77,159,255,0.1)', color: '#4D9FFF', border: '1px solid rgba(77,159,255,0.2)' }}>{http.waf}</span>
          </div>
        )}
        {http.server && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-24">Server</span>
            <span className="text-text-primary">{http.server}</span>
          </div>
        )}
        {http.poweredBy && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-24">Powered By</span>
            <span style={{ color: '#FFB800' }}>{http.poweredBy}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-text-muted w-24">Open Redirect</span>
          <span style={{ color: http.openRedirect?.vulnerable ? '#FF4444' : '#00FF88' }}>
            {http.openRedirect?.vulnerable ? '⚠ Vulnerable' : '✓ Not detected'}
          </span>
        </div>
      </div>

      {http.techStack?.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-xs text-text-muted mb-2 uppercase tracking-wider">Tech Stack</div>
          <div className="flex flex-wrap gap-1.5">
            {http.techStack.map((t, i) => (
              <span key={i} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(28,35,51,0.6)', color: '#E6EDF3', border: '1px solid #1C2333' }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function ResultGrid({ result, onAIAnalyze }) {
  if (!result) return null;

  const { modules, risk, domain } = result;

  return (
    <div className="w-full h-full scrollable px-4 py-4 space-y-4 pb-2">
      {/* Domain header + AI button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="font-display font-bold text-xl text-text-primary">{domain}</h2>
          <div className="font-mono text-xs text-text-muted">Scan complete · {new Date(result.timestamp).toLocaleTimeString()}</div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => exportPDF(result)}
            className="px-4 py-2 rounded font-mono text-xs font-semibold tracking-widest transition-all"
            style={{
              background: 'rgba(77,159,255,0.08)',
              color: '#4D9FFF',
              border: '1px solid rgba(77,159,255,0.25)'
            }}
          >
            ↓ EXPORT PDF
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAIAnalyze(modules, domain)}
            className="px-4 py-2 rounded font-mono text-xs font-semibold tracking-widest transition-all"
            style={{
              background: 'rgba(0,255,136,0.08)',
              color: '#00FF88',
              border: '1px solid rgba(0,255,136,0.25)',
              boxShadow: '0 0 15px rgba(0,255,136,0.06)'
            }}
          >
            ◈ AI ANALYZE
          </motion.button>
        </div>
      </motion.div>

      {/* Two-column layout: left = data cards, right = risk */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Left column */}
        <div className="space-y-4">
          {modules.dns && <DNSCard dns={modules.dns} />}
          {modules.dns?.subdomains?.length > 0 && <SubdomainCard dns={modules.dns} />}
          {modules.tls && <TLSCard tls={modules.tls} />}
          {modules.http && <HTTPCard http={modules.http} />}
          {modules.secHeaders && <HeadersCard secHeaders={modules.secHeaders} />}
          {modules.ports && <PortsCard ports={modules.ports} />}
        </div>

        {/* Right column — Risk score (sticky) */}
        <div>
          <div className="sticky top-0">
            <RiskCard risk={risk} />
          </div>
        </div>
      </div>
    </div>
  );
}
