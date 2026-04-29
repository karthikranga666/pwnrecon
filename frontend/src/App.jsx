import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanInput } from './components/ScanInput';
import { ScanProgress } from './components/ScanProgress';
import { ResultGrid } from './components/ResultGrid';
import { AIPanel } from './components/AIPanel';
import { Terminal } from './components/Terminal';
import { ModelConsentModal } from './components/ModelConsentModal';
import { useRecon } from './hooks/useRecon';
import { useAI } from './hooks/useAI';

function Header({ domain, status, aiState, onAIToggle, aiPanelOpen }) {
  const statusColor = aiState.source === 'webllm' ? '#00FF88' : '#FFB800';
  const statusLabel = aiState.status === 'downloading'
    ? `${aiState.downloadProgress}%`
    : aiState.source === 'webllm'
    ? 'WebLLM'
    : 'Built-in';

  return (
    <header
      className="relative flex-shrink-0 flex items-center justify-between px-6 py-3 scanlines"
      style={{
        background: 'linear-gradient(180deg, #0D1117 0%, rgba(13,17,23,0.95) 100%)',
        borderBottom: '1px solid #1C2333',
        zIndex: 10
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-xl text-glow-green" style={{ color: '#00FF88' }}>&gt;_</span>
        <div>
          <div className="flex items-baseline gap-2">
            <div className="font-display font-extrabold text-base tracking-widest text-text-primary">PWNRECON</div>
            <div className="font-mono text-xs tracking-wide" style={{ color: '#4D9FFF' }}>(Osto Assignment)</div>
          </div>
          <div className="font-mono text-xs text-text-muted tracking-widest">ATTACK SURFACE INTELLIGENCE</div>
        </div>
      </div>

      {/* Center */}
      <div className="hidden md:block font-mono text-xs text-text-muted">
        {domain && status !== 'idle'
          ? <span style={{ color: '#4D9FFF' }}>{domain}</span>
          : <span className="opacity-50">autonomous recon platform</span>
        }
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-text-muted">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${aiState.status === 'downloading' ? 'animate-pulse' : ''}`}
            style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}` }}
          />
          AI: {statusLabel}
        </div>
        <button
          onClick={onAIToggle}
          className="px-3 py-1.5 rounded font-mono text-xs transition-all"
          style={{
            background: aiPanelOpen ? 'rgba(0,255,136,0.1)' : 'rgba(28,35,51,0.6)',
            color: aiPanelOpen ? '#00FF88' : '#7D8590',
            border: `1px solid ${aiPanelOpen ? 'rgba(0,255,136,0.3)' : '#1C2333'}`
          }}
        >
          AI PANEL
        </button>
      </div>
    </header>
  );
}

function HeroScreen({ onScan, scanning }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 relative">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center relative z-10"
      >
        <div className="font-display font-black text-5xl tracking-tight text-text-primary mb-2">
          PWN<span style={{ color: '#00FF88' }}>RECON</span>
        </div>
        <div className="font-mono text-sm text-text-muted tracking-widest">
          AUTONOMOUS ATTACK SURFACE INTELLIGENCE
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full relative z-10"
      >
        <ScanInput onScan={onScan} scanning={scanning} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-6 font-mono text-xs text-text-muted relative z-10"
      >
        {['DNS Enumeration', 'TLS Analysis', 'HTTP Fingerprinting', 'Security Headers', 'AI Analysis'].map((f, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span style={{ color: '#00FF88' }}>✓</span> {f}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function App() {
  const recon = useRecon();
  const ai = useAI();
  const [terminalOpen, setTerminalOpen] = useState(false);

  const handleScan = (target, modules) => {
    recon.scan(target, modules);
    ai.clearChat();
    if (ai.panelOpen) ai.setPanelOpen(false);
    setTerminalOpen(true);
  };

  const handleAIAnalyze = (modules, domain) => {
    ai.analyze(modules, domain);
    ai.setPanelOpen(true);
  };

  const handleReset = () => {
    recon.reset();
    setTerminalOpen(false);
  };

  const scanning = recon.status === 'scanning';
  const hasResult = recon.status === 'complete' && recon.result;

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: '#080B0F' }}
    >
      <Header
        domain={recon.domain}
        status={recon.status}
        aiState={ai.aiState}
        onAIToggle={() => ai.setPanelOpen(v => !v)}
        aiPanelOpen={ai.panelOpen}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {!hasResult ? (
            <motion.div
              key="hero"
              className="flex-1 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <HeroScreen onScan={handleScan} scanning={scanning} />

              {/* Progress below hero input */}
              {recon.status !== 'idle' && (
                <div className="flex-shrink-0 pb-4">
                  <ScanProgress
                    status={recon.status}
                    elapsed={recon.elapsed}
                    moduleStatus={recon.moduleStatus}
                    logs={recon.logs}
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Scan bar at top of results */}
              <div className="flex-shrink-0 py-3 px-4 flex items-center gap-4" style={{ borderBottom: '1px solid #1C2333' }}>
                <div className="flex-1">
                  <ScanInput onScan={handleScan} scanning={scanning} />
                </div>
                <button
                  onClick={handleReset}
                  className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                >
                  RESET
                </button>
              </div>

              {/* Results */}
              <div className="flex-1 min-h-0">
                <ResultGrid result={recon.result} onAIAnalyze={handleAIAnalyze} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Panel overlay */}
        <AIPanel
          open={ai.panelOpen}
          onClose={() => ai.setPanelOpen(false)}
          aiState={ai.aiState}
          analysis={ai.analysis}
          analysisLoading={ai.analysisLoading}
          messages={ai.messages}
          chatLoading={ai.chatLoading}
          onSend={(msg) => ai.sendMessage(msg, { domain: recon.domain, riskScore: recon.result?.risk?.score, scanData: recon.result })}
          suggestedPrompts={ai.suggestedPrompts}
          domain={recon.domain}
          riskScore={recon.result?.risk?.score}
        />

        {/* Model consent modal */}
        <ModelConsentModal
          open={ai.showConsentModal}
          onAccept={ai.handleConsentAccept}
          onDecline={ai.handleConsentDecline}
        />
      </div>

      {/* Terminal at bottom */}
      <div className="flex-shrink-0">
        <Terminal logs={recon.logs} open={terminalOpen} onToggle={() => setTerminalOpen(v => !v)} />
      </div>
    </div>
  );
}
