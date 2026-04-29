import { useState, useCallback, useRef, useEffect } from 'react';
import { isWebGPUSupported, isModelLoaded, loadModel, generateChat, generateAnalysis, MODEL_ID } from '../lib/webllm';
import { analyzeWithFallback, chatWithFallback } from '../lib/fallback';
import { buildAnalysisPrompt, buildChatPrompt, buildScanContext } from '../lib/prompts';

const SUGGESTED_PROMPTS = [
  'What should I test first?',
  'Explain the TLS findings',
  'Generate a pentest checklist',
  'What tools do I need?',
  'How do I test for XSS here?',
  'Check for subdomain takeover'
];

export function useAI() {
  const [aiState, setAIState] = useState({
    // 'idle' | 'downloading' | 'ready' | 'declined'
    status: 'idle',
    source: 'builtin',
    downloadProgress: 0,
    downloadText: '',
    modelId: null
  });

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const pendingAnalysis = useRef(null);
  const pendingChat = useRef(null);
  const sendMessageRef = useRef(null);

  const downloadModel = useCallback(async (modelKey = 'smart', silent = false) => {
    setAIState(s => ({ ...s, status: 'downloading', source: 'webllm' }));
    try {
      await loadModel(silent ? null : (report) => {
        setAIState(s => ({
          ...s,
          downloadProgress: Math.round((report.progress ?? 0) * 100),
          downloadText: report.text || 'Loading...'
        }));
      }, modelKey);
      localStorage.setItem('pwnrecon_model_accepted', '1');
      localStorage.setItem('pwnrecon_model_key', modelKey);
      setAIState(s => ({
        ...s,
        status: 'ready',
        source: 'webllm',
        modelId: MODEL_ID,
        downloadProgress: 100
      }));
      return true;
    } catch (e) {
      console.error('WebLLM load failed:', e);
      setAIState(s => ({ ...s, status: 'declined', source: 'builtin' }));
      return false;
    }
  }, []);

  // Auto-reconnect from browser cache on page reload if user previously accepted
  useEffect(() => {
    if (localStorage.getItem('pwnrecon_model_accepted') === '1' && !isModelLoaded()) {
      const savedKey = localStorage.getItem('pwnrecon_model_key') || 'smart';
      downloadModel(savedKey, true);
    }
  }, []);

  // Consent: only for AI Analyze (not chat)
  const handleConsentAccept = useCallback(async (modelKey = 'smart') => {
    setShowConsentModal(false);
    setPanelOpen(true);
    await downloadModel(modelKey, false);
    // Run pending analysis after download
    if (pendingAnalysis.current) {
      const { reconData, domain } = pendingAnalysis.current;
      pendingAnalysis.current = null;
      runAnalysisInternal(reconData, domain, true);
    }
    // Run pending chat message after download
    if (pendingChat.current) {
      const { message, context } = pendingChat.current;
      pendingChat.current = null;
      sendMessageRef.current?.(message, context);
    }
  }, [downloadModel]);

  const handleConsentDecline = useCallback(() => {
    setShowConsentModal(false);
    setAIState(s => ({ ...s, status: 'declined', source: 'builtin' }));
    // Run analysis with builtin engine
    if (pendingAnalysis.current) {
      const { reconData, domain } = pendingAnalysis.current;
      pendingAnalysis.current = null;
      runAnalysisInternal(reconData, domain, false);
    }
  }, []);

  const runAnalysisInternal = useCallback(async (reconData, domain, useWebLLM) => {
    setAnalysisLoading(true);
    setAnalysis(null);

    if (useWebLLM && isModelLoaded()) {
      try {
        const prompt = buildAnalysisPrompt(domain, reconData);
        setAnalysis({ source: 'webllm', model: MODEL_ID, analysis: null, streaming: true, raw: '' });

        let full = '';
        await generateAnalysis(prompt, (delta, accumulated) => {
          full = accumulated;
          setAnalysis(prev => ({ ...prev, raw: accumulated }));
        });

        const jsonMatch = full.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          setAnalysis({ source: 'webllm', model: MODEL_ID, analysis: JSON.parse(jsonMatch[0]), streaming: false });
        } else {
          setAnalysis({ source: 'webllm', model: MODEL_ID, analysis: { attackVectors: [full], quickWins: [], interesting: [], tools: [] }, streaming: false });
        }
      } catch (e) {
        console.error('WebLLM analysis error:', e);
        setAnalysis({ source: 'builtin', analysis: analyzeWithFallback(domain, reconData), streaming: false });
      }
    } else {
      await new Promise(r => setTimeout(r, 300));
      setAnalysis({ source: 'builtin', analysis: analyzeWithFallback(domain, reconData), streaming: false });
    }

    setAnalysisLoading(false);
  }, []);

  // analyze: shows consent modal if model not yet decided
  const analyze = useCallback((reconData, domain) => {
    setPanelOpen(true);
    const modelReady = isModelLoaded();
    const alreadyDecided = aiState.status === 'declined' || aiState.status === 'ready';

    if (modelReady) {
      runAnalysisInternal(reconData, domain, true);
    } else if (alreadyDecided || !isWebGPUSupported()) {
      runAnalysisInternal(reconData, domain, false);
    } else {
      // First time — ask consent
      pendingAnalysis.current = { reconData, domain };
      setShowConsentModal(true);
    }
  }, [aiState.status, runAnalysisInternal]);

  const sendMessageInternal = useCallback(async (message, context) => {
    setMessages(m => [...m, { role: 'user', content: message, ts: Date.now() }]);
    setChatLoading(true);

    try {
      const scanContextMsg = buildChatPrompt(message, context);
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));
      const llmMessages = [...history, { role: 'user', content: scanContextMsg }];

      setMessages(m => [...m, { role: 'assistant', content: '', source: 'webllm', streaming: true, ts: Date.now() }]);
      let response = '';
      await generateChat(llmMessages, (delta, accumulated) => {
        response = accumulated;
        setMessages(m => {
          const updated = [...m];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
          return updated;
        });
      });
      setMessages(m => {
        const updated = [...m];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: response, streaming: false };
        return updated;
      });
    } catch (e) {
      console.error('WebLLM chat error:', e);
      const fallback = chatWithFallback(message, context);
      setMessages(m => [...m, { role: 'assistant', content: fallback, source: 'builtin', ts: Date.now() }]);
    }

    setChatLoading(false);
  }, [messages]);

  const sendMessage = useCallback(async (message, context) => {
    // Model loaded — use it directly
    if (isModelLoaded()) {
      return sendMessageInternal(message, context);
    }

    // User already declined — use fallback silently
    if (aiState.status === 'declined') {
      setMessages(m => [...m, { role: 'user', content: message, ts: Date.now() }]);
      await new Promise(r => setTimeout(r, 250));
      const response = chatWithFallback(message, context);
      setMessages(m => [...m, { role: 'assistant', content: response, source: 'builtin', ts: Date.now() }]);
      return;
    }

    // Model not loaded yet — queue message and show consent
    pendingChat.current = { message, context };
    setShowConsentModal(true);
    setPanelOpen(true);
  }, [aiState.status, sendMessageInternal]);

  sendMessageRef.current = sendMessageInternal;

  const clearChat = useCallback(() => setMessages([]), []);

  return {
    aiState,
    showConsentModal,
    handleConsentAccept,
    handleConsentDecline,
    analysis,
    analysisLoading,
    messages,
    chatLoading,
    panelOpen,
    setPanelOpen,
    analyze,
    sendMessage,
    clearChat,
    suggestedPrompts: SUGGESTED_PROMPTS
  };
}
