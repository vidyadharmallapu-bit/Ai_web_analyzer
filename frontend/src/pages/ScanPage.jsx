import React, { useState } from 'react';
import {
  Shield, Lock, Globe, Server, AlertTriangle, CheckCircle2,
  Loader2, ArrowRight, Search, Activity, Zap, Bot
} from 'lucide-react';

const SCAN_STEPS = [
  { id: 'ssrf',    label: 'SSRF & Scope Validation',         icon: Shield },
  { id: 'dns',     label: 'Checking DNS Records & SPF/DMARC', icon: Globe },
  { id: 'ssl',     label: 'Analyzing SSL/TLS Certificate',   icon: Lock },
  { id: 'headers', label: 'Scanning HTTP Security Headers',  icon: Server },
  { id: 'cookies', label: 'Auditing Cookie Security Flags',   icon: Lock },
  { id: 'crawl',   label: 'Crawling Same-Origin Assets',     icon: Search },
  { id: 'tech',    label: 'Fingerprinting Technology Stack', icon: Zap },
  { id: 'ai',      label: 'Synthesizing AI Explanations',    icon: Bot },
  { id: 'report',  label: 'Building Verified Security Audit',icon: Activity },
];

function isValidWebsiteUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const val = str.trim();
  if (!val) return false;
  if (/\s/.test(val)) return false;

  let testUrl = val;
  if (!/^https?:\/\//i.test(testUrl)) {
    testUrl = 'https://' + testUrl;
  }

  try {
    const parsed = new URL(testUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname;
    if (!hostname) return false;

    const hasDot = hostname.includes('.');
    if (!hasDot) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(hostname)) return false;
    } else {
      const parts = hostname.split('.');
      const tld = parts[parts.length - 1];
      if (!tld || tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(hostname)) return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export default function ScanPage({ onScanComplete, onBack }) {
  const [url, setUrl]                     = useState('');
  const [scanning, setScanning]           = useState(false);
  const [currentStep, setCurrentStep]     = useState(0);
  const [progress, setProgress]           = useState(0);
  const [error, setError]                 = useState('');
  const [errorTitle, setErrorTitle]       = useState('Invalid URL');

  const startScan = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorTitle('Invalid URL');
      setError('Please enter a website URL.');
      return;
    }

    if (!isValidWebsiteUrl(url)) {
      setErrorTitle('Invalid URL');
      setError('Please enter a valid website URL, for example: https://example.com');
      return;
    }

    setScanning(true);
    setCurrentStep(0);
    setProgress(0);
    setError('');
    setErrorTitle('');

    let step = 0;
    const total = SCAN_STEPS.length;
    const interval = setInterval(() => {
      step++;
      if (step < total - 1) {
        setCurrentStep(step);
        setProgress(Math.round((step / total) * 88));
      }
    }, 650);

    try {
      const res = await fetch('http://localhost:8000/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          scan_mode: 'passive'
        }),
      });

      clearInterval(interval);

      const data = await res.json();

      if (!res.ok) {
        setScanning(false);
        setErrorTitle('Scan Rejected');
        setError(data.detail?.message || data.message || 'Please enter a valid website URL.');
        return;
      }

      setCurrentStep(total - 1);
      setProgress(100);

      if (data.error) {
        setErrorTitle('Scan Notice');
        setError(data.error);
      }

      setTimeout(() => onScanComplete(data), 800);
    } catch (err) {
      clearInterval(interval);
      setScanning(false);
      setErrorTitle('Backend Unavailable');
      setError('Cannot connect to the scan server at http://localhost:8000. Start the backend and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-cs-bg flex flex-col font-sans">
      {/* Top Hero Band */}
      <div className="bg-gradient-to-br from-primary to-primary-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-grid opacity-10 pointer-events-none" />
        <div className="absolute -top-20 right-0 w-96 h-96 bg-accent/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Nav */}
        <nav className="relative z-10 container flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-white tracking-tight">
              Cyber<span className="text-blue-300">Shield</span>
            </span>
          </div>
          <button
            onClick={onBack}
            className="text-blue-200 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            ← Back to Dashboard
          </button>
        </nav>

        {/* Heading */}
        <div className="relative z-10 container text-center py-12 pb-20">
          <div className="badge mb-5 bg-blue-900/60 text-blue-300 border-blue-700 w-fit mx-auto">
            <Shield size={13} /> Security Assessment Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-white mb-4 leading-tight">
            Evidence-Based Security Assessment
          </h1>
          <p className="text-blue-200 text-lg max-w-md mx-auto">
            Real configuration auditing, SSRF protections, same-origin asset discovery, and verified risk scoring.
          </p>
        </div>
      </div>

      {/* Card */}
      <main className="flex-1 container max-w-2xl mx-auto -mt-10 pb-20 relative z-10">
        <div className="card-md rounded-3xl overflow-hidden shadow-card-lg">

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-8 md:p-10">
            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{errorTitle || 'Scan Error'}</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {!scanning ? (
              /* ── Input form ── */
              <form onSubmit={startScan} noValidate>
                <h2 className="font-heading font-bold text-2xl text-cs-text mb-1">Analyze a Target Host</h2>
                <p className="text-cs-muted text-sm mb-7">Real-time HTTP headers, SSL/TLS validation, cookie flags, DNS SPF/DMARC, and tech stack detection.</p>

                <div className="space-y-3 mb-6">
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(''); }}
                      placeholder="https://example.com"
                      className="input-field-lg pl-11 w-full"
                      aria-label="Website URL to analyze"
                      required
                    />
                  </div>

                  {/* Real-time validation feedback */}
                  {url.trim().length > 0 && !isValidWebsiteUrl(url) && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 px-1">
                      <AlertTriangle size={14} /> Invalid URL. Please enter a valid website URL, e.g. <span className="underline">https://example.com</span>
                    </div>
                  )}
                  {url.trim().length > 0 && isValidWebsiteUrl(url) && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-1">
                      <CheckCircle2 size={14} /> Valid website URL
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!isValidWebsiteUrl(url)}
                    className="btn-primary w-full py-4 text-base rounded-xl font-bold group disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Analyze Website
                    <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap justify-center gap-5 pt-5 border-t border-cs-border">
                  {[
                    [CheckCircle2, 'SSRF Protection'],
                    [CheckCircle2, 'Evidence-Based'],
                    [CheckCircle2, 'OWASP Verification'],
                    [CheckCircle2, 'AI Explanation'],
                  ].map(([Icon, label]) => (
                    <span key={label} className="check-pill text-xs text-cs-muted">
                      <Icon size={14} className="text-success" /> {label}
                    </span>
                  ))}
                </div>
              </form>
            ) : (
              /* ── Scanning UI ── */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="font-heading font-bold text-xl text-cs-text">Security Assessment in Progress</h2>
                    <p className="text-cs-muted text-sm mt-0.5">Mode: <span className="font-bold uppercase text-accent">passive</span></p>
                  </div>
                  <div className="text-3xl font-extrabold font-heading text-accent tabular-nums">{progress}%</div>
                </div>

                <div className="space-y-3 mb-8">
                  {SCAN_STEPS.map((s, idx) => {
                    const Icon = s.icon;
                    const isDone = idx < currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <div key={s.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                        isDone ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' :
                        isCurrent ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                      }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-emerald-100 text-emerald-600' :
                          isCurrent ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                        </div>
                        <span className="text-sm font-semibold flex-1">{s.label}</span>
                        {isCurrent && <Loader2 size={16} className="text-blue-600 animate-spin" />}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl text-slate-300 text-xs font-mono">
                  <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-800 pb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    Target: {url}
                  </div>
                  <div className="animate-pulse">Analyzing target configuration &amp; validating security controls...</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
