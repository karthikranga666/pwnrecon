import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function CountUp({ target, duration = 1500 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{val}</>;
}

function RiskGauge({ score }) {
  const radius = 70;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const color = score >= 80 ? '#FF4444' : score >= 60 ? '#FF6432' : score >= 40 ? '#FFB800' : '#00FF88';
  const offset = circumference - (animScore / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={180} height={180} className="transform -rotate-90">
        {/* Track */}
        <circle cx={90} cy={90} r={radius} fill="none" stroke="#1C2333" strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle
          cx={90} cy={90} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          style={{
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s',
            filter: `drop-shadow(0 0 8px ${color}80)`
          }}
        />
        {/* Glow ring */}
        <circle cx={90} cy={90} r={radius} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.15} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono font-bold count-num" style={{ fontSize: '2.5rem', color, lineHeight: 1 }}>
          <CountUp target={score} />
        </span>
        <span className="font-mono text-xs text-text-muted mt-1">/ 100</span>
      </div>
    </div>
  );
}

const CATEGORY_CONFIG = {
  Critical: { color: '#FF4444', bg: 'rgba(255,68,68,0.1)', border: 'rgba(255,68,68,0.3)' },
  High: { color: '#FF6432', bg: 'rgba(255,100,50,0.1)', border: 'rgba(255,100,50,0.3)' },
  Medium: { color: '#FFB800', bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.3)' },
  Low: { color: '#4D9FFF', bg: 'rgba(77,159,255,0.1)', border: 'rgba(77,159,255,0.3)' },
  Info: { color: '#7D8590', bg: 'rgba(125,133,144,0.1)', border: 'rgba(125,133,144,0.3)' }
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

export function RiskCard({ risk }) {
  const [expanded, setExpanded] = useState(null);
  if (!risk) return null;

  const cfg = CATEGORY_CONFIG[risk.category] || CATEGORY_CONFIG.Info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg p-5 card-red"
      style={{ background: '#0D1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-bold text-text-primary text-sm tracking-widest uppercase">Risk Score</div>
          <div className="font-mono text-xs text-text-muted mt-0.5">{risk.total} findings</div>
        </div>
        <span
          className="font-mono font-bold text-xs px-3 py-1 rounded tracking-widest uppercase"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {risk.category}
        </span>
      </div>

      {/* Gauge */}
      <div className="flex justify-center mb-4">
        <RiskGauge score={risk.score} />
      </div>

      {/* Count chips */}
      <div className="flex gap-2 flex-wrap justify-center mb-4">
        {SEVERITY_ORDER.map(sev => {
          const count = risk.counts?.[sev] || 0;
          if (count === 0) return null;
          const c = CATEGORY_CONFIG[sev.charAt(0).toUpperCase() + sev.slice(1)] || CATEGORY_CONFIG.Info;
          return (
            <div key={sev} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
              {count} {sev}
            </div>
          );
        })}
      </div>

      {/* Attack surface vectors */}
      {risk.attackSurface?.vectors?.length > 0 && (
        <div className="mb-4 p-3 rounded" style={{ background: 'rgba(28,35,51,0.5)', border: '1px solid #1C2333' }}>
          <div className="font-mono text-xs text-text-muted mb-2 uppercase tracking-wider">Attack Surface</div>
          {risk.attackSurface.vectors.map((v, i) => (
            <div key={i} className="font-mono text-xs text-text-primary flex items-start gap-2 mb-1">
              <span style={{ color: '#FF4444' }}>›</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Findings list */}
      {risk.findings?.length > 0 && (
        <div className="space-y-1 max-h-64 scrollable">
          {risk.findings.slice(0, 10).map((f, i) => {
            const sev = f.severity?.toLowerCase();
            const c = CATEGORY_CONFIG[sev?.charAt(0).toUpperCase() + sev?.slice(1)] || CATEGORY_CONFIG.Info;
            const isOpen = expanded === i;
            return (
              <motion.div
                key={i}
                className="rounded cursor-pointer"
                style={{ background: 'rgba(13,17,23,0.8)', border: `1px solid ${isOpen ? c.border : '#1C2333'}` }}
                onClick={() => setExpanded(isOpen ? null : i)}
                whileHover={{ borderColor: c.border }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className={`badge-${sev} text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0`} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {f.severity?.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs text-text-primary flex-1 truncate">{f.title}</span>
                  <span className="text-text-muted text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-2 space-y-1"
                    >
                      <p className="font-mono text-xs text-text-muted">{f.detail}</p>
                      {f.remediation && (
                        <p className="font-mono text-xs" style={{ color: '#00CC6A' }}>
                          Fix: {f.remediation}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
