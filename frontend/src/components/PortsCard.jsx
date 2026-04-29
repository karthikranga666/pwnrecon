import { motion } from 'framer-motion';

const RISKY_PORTS = [21, 23, 445, 1433, 3306, 3389, 5432, 5900, 6379, 9200, 27017];
const PORT_COLORS = {
  critical: '#FF4444',
  high: '#FF6432',
  medium: '#FFB800',
  info: '#4D9FFF'
};

function riskLevel(port) {
  if ([23, 3306, 5432, 1433, 27017, 6379, 9200].includes(port)) return 'critical';
  if ([3389, 445, 5900].includes(port)) return 'high';
  if ([21].includes(port)) return 'medium';
  return 'info';
}

export function PortsCard({ ports }) {
  if (!ports) return null;
  if (ports.error) return (
    <div className="rounded-lg p-5 card-red" style={{ background: '#0D1117' }}>
      <div className="font-mono text-xs" style={{ color: '#FF4444' }}>Port scan error: {ports.error}</div>
    </div>
  );

  const open = ports.open || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg p-5 card-green"
      style={{ background: '#0D1117' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase">Port Scan</div>
          <div className="font-mono text-xs text-text-muted mt-0.5">
            {open.length} open / {ports.total} scanned
          </div>
        </div>
        <div className="flex gap-2">
          {open.filter(p => RISKY_PORTS.includes(p.port)).length > 0 && (
            <span className="font-mono text-xs px-2 py-0.5 rounded badge-critical">
              {open.filter(p => RISKY_PORTS.includes(p.port)).length} RISKY
            </span>
          )}
          {open.length === 0 && (
            <span className="font-mono text-xs px-2 py-0.5 rounded badge-pass">ALL CLOSED</span>
          )}
        </div>
      </div>

      {open.length === 0 ? (
        <div className="font-mono text-xs text-text-muted text-center py-6">
          No open ports detected on common ports
        </div>
      ) : (
        <div className="space-y-1.5">
          {open.map((p, i) => {
            const risk = riskLevel(p.port);
            const color = PORT_COLORS[risk];
            return (
              <motion.div
                key={p.port}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-3 py-2 rounded font-mono text-xs"
                style={{
                  background: risk === 'critical' ? 'rgba(255,68,68,0.06)' : risk === 'high' ? 'rgba(255,100,50,0.06)' : 'rgba(28,35,51,0.4)',
                  border: `1px solid ${color}30`
                }}
              >
                {/* Port number */}
                <span className="font-bold w-12 text-right flex-shrink-0" style={{ color }}>
                  {p.port}
                </span>

                {/* Protocol indicator */}
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />

                {/* Service + software/version */}
                <span className="flex-1 text-text-primary">
                  {p.service}
                  {p.software && p.software !== p.service && (
                    <span className="text-text-muted ml-1">{p.software}</span>
                  )}
                  {p.version && (
                    <span className="ml-1 px-1 rounded text-xs" style={{ background: 'rgba(77,159,255,0.1)', color: '#4D9FFF' }}>
                      {p.version}
                    </span>
                  )}
                  {p.poweredBy && (
                    <span className="ml-1 text-text-muted text-xs">via {p.poweredBy}</span>
                  )}
                </span>

                {/* HTTP status for web ports */}
                {p.httpStatus && (
                  <span className="text-text-muted text-xs hidden sm:block">{p.httpStatus}</span>
                )}

                {/* Risk badge */}
                {risk !== 'info' && (
                  <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 uppercase"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                  >
                    {risk}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Cloud IP warning */}
      {import.meta.env.PROD && (
        <div className="mt-3 flex items-center gap-2 font-mono text-xs px-2 py-1.5 rounded"
          style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.15)' }}>
          <span style={{ color: '#FFB800' }}>⚠</span>
          <span style={{ color: '#7D8590' }}>Scanned from cloud IP — target firewall may block datacenter ranges. Run locally for accurate results.</span>
        </div>
      )}

      {/* Findings */}
      {ports.findings?.filter(f => f.severity !== 'info').length > 0 && (
        <div className="mt-4 space-y-1">
          {ports.findings.filter(f => f.severity !== 'info').map((f, i) => (
            <div key={i} className="flex items-start gap-2 font-mono text-xs p-2 rounded"
              style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>
              <span style={{ color: '#FF4444' }}>⚠</span>
              <div>
                <div className="text-text-primary">{f.title}</div>
                <div className="text-text-muted mt-0.5">{f.remediation}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
