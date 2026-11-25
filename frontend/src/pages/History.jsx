import React, { useState, useEffect } from 'react';
import {
  Shield, Search, History as HistoryIcon, ChevronRight,
  Download, Trash2, FileText, RefreshCw, Loader2, AlertTriangle
} from 'lucide-react';

function scoreColor(s) {
  if (s >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' };
  if (s >= 60) return { text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' };
  return            { text: 'text-red-700',     bg: 'bg-red-50',    border: 'border-red-100' };
}

export default function HistoryPage({ user, onBack, onNavigate }) {
  const [query, setQuery] = useState('');
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  const email = user?.email || (typeof user === 'string' ? user : null);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`http://localhost:8000/api/scan-history?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setScans(d.scans || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  const filtered = scans.filter(h =>
    !query.trim() || h.target?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-heading font-extrabold text-lg text-slate-800 hidden sm:block">
              AI Security<span className="text-blue-600">Analyzer</span>
            </span>
          </div>
          <button onClick={onBack}
            className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors flex items-center gap-1.5">
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 py-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"linear-gradient(rgba(59,130,246,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.1) 1px,transparent 1px)",backgroundSize:"30px 30px"}} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-4 border border-blue-500/30">
            <HistoryIcon size={13} />Scan History
          </div>
          <h1 className="font-heading font-extrabold text-4xl text-white mb-2">Previous Scans</h1>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            Review, download, or re-run any of your past security analyses.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 -mt-8 pb-20 relative z-10">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md">

          {/* Search bar */}
          <div className="p-5 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search domain or URL..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                aria-label="Search scan history" />
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 size={28} className="animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading scan history…</p>
              </div>
            ) : !email ? (
              <div className="py-16 text-center">
                <AlertTriangle size={28} className="text-amber-400 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Please log in to view your scan history.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                {scans.length === 0
                  ? <><p className="font-semibold text-slate-600 mb-2">No scans yet</p><p>Run a scan from the dashboard to see history here.</p></>
                  : `No results for "${query}"`}
              </div>
            ) : filtered.map((h, i) => {
              const col = scoreColor(h.score);
              const risk = h.risk_level || (h.score >= 80 ? 'Low' : h.score >= 60 ? 'Medium' : 'High');
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors group">
                  {/* Score badge */}
                  <div className={`w-14 h-14 rounded-2xl ${col.bg} border ${col.border} flex flex-col items-center justify-center shrink-0`}>
                    <span className={`text-xl font-extrabold font-heading ${col.text}`}>{h.score}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/100</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate font-mono">{h.target}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </div>
                  </div>

                  {/* Risk badge */}
                  <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    risk === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    risk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-red-50 text-red-700 border-red-100'
                  }`}>{risk} Risk</span>

                  {/* Mode */}
                  <span className={`hidden md:inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    h.scan_mode === 'active' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>{h.scan_mode}</span>

                  {/* Actions */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onNavigate && onNavigate('scan')} title="Rescan"
                      className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors">
                      <RefreshCw size={13} />
                    </button>
                    <button title="Download" className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
            <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-1">
              Back to Dashboard <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
