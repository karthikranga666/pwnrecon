import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LOG_COLORS = {
  system: '#7D8590',
  module: '#4D9FFF',
  success: '#00CC6A',
  danger: '#FF4444',
  info: '#7D8590'
};

export function Terminal({ logs, open, onToggle }) {
  const bottomRef = useRef(null);
  const [maxVisible] = useState(200);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, open]);

  return (
    <div className="relative" style={{ borderTop: '1px solid #1C2333' }}>
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 font-mono text-xs text-text-muted hover:text-text-primary transition-colors"
        style={{ background: '#080B0F' }}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: '#00FF88' }}>&gt;_</span>
          TERMINAL LOG
          {logs.length > 0 && <span className="text-text-muted">({logs.length} lines)</span>}
        </span>
        <span>{open ? '▼' : '▲'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            style={{ overflow: 'hidden', background: '#050709' }}
          >
            <div className="h-full scrollable p-3 font-mono text-xs" style={{ height: 180 }}>
              {logs.length === 0 && (
                <div style={{ color: '#7D8590' }}>Awaiting scan...</div>
              )}
              {logs.slice(-maxVisible).map((log, i) => (
                <div key={i} style={{ color: LOG_COLORS[log.type] || '#7D8590', lineHeight: '1.6' }}>
                  {log.msg}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
