import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { Terminal, Pause, Play, Trash, Search, Wifi } from 'lucide-react';

interface LogViewerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClearLogs }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  const lowerFilter = filter.toLowerCase();
  const filteredLogs = logs.filter(l => 
    l.path.toLowerCase().includes(lowerFilter) || 
    l.method.toLowerCase().includes(lowerFilter) ||
    l.statusCode.toString().includes(lowerFilter) ||
    l.ip.toLowerCase().includes(lowerFilter)
  );

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-300 font-mono text-sm animate-enter">
      {/* Header */}
      <div className="px-6 py-4 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
             <Terminal className="w-5 h-5 text-brand-400" />
          </div>
          <div>
             <h2 className="font-bold text-slate-100 tracking-tight">Traffic Monitor</h2>
             <div className="flex items-center space-x-2 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    {isPaused ? 'Paused' : 'Listening...'}
                </span>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
           <div className="relative group">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-slate-300 transition-colors" />
             <input 
              type="text" 
              placeholder="Filter logs..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-64 transition-all"
             />
           </div>
           
           <div className="h-6 w-px bg-slate-700 mx-2"></div>

           <button 
             onClick={() => setIsPaused(!isPaused)} 
             className={`p-2 rounded-lg transition-colors border ${
                 isPaused 
                 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                 : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
             }`}
             title={isPaused ? "Resume" : "Pause"}
           >
             {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
           </button>
           <button 
             onClick={onClearLogs} 
             className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
             title="Clear Logs"
           >
             <Trash className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Log Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-[#0f172a] border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-1">Method</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-5">Path</div>
          <div className="col-span-1 text-right">Latency</div>
          <div className="col-span-2 text-right">Client IP</div>
      </div>

      {/* Logs Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 dark-scroll scroll-smooth">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
             <div className="p-4 bg-slate-800/50 rounded-full">
                <Wifi className="w-8 h-8 opacity-50" />
             </div>
             <p className="text-xs">Waiting for incoming traffic from Prototype Lab...</p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="grid grid-cols-12 gap-4 px-4 py-2 hover:bg-[#1e293b] rounded-lg transition-colors border border-transparent hover:border-slate-700/50 items-center text-xs group">
              <div className="col-span-2 text-slate-500 group-hover:text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</div>
              
              <div className="col-span-1">
                 <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    log.method === 'GET' ? 'bg-blue-500/10 text-blue-400' :
                    log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400' :
                    log.method === 'DELETE' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {log.method}
                 </span>
              </div>
              
              <div className="col-span-1">
                 <span className={`font-bold ${log.statusCode >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {log.statusCode}
                 </span>
              </div>

              <div className="col-span-5 text-slate-300 truncate font-medium" title={log.path}>{log.path}</div>
              
              <div className="col-span-1 text-right text-slate-500">{log.duration}ms</div>
              <div className="col-span-2 text-right text-slate-600">{log.ip}</div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};