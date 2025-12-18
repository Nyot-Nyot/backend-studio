
import React, { useState } from 'react';
import { MockEndpoint, HttpMethod, LogEntry, TestConsoleState } from '../types';
import { Play, RotateCcw, Clock, AlertCircle, CheckCircle, Code, ArrowRight } from 'lucide-react';

interface TestConsoleProps {
  mocks: MockEndpoint[]; // Only for suggestions, not execution logic anymore
  state: TestConsoleState;
  setState: (state: TestConsoleState) => void;
}

// Lightweight syntax highlighter for JSON
const JsonViewer = ({ json }: { json: string }) => {
    try {
        const lines = json.split('\n');
        return (
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">
                {lines.map((line, i) => {
                    const parts = line.split(/(".*?"|:|\d+|true|false|null)/g).filter(Boolean);
                    
                    return (
                        <div key={i}>
                            {parts.map((part, j) => {
                                let className = "text-slate-400"; 
                                
                                if (part.startsWith('"')) {
                                    if (part.endsWith('":') || (parts[j+1] && parts[j+1].trim().startsWith(':'))) {
                                         className = "text-sky-300 font-bold"; 
                                    } else {
                                         className = "text-emerald-300"; 
                                    }
                                } else if (/^\d+/.test(part)) {
                                    className = "text-amber-300"; 
                                } else if (/^true|false/.test(part)) {
                                    className = "text-rose-300 font-bold"; 
                                } else if (part === 'null') {
                                    className = "text-slate-500 italic"; 
                                }

                                return <span key={j} className={className}>{part}</span>
                            })}
                        </div>
                    )
                })}
            </pre>
        )
    } catch {
        return <pre className="text-slate-300">{json}</pre>;
    }
};

export const TestConsole: React.FC<TestConsoleProps> = ({ mocks, state, setState }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ method: HttpMethod; path: string; body?: string } | null>(null);

  const updateState = (updates: Partial<TestConsoleState>) => {
      setState({ ...state, ...updates });
  };

  const handleSend = async (override?: { method?: HttpMethod; path?: string; body?: string }) => {
    const method = override?.method ?? state.method;
    const path = override?.path ?? state.path;
    const body = override?.body ?? state.body;

    // Basic JSON validation for methods that have a body
    if ((method === HttpMethod.POST || method === HttpMethod.PUT || method === HttpMethod.PATCH) && body) {
      try { JSON.parse(body); } catch (e) {
        updateState({
          response: {
            status: 0,
            body: JSON.stringify({ error: 'Invalid JSON body', details: (e as Error).message }, null, 2),
            time: 0,
            headers: [],
            error: 'Invalid JSON body'
          }
        });
        return;
      }
    }

    setIsLoading(true);
    // Clear previous response while loading
    updateState({ response: null });

    const startTime = Date.now();
    
    try {
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                // Add a flag so our Service Worker definitely knows to care about this
                'X-Mock-Request': 'true' 
            }
        };

        if (method === HttpMethod.POST || method === HttpMethod.PUT || method === HttpMethod.PATCH) {
            options.body = body;
        }

        // Save last request for re-run capability
        setLastRequest({ method, path, body });

        // REAL FETCH CALL!
        // This will be intercepted by sw.js -> App.tsx logic
        const response = await fetch(path, options);
        
        const responseText = await response.text();
        const duration = Date.now() - startTime;
        
        // Collect headers
        const responseHeaders: { key: string; value: string }[] = [];
        response.headers.forEach((value, key) => {
            responseHeaders.push({ key, value });
        });

        updateState({
          method, path, body,
          response: {
            status: response.status,
            body: responseText,
            time: duration, // This is real network duration (including simulated delay)
            headers: responseHeaders
          }
        });

    } catch (error) {
        updateState({
            response: {
              status: 0,
              body: JSON.stringify({ error: "Network Error", details: (error as Error).message }, null, 2),
              time: Date.now() - startTime,
              headers: [],
              error: "Network connection failed"
            }
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleRerun = async () => {
    if (!lastRequest) return;
    await handleSend(lastRequest);
  };
  return (
    <div className="flex flex-col h-full bg-slate-50 animate-enter">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-8 shadow-sm z-10">
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center mb-2">
            <div className="p-2.5 bg-brand-500 rounded-xl mr-4 shadow-lg shadow-brand-500/20">
                <Code className="w-6 h-6 text-white" />
            </div>
            API Prototype Lab
            </h1>
            <p className="text-slate-500 ml-[66px] text-sm max-w-2xl">
                Test your route designs instantly. Supports dynamic URL parameters (e.g., matching <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/users/:id</code>) and variable injection. Requests sent here appear in the Traffic Monitor.
            </p>
        </div>
      </div>

      <div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8 overflow-y-auto">
        
        {/* Request Panel */}
        <div className="flex flex-col gap-4">
            <div className="bg-white p-2 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 flex flex-col md:flex-row gap-2">
                <div className="relative min-w-[140px]">
                <select
                    value={state.method}
                    onChange={(e) => updateState({ method: e.target.value as HttpMethod })}
                    className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none cursor-pointer hover:bg-slate-100 transition-colors appearance-none"
                >
                    {Object.values(HttpMethod).map(m => (
                    <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
                </div>
                
                <input
                type="text"
                value={state.path}
                onChange={(e) => updateState({ path: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Enter endpoint path (e.g. /api/v1/users)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSend()}
                    disabled={isLoading || !state.path}
                    className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center min-w-[110px]"
                  >
                    {isLoading ? (
                      <RotateCcw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Send
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRerun}
                    disabled={isLoading || !lastRequest}
                    className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-800 font-bold px-6 rounded-xl transition-all shadow active:scale-95 flex items-center justify-center min-w-[110px]"
                    title={lastRequest ? `${lastRequest.method} ${lastRequest.path}` : 'No previous request'}
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Re-run
                  </button>
                </div>
            </div>
            
            {/* Request Body Input (for POST/PUT) */}
            {(state.method === HttpMethod.POST || state.method === HttpMethod.PUT || state.method === HttpMethod.PATCH) && (
                 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Request Body (JSON)</div>
                    <textarea 
                        value={state.body || ''}
                        onChange={(e) => updateState({ body: e.target.value })}
                        className="w-full h-32 p-4 font-mono text-sm outline-none resize-none"
                        placeholder='{"key": "value"}'
                    />
                 </div>
            )}
        </div>

        {/* Response Panel */}
        {state.response && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Status Bar */}
             <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                       state.response.status >= 400 || state.response.error
                       ? 'bg-red-50 text-red-700 border-red-200' 
                       : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                   }`}>
                      {state.response.status >= 400 || state.response.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      <span className="font-bold text-sm">{state.response.status}</span>
                   </div>
                   <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono text-xs font-medium">{Math.round(state.response.time)}ms</span>
                   </div>
                </div>
                <div className="text-xs text-slate-400">
                    Size: {new Blob([state.response.body]).size} B
                </div>
             </div>

             {/* Error Banner */}
             {state.response.error && (
               <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
                 <AlertCircle className="w-4 h-4 mt-0.5" />
                 <div>
                   <div className="text-sm font-bold">{state.response.error}</div>
                   <div className="text-xs opacity-80">Check your network connection or request body format.</div>
                 </div>
               </div>
             )}

             {/* Response Body & Headers */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-xl flex flex-col min-h-[400px]">
                    <div className="bg-[#0f172a] px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Response Body</span>
                        <div className="flex items-center space-x-2">
                           <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">JSON</span>
                        </div>
                    </div>
                    <div className="p-4 overflow-auto flex-1 dark-scroll">
                        <JsonViewer json={state.response.body} />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                     <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response Headers</span>
                     </div>
                     <div className="p-2">
                        {state.response.headers.map((h, i) => (
                            <div key={i} className="flex flex-col py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-dashed border-slate-100 last:border-0">
                                <span className="text-[11px] font-bold text-slate-700 mb-0.5">{h.key}</span>
                                <span className="text-xs text-slate-500 font-mono break-all">{h.value}</span>
                            </div>
                        ))}
                     </div>
                </div>
             </div>
          </div>
        )}

        {!state.response && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                    <ArrowRight className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-medium">Ready to test</p>
                <p className="text-sm opacity-75">Enter an endpoint and hit send</p>
            </div>
        )}
      </div>
    </div>
  );
};
