import React, { useState, useEffect } from 'react';
import {
  Shield, ArrowLeft, CreditCard, Download, RefreshCw, Search,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight, Filter
} from 'lucide-react';

const STATUS_STYLE = {
  paid:     { label: 'Paid',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: CheckCircle2 },
  failed:   { label: 'Failed',   cls: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-400',     icon: XCircle },
  refunded: { label: 'Refunded', cls: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-400',    icon: RefreshCw },
  created:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400',   icon: Clock },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.created;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>
      <Icon size={11} />{s.label}
    </span>
  );
}

export default function PaymentsHistory({ user, onBack, onNavigate }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const email = user?.email || (typeof user === 'string' ? user : null);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`http://localhost:8000/api/user/subscription/${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setPayments(d.payments || []); setLoading(false); })
      .catch(() => { setError('Failed to load payment history.'); setLoading(false); });
  }, [email]);

  const filtered = payments.filter(p => {
    const matchQ = !query.trim() ||
      p.order_id?.toLowerCase().includes(query.toLowerCase()) ||
      p.plan?.toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === 'all' || p.status === statusFilter;
    return matchQ && matchS;
  });

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
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
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
            <ArrowLeft size={16} />Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="font-heading font-extrabold text-2xl text-slate-800">Payment History</h1>
          <p className="text-sm text-slate-400 mt-0.5">All transactions for <span className="font-semibold text-slate-600">{email || 'your account'}</span></p>
        </div>

        {/* Summary Cards */}
        {payments.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Transactions', value: payments.length, color: 'blue' },
              { label: 'Successful Payments', value: payments.filter(p => p.status === 'paid').length, color: 'green' },
              { label: 'Total Paid (INR)', value: `₹${totalPaid.toFixed(2)}`, color: 'purple' },
            ].map(c => (
              <div key={c.label} className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm`}>
                <div className="text-xs text-slate-400 font-medium mb-1">{c.label}</div>
                <div className={`text-2xl font-extrabold font-heading ${
                  c.color === 'blue' ? 'text-blue-600' : c.color === 'green' ? 'text-emerald-600' : 'text-purple-600'
                }`}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by order ID or plan…"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1"><Filter size={12} />Status:</span>
              {['all', 'paid', 'created', 'failed', 'refunded'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>{s === 'all' ? 'All' : STATUS_STYLE[s]?.label || s}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading payment history…</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          ) : !email ? (
            <div className="p-12 text-center">
              <CreditCard size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Please log in to view payment history.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <CreditCard size={40} className="text-slate-200 mx-auto mb-4" />
              <h3 className="font-heading font-bold text-slate-700 mb-2">
                {payments.length === 0 ? 'No Payments Yet' : 'No Results Found'}
              </h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                {payments.length === 0
                  ? 'Upgrade your plan to unlock premium security features.'
                  : `No payments match your search or filter.`}
              </p>
              {payments.length === 0 && (
                <button onClick={() => onNavigate && onNavigate('payment')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-sm">
                  View Plans <ChevronRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Order ID', 'Plan', 'Amount', 'Currency', 'Billing', 'Date', 'Status', 'Invoice'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-500 truncate max-w-[130px] block">{p.order_id}</span>
                        {p.payment_id && (
                          <span className="font-mono text-[10px] text-slate-300 truncate max-w-[130px] block">{p.payment_id}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.plan === 'Business' ? 'bg-purple-100 text-purple-700' :
                          p.plan === 'Pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>{p.plan}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">₹{p.amount?.toFixed(2)}</td>
                      <td className="px-5 py-4 text-slate-500">{p.currency || 'INR'}</td>
                      <td className="px-5 py-4 text-slate-500 capitalize text-xs">{p.billing_period || 'monthly'}</td>
                      <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        }) : '—'}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-5 py-4">
                        {p.status === 'paid' ? (
                          <button className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 text-xs font-semibold rounded-xl transition-all">
                            <Download size={12} />Invoice
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              Back to Dashboard <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
