import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function MarkdownText({ text }) {
  if (!text) return null;
  // Merge bare number lines ("1.") with the following line
  const rawLines = text.split('\n');
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].match(/^\d+\.?\s*$/) && i + 1 < rawLines.length && rawLines[i + 1].trim()) {
      lines.push(rawLines[i].trim().replace(/\.?$/, '') + '. ' + rawLines[i + 1].trim());
      i++;
    } else {
      lines.push(rawLines[i]);
    }
  }
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Code block (inline `)
        const parts = line.split(/(`[^`]+`)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={j} className="px-1 py-0.5 rounded text-xs" style={{ background: '#050709', color: '#00FF88', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
          }
          // Bold **text**
          const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
          return boldParts.map((bp, k) => {
            if (bp.startsWith('**') && bp.endsWith('**')) {
              return <strong key={k} style={{ color: '#E6EDF3' }}>{bp.slice(2, -2)}</strong>;
            }
            return <span key={k}>{bp}</span>;
          });
        });

        // Bullet point
        if (line.match(/^[-*•]\s/)) {
          return <div key={i} className="flex items-start gap-1.5"><span style={{ color: '#00FF88' }}>›</span><span>{rendered}</span></div>;
        }
        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^\d+/)[0];
          const rest = line.replace(/^\d+\.\s*/, '');
          const restParts = rest.split(/(`[^`]+`)/g).map((part, j) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={j} className="px-1 py-0.5 rounded text-xs" style={{ background: '#050709', color: '#00FF88', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
            }
            return part.split(/(\*\*[^*]+\*\*)/g).map((bp, k) =>
              bp.startsWith('**') && bp.endsWith('**')
                ? <strong key={k} style={{ color: '#E6EDF3' }}>{bp.slice(2, -2)}</strong>
                : <span key={k}>{bp}</span>
            );
          });
          return <div key={i} className="flex items-start gap-1.5"><span style={{ color: '#4D9FFF' }} className="flex-shrink-0">{num}.</span><span>{restParts}</span></div>;
        }
        // Skip bare number lines like "1." or "2." with no content
        if (line.match(/^\d+\.?\s*$/)) return null;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

function ToolCommand({ cmd }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="font-mono text-xs rounded p-2 pr-16 break-all" style={{ background: '#050709', border: '1px solid #1C2333', color: '#00FF88' }}>
        {cmd}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-1.5 right-2 font-mono text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}
      >
        {copied ? '✓' : 'COPY'}
      </button>
    </div>
  );
}

function DownloadProgress({ progress, text }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green animate-pulse" />
        <span className="font-mono text-xs text-text-primary">Downloading model...</span>
      </div>
      <div className="space-y-1.5">
        <div className="w-full h-1.5 rounded-full" style={{ background: '#1C2333' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: '#00FF88', boxShadow: '0 0 8px rgba(0,255,136,0.4)' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between font-mono text-xs text-text-muted">
          <span className="truncate max-w-56">{text}</span>
          <span style={{ color: '#00FF88' }}>{progress}%</span>
        </div>
      </div>
      <div className="font-mono text-xs text-text-muted">
        Cached after first download. No server involved.
      </div>
    </div>
  );
}

export function AIPanel({ open, onClose, aiState, analysis, analysisLoading, messages, chatLoading, onSend, suggestedPrompts, domain, riskScore }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const send = () => {
    if (!input.trim() || chatLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const sourceLabel = aiState.source === 'webllm'
    ? aiState.modelId || 'Llama-3.2-1B'
    : 'Built-in Engine';

  const sourceColor = aiState.source === 'webllm' ? '#00FF88' : '#FFB800';

  const isDownloading = aiState.status === 'downloading';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-96 flex flex-col z-40"
          style={{ background: '#0D1117', borderLeft: '1px solid #1C2333' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1C2333' }}>
            <div>
              <div className="font-display font-bold text-text-primary text-sm tracking-widest">AI ANALYST</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: sourceColor, boxShadow: `0 0 4px ${sourceColor}` }}
                />
                <span className="font-mono text-xs text-text-muted">{sourceLabel}</span>
              </div>
            </div>
            <button onClick={onClose} className="font-mono text-text-muted hover:text-text-primary text-sm">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 scrollable min-h-0">

            {/* Download progress */}
            {isDownloading && (
              <DownloadProgress progress={aiState.downloadProgress} text={aiState.downloadText} />
            )}

            {/* Analysis loading */}
            {analysisLoading && !isDownloading && (
              <div className="p-4 space-y-3">
                <div className="font-mono text-xs text-text-muted animate-pulse">Analyzing recon data...</div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded animate-pulse" style={{ background: '#1C2333' }} />
                ))}
              </div>
            )}

            {/* Analysis results */}
            {analysis && !analysisLoading && !isDownloading && (
              <div className="p-4 space-y-4" style={{ borderBottom: '1px solid #1C2333' }}>
                {/* Source badge */}
                <span className="font-mono text-xs px-2 py-0.5 rounded inline-block"
                  style={{
                    background: analysis.source === 'webllm' ? 'rgba(0,255,136,0.1)' : 'rgba(255,184,0,0.1)',
                    color: analysis.source === 'webllm' ? '#00FF88' : '#FFB800',
                    border: `1px solid ${analysis.source === 'webllm' ? 'rgba(0,255,136,0.25)' : 'rgba(255,184,0,0.25)'}`
                  }}>
                  {analysis.source === 'webllm' ? `🧠 ${analysis.model}` : '⚙ Rule Engine'}
                </span>

                {/* Streaming state */}
                {analysis.streaming && (
                  <div className="font-mono text-xs">
                    {analysis.raw
                      ? <span className="text-text-muted">Generating analysis<span className="animate-pulse">...</span></span>
                      : <span className="animate-pulse" style={{ color: '#7D8590' }}>thinking<span className="animate-blink">...</span></span>
                    }
                  </div>
                )}

                {/* Attack vectors */}
                {analysis.analysis?.attackVectors?.length > 0 && !analysis.streaming && (
                  <div>
                    <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Attack Vectors</div>
                    <div className="space-y-2">
                      {analysis.analysis.attackVectors.map((v, i) => (
                        <div key={i} className="p-3 rounded text-xs font-mono" style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.15)', color: '#E6EDF3' }}>
                          <span style={{ color: '#FF4444' }} className="mr-2">{i + 1}.</span>{v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick wins */}
                {analysis.analysis?.quickWins?.length > 0 && !analysis.streaming && (
                  <div>
                    <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Quick Wins</div>
                    <div className="space-y-1">
                      {analysis.analysis.quickWins.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 font-mono text-xs text-text-primary">
                          <span style={{ color: '#00FF88' }} className="flex-shrink-0">›</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interesting */}
                {analysis.analysis?.interesting?.length > 0 && !analysis.streaming && (
                  <div>
                    <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Interesting</div>
                    <div className="space-y-1">
                      {analysis.analysis.interesting.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 font-mono text-xs" style={{ color: '#FFB800' }}>
                          <span className="flex-shrink-0">★</span><span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tools */}
                {analysis.analysis?.tools?.length > 0 && !analysis.streaming && (
                  <div>
                    <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Tool Commands</div>
                    <div className="space-y-2">
                      {analysis.analysis.tools.map((t, i) => <ToolCommand key={i} cmd={t} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat messages */}
            <div className="p-4 space-y-3">
              {messages.length === 0 && !analysisLoading && !analysis && !isDownloading && (
                <div className="font-mono text-xs text-text-muted text-center py-4">
                  Run a scan then click AI ANALYZE,<br />or ask a question below.
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-xs px-3 py-2 rounded font-mono text-xs"
                    style={{
                      background: msg.role === 'user' ? 'rgba(77,159,255,0.12)' : 'rgba(28,35,51,0.6)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(77,159,255,0.25)' : '#1C2333'}`,
                      color: '#7D8590'
                    }}
                  >
                    {msg.role === 'assistant'
                      ? msg.streaming && !msg.content
                        ? <span className="animate-pulse" style={{ color: '#7D8590' }}>thinking...</span>
                        : <MarkdownText text={msg.content} />
                      : <span style={{ color: '#E6EDF3' }}>{msg.content}</span>
                    }
                    {msg.streaming && msg.content && <span className="animate-blink ml-0.5" style={{ color: '#00FF88' }}>▊</span>}
                  </div>
                </div>
              ))}

              {chatLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded font-mono text-xs" style={{ background: 'rgba(28,35,51,0.6)', border: '1px solid #1C2333', color: '#7D8590' }}>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Suggested prompts */}
          {messages.length === 0 && !isDownloading && (
            <div className="px-4 py-2 flex flex-wrap gap-1.5 flex-shrink-0" style={{ borderTop: '1px solid #1C2333' }}>
              {suggestedPrompts.slice(0, 3).map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSend(p)}
                  className="font-mono text-xs px-2.5 py-1 rounded transition-all hover:text-text-primary"
                  style={{ background: 'rgba(28,35,51,0.5)', color: '#7D8590', border: '1px solid #1C2333' }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Chat input */}
          <div className="p-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #1C2333' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={isDownloading ? 'Downloading model...' : 'Ask anything...'}
              disabled={isDownloading}
              className="flex-1 bg-transparent font-mono text-xs text-text-primary placeholder-text-muted/40 focus:outline-none px-3 py-2 rounded disabled:opacity-40"
              style={{ background: 'rgba(28,35,51,0.4)', border: '1px solid #1C2333' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || chatLoading || isDownloading}
              className="px-3 py-2 rounded font-mono text-xs transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.25)' }}
            >
              SEND
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
