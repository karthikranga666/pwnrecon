import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODELS, isWebGPUSupported } from '../lib/webllm.js';

export function ModelConsentModal({ open, onAccept, onDecline }) {
  const [selected, setSelected] = useState('fast');
  const gpuSupported = isWebGPUSupported();

  const model = MODELS[selected];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(8,11,15,0.85)', backdropFilter: 'blur(4px)' }}
            onClick={onDecline}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="w-full max-w-md rounded-xl p-6 space-y-5"
              style={{
                background: '#0D1117',
                border: '1px solid #1C2333',
                boxShadow: '0 0 60px rgba(0,255,136,0.08), 0 0 0 1px rgba(0,255,136,0.1)',
                pointerEvents: 'auto'
              }}
            >
              {/* Header */}
              <div>
                <div className="font-display font-bold text-text-primary text-base tracking-wide">
                  Download AI Model
                </div>
                <div className="font-mono text-xs text-text-muted mt-0.5">
                  Runs entirely in your browser — no data sent to any server.
                </div>
              </div>

              {/* Model selector */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(MODELS).map(([key, m]) => {
                  const active = selected === key;
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-lg p-3 text-left space-y-2 transition-all"
                      style={{
                        background: active ? 'rgba(0,255,136,0.06)' : 'rgba(28,35,51,0.4)',
                        border: `1px solid ${active ? 'rgba(0,255,136,0.35)' : '#1C2333'}`,
                        boxShadow: active ? '0 0 12px rgba(0,255,136,0.08)' : 'none'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-mono text-xs font-bold"
                          style={{ color: active ? '#00FF88' : '#E6EDF3' }}
                        >
                          {m.label}
                        </span>
                        <span
                          className="font-mono text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: active ? 'rgba(0,255,136,0.12)' : 'rgba(255,184,0,0.1)',
                            color: active ? '#00FF88' : '#FFB800'
                          }}
                        >
                          {m.size}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-text-muted leading-relaxed">
                        {m.description}
                      </div>
                      <div className="font-mono text-xs" style={{ color: '#4D9FFF' }}>
                        {m.vram}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Selected model info */}
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'rgba(28,35,51,0.3)', border: '1px solid #1C2333' }}>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-text-muted">Model ID</span>
                  <span className="text-text-primary truncate max-w-48">{model.id}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-text-muted">Cached</span>
                  <span style={{ color: '#00CC6A' }}>Forever — one-time download</span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-text-muted">WebGPU</span>
                  <span style={{ color: gpuSupported ? '#00CC6A' : '#FF4444' }}>
                    {gpuSupported ? '✓ Supported' : '✗ Not supported'}
                  </span>
                </div>
              </div>

              {!gpuSupported && (
                <div className="rounded p-3 font-mono text-xs" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF4444' }}>
                  WebGPU not detected. Use Chrome 113+ or Edge 113+.
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onDecline}
                  className="flex-1 py-2.5 rounded font-mono text-xs transition-all"
                  style={{ background: 'transparent', color: '#7D8590', border: '1px solid #1C2333' }}
                >
                  USE BUILT-IN
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={gpuSupported ? () => onAccept(selected) : onDecline}
                  className="flex-1 py-2.5 rounded font-mono text-xs font-semibold transition-all"
                  style={{
                    background: gpuSupported ? 'rgba(0,255,136,0.1)' : 'rgba(125,133,144,0.1)',
                    color: gpuSupported ? '#00FF88' : '#7D8590',
                    border: `1px solid ${gpuSupported ? 'rgba(0,255,136,0.3)' : '#1C2333'}`,
                    boxShadow: gpuSupported ? '0 0 15px rgba(0,255,136,0.1)' : 'none'
                  }}
                >
                  {gpuSupported ? `⬇ DOWNLOAD ${MODELS[selected].size}` : 'USE BUILT-IN'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
