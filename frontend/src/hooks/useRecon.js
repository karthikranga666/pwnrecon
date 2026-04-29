import { useState, useCallback, useRef } from 'react';
import { startRecon } from '../lib/api';

const MODULE_ORDER = ['dns', 'tls', 'http', 'headers', 'ports'];

export function useRecon() {
  const [state, setState] = useState({
    status: 'idle', // idle | scanning | complete | error
    domain: null,
    result: null,
    error: null,
    elapsed: 0,
    logs: [],
    moduleStatus: { dns: 'idle', tls: 'idle', http: 'idle', headers: 'idle', ports: 'idle' }
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setState(s => ({
      ...s,
      logs: [...s.logs.slice(-199), { msg, type, ts: Date.now() }]
    }));
  }, []);

  const scan = useCallback(async (target, selectedModules = MODULE_ORDER) => {
    setState(s => ({
      ...s,
      status: 'scanning',
      domain: target,
      result: null,
      error: null,
      elapsed: 0,
      logs: [],
      moduleStatus: Object.fromEntries(selectedModules.map(m => [m, 'running']))
    }));

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
    }, 1000);

    addLog(`> Initializing recon for ${target}`, 'system');
    addLog('> Resolving target...', 'system');

    for (const mod of selectedModules) {
      addLog(`> [${mod.toUpperCase()}] Module engaged`, 'module');
    }

    try {
      addLog('> Sending reconnaissance request...', 'system');
      const data = await startRecon(target, selectedModules);

      clearInterval(timerRef.current);

      // Update module statuses
      const moduleStatus = {};
      for (const mod of selectedModules) {
        const key = mod === 'headers' ? 'secHeaders' : mod;
        moduleStatus[mod] = data.modules[key]?.error ? 'error' : 'complete';
      }
      if (data.modules.ports) addLog(`> [PORTS] ${data.modules.ports.open?.length || 0} open ports`, 'success');

      if (data.modules.dns) addLog(`> [DNS] ${data.modules.dns.subdomains?.length || 0} subdomains found`, 'success');
      if (data.modules.tls) addLog(`> [TLS] Grade: ${data.modules.tls.grade || 'N/A'}`, 'success');
      if (data.modules.http) addLog(`> [HTTP] WAF: ${data.modules.http.waf || 'none detected'}`, 'success');
      if (data.modules.secHeaders) addLog(`> [HEADERS] Score: ${data.modules.secHeaders.score || 0}/100`, 'success');
      addLog(`> Risk score: ${data.risk?.score || 0}/100 — ${data.risk?.category || 'Unknown'}`, data.risk?.score > 60 ? 'danger' : 'success');
      addLog(`> Scan complete in ${((data.elapsed || 0) / 1000).toFixed(1)}s`, 'system');

      setState(s => ({
        ...s,
        status: 'complete',
        result: data,
        elapsed: Math.floor((data.elapsed || 0) / 1000),
        moduleStatus
      }));
    } catch (e) {
      clearInterval(timerRef.current);
      const msg = e.response?.data?.error || e.message;
      addLog(`> ERROR: ${msg}`, 'danger');
      setState(s => ({
        ...s,
        status: 'error',
        error: msg,
        moduleStatus: Object.fromEntries(selectedModules.map(m => [m, 'error']))
      }));
    }
  }, [addLog]);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setState({ status: 'idle', domain: null, result: null, error: null, elapsed: 0, logs: [], moduleStatus: { dns: 'idle', tls: 'idle', http: 'idle', headers: 'idle', ports: 'idle' } });
  }, []);

  return { ...state, scan, reset };
}
