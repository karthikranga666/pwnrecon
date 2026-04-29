import { motion, AnimatePresence } from 'framer-motion';

const MODULE_LABELS = { dns: 'DNS', tls: 'TLS', http: 'HTTP', headers: 'HEADERS' };
const STATUS_COLORS = {
  idle: '#1C2333',
  running: '#00FF88',
  complete: '#00CC6A',
  error: '#FF4444'
};

export function ScanProgress({ status, elapsed, moduleStatus, logs }) {
  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full max-w-4xl mx-auto px-4 space-y-3"
      >
        {/* Sweep bar */}
        <div className="relative h-px w-full overflow-hidden rounded-full" style={{ background: '#1C2333' }}>
          {status === 'scanning' && (
            <motion.div
              className="absolute top-0 h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #00FF88, transparent)', width: '30%' }}
              animate={{ left: ['-30%', '110%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {status === 'complete' && (
            <div className="h-full w-full rounded-full" style={{ background: '#00FF88' }} />
          )}
          {status === 'error' && (
            <div className="h-full w-full rounded-full" style={{ background: '#FF4444' }} />
          )}
        </div>

        {/* Module pills + timer */}
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(moduleStatus).map(([mod, st]) => (
            <div
              key={mod}
              className="flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs transition-all"
              style={{
                background: st === 'idle' ? 'rgba(28,35,51,0.4)' : `${STATUS_COLORS[st]}18`,
                border: `1px solid ${STATUS_COLORS[st]}${st === 'idle' ? '40' : '60'}`,
                color: STATUS_COLORS[st]
              }}
            >
              {st === 'running' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00FF88' }} />
              )}
              {st === 'complete' && <span>✓</span>}
              {st === 'error' && <span>✗</span>}
              {MODULE_LABELS[mod] || mod}
            </div>
          ))}

          <div className="ml-auto font-mono text-xs text-text-muted">
            {status === 'scanning' && (
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                LIVE {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            )}
            {status === 'complete' && <span style={{ color: '#00FF88' }}>✓ COMPLETE {elapsed}s</span>}
            {status === 'error' && <span style={{ color: '#FF4444' }}>✗ FAILED</span>}
          </div>
        </div>

        {/* Live log preview — last 3 lines */}
        {logs.length > 0 && status === 'scanning' && (
          <div className="font-mono text-xs space-y-0.5">
            {logs.slice(-3).map((log, i) => (
              <div
                key={i}
                className="text-text-muted"
                style={{
                  color: log.type === 'success' ? '#00CC6A' : log.type === 'danger' ? '#FF4444' : '#7D8590',
                  opacity: i === logs.slice(-3).length - 1 ? 1 : 0.5
                }}
              >
                {log.msg}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
