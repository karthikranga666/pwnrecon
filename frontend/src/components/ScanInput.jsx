import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const EXAMPLE_TARGETS = ['example.com', 'github.com', 'shopify.com', 'stripe.com', 'cloudflare.com'];
const MODULES = [
  { id: 'dns',     label: 'DNS',     desc: 'Records + Subdomains' },
  { id: 'tls',     label: 'TLS',     desc: 'Cert Analysis' },
  { id: 'http',    label: 'HTTP',    desc: 'Fingerprinting' },
  { id: 'headers', label: 'Headers', desc: 'Security Audit' },
  { id: 'ports',   label: 'PORTS',   desc: 'Top 27 ports + service detection' }
];

export function ScanInput({ onScan, scanning }) {
  const [target, setTarget] = useState('');
  const [selectedModules, setSelectedModules] = useState(['dns', 'tls', 'http', 'headers', 'ports']);
  const [focused, setFocused] = useState(false);
  const [ghostIdx, setGhostIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const cycle = setInterval(() => setGhostIdx(i => (i + 1) % EXAMPLE_TARGETS.length), 3000);
    return () => clearInterval(cycle);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleModule = (id) => {
    setSelectedModules(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!target.trim() || scanning) return;
    onScan(target.trim(), selectedModules);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <form onSubmit={handleSubmit}>
        {/* Main input */}
        <motion.div
          className="relative"
          animate={focused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              background: '#0D1117',
              border: `1px solid ${focused ? 'rgba(0,255,136,0.5)' : '#1C2333'}`,
              boxShadow: focused ? '0 0 0 1px rgba(0,255,136,0.2), 0 0 30px rgba(0,255,136,0.1)' : 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
          >
            <span className="text-green font-mono text-lg select-none flex-shrink-0 text-glow-green">&gt;_</span>
            <input
              ref={inputRef}
              type="text"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={`scan ${EXAMPLE_TARGETS[ghostIdx]}`}
              disabled={scanning}
              className="flex-1 bg-transparent font-mono text-lg text-text-primary placeholder-text-muted/40 focus:outline-none disabled:opacity-50"
              style={{ fontSize: '1.1rem', letterSpacing: '0.02em' }}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-text-muted text-xs hidden sm:block">⌘K</span>
              <motion.button
                type="submit"
                disabled={!target.trim() || scanning}
                whileHover={!scanning && target ? { scale: 1.02 } : {}}
                whileTap={!scanning && target ? { scale: 0.98 } : {}}
                className="px-5 py-2 rounded font-mono font-semibold text-sm tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{
                  background: scanning
                    ? 'rgba(0,255,136,0.1)'
                    : target
                    ? '#FF4444'
                    : 'rgba(255,68,68,0.2)',
                  color: scanning ? '#00FF88' : '#fff',
                  border: `1px solid ${scanning ? 'rgba(0,255,136,0.3)' : target ? '#FF4444' : 'rgba(255,68,68,0.3)'}`,
                  boxShadow: target && !scanning ? '0 0 15px rgba(255,68,68,0.3)' : 'none'
                }}
              >
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green animate-pulse" />
                    SCANNING
                  </span>
                ) : 'INITIALIZE SCAN'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Module toggles */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-text-muted text-xs font-mono mr-1">MODULES:</span>
          {MODULES.map(mod => {
            const active = selectedModules.includes(mod.id);
            return (
              <motion.button
                key={mod.id}
                type="button"
                onClick={() => toggleModule(mod.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-1 rounded text-xs font-mono transition-all"
                style={{
                  background: active ? 'rgba(0,255,136,0.1)' : 'rgba(28,35,51,0.5)',
                  color: active ? '#00FF88' : '#7D8590',
                  border: `1px solid ${active ? 'rgba(0,255,136,0.3)' : '#1C2333'}`,
                  boxShadow: active ? '0 0 8px rgba(0,255,136,0.1)' : 'none'
                }}
                title={mod.desc}
              >
                {mod.label}
              </motion.button>
            );
          })}
          <span className="text-text-muted/40 text-xs font-mono ml-auto hidden sm:block">
            {selectedModules.length} / {MODULES.length} active
          </span>
        </div>

        {/* Port scan cloud warning — only in production */}
        {import.meta.env.PROD && selectedModules.includes('ports') && (
          <div className="mt-2 flex items-center gap-2 font-mono text-xs px-2 py-1.5 rounded"
            style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.2)' }}>
            <span style={{ color: '#FFB800' }}>⚠</span>
            <span style={{ color: '#7D8590' }}>
              Port scan runs from cloud server IP — results may differ from local network scans. Firewall rules may hide open ports.
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
