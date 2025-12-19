import React, { useMemo, useState } from 'react';
import { fetchRandomUser, RandomUser } from '../services/apiService';
import { RefreshCcw, AlertCircle } from 'lucide-react';

export const ExternalApiPanel: React.FC = () => {
  const [user, setUser] = useState<RandomUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setUser(null); // clear previous user so error is more visible
    let t: any;
    try {
      // Force debug logging
      console.log('Starting fetch, navigator.onLine:', navigator.onLine);
      
      const controller = new AbortController();
      t = setTimeout(() => controller.abort(), 15000); // timeout 15s
      const u = await fetchRandomUser(controller.signal);
      setUser(u);
    } catch (e: any) {
      console.log('Fetch error caught:', e);
      const name = e?.name || '';
      const msg = e?.message || '';
      let errorMsg = '';
      if (name === 'AbortError') {
        errorMsg = 'Request timeout. Please try again.';
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_INTERNET_DISCONNECTED') || name === 'TypeError') {
        errorMsg = 'Network error: You appear to be offline or the server is unreachable.';
      } else if (msg) {
        errorMsg = msg;
      } else {
        errorMsg = 'Failed to fetch data. You might be offline.';
      }
      setError(errorMsg);
      console.log('Error state set to:', errorMsg);
    } finally {
      if (t) clearTimeout(t);
      setLoading(false);
    }
  };

  const prettyRaw = useMemo(() => user ? JSON.stringify(user.raw, null, 2) : '', [user]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">External API: RandomUser</h2>
        <button
          onClick={() => {
            console.log('Fetch button clicked!');
            handleFetch();
          }}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white font-bold flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Fetch User'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            <div className="text-sm font-bold">Failed to fetch user</div>
            <div className="text-xs opacity-80">{error}</div>
          </div>
        </div>
      )}

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-white rounded-xl border p-4 flex items-center gap-4">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200" />
            )}
            <div>
              <div className="font-bold">{user.name || '(no name)'}</div>
              <div className="text-sm text-slate-600">{user.email || '(no email)'}</div>
            </div>
          </div>
          <div className="md:col-span-2 bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="bg-[#0f172a] px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Raw JSON</span>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="checkbox" checked={showRaw} onChange={e => setShowRaw(e.target.checked)} />
                Show
              </label>
            </div>
            {showRaw && (
              <pre className="p-3 text-xs text-emerald-200 whitespace-pre-wrap">{prettyRaw}</pre>
            )}
          </div>
        </div>
      )}

      {!user && !loading && (
        <div className="text-sm text-slate-500">Click "Fetch User" to load data from RandomUser API.</div>
      )}
    </div>
  );
};
