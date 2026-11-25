import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import {
  Shield, LayoutDashboard, Search, FileText, History, Settings, LogOut,
  Bell, ChevronRight, BarChart2, Download, Sparkles, TrendingUp, Globe,
  Database, Server, Lock, Activity, AlertTriangle, CheckCircle, XCircle,
  Cpu, Wifi, Terminal, ExternalLink, Layers, Filter, CheckCircle2, Info,
  Menu, X, HardDrive, ArrowRight, Zap, Eye, RefreshCw, CreditCard,
  Clock, Star, Users, Package, BarChart, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Utility: download helpers ────────────────────────────────────────────────
function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function reportText(r) {
  const findings = r.findings || r.vulnerabilities || [];
  const score = r.security_score ?? r.score ?? 0;
  const risk = r.risk_level ?? (score >= 80 ? 'Low Risk' : score >= 60 ? 'Medium Risk' : 'High Risk');
  return [
    `CYBERSHIELD AI — SECURITY AUDIT REPORT`,
    `Target Website: ${r.domain || r.url || 'N/A'}`,
    `Overall Score: ${score}/100 (${risk})`,
    `Scan Date: ${new Date().toLocaleString()}`,
    '',
    '── EXECUTIVE SUMMARY ────────────────────────',
    `The target website has an overall security score of ${score}/100, classified as ${risk}.`,
    `Transport layer security, SSL certificates, headers, cookies, and DNS posture have been audited.`,
    '',
    '── SECURITY FINDINGS ────────────────────────',
    ...findings.map((v, i) => `[${i+1}] [Severity: ${v.severity}] ${v.title || v.name || v.header}\n   Evidence: ${v.evidence || 'N/A'}\n   Recommendation: ${v.remediation || 'Configure recommended security controls.'}`),
    '',
    '── PERFORMANCE & METRICS ───────────────────',
    `Response Time: ${r.responseTime || 0}ms`,
    `Status Code: ${r.traffic?.statusCode ?? 'N/A'}`,
    '',
    '── AI TECHNICAL EXPLANATIONS ───────────────',
    ...(r.ai_explanations || []).map(e => `• ${e.title}: ${e.why_it_matters}`),
  ].join('\n');
}

function exportPDF(r) {
  if (!r) return;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const findings = r.findings || r.vulnerabilities || [];
  const score = r.security_score ?? r.score ?? 0;
  const risk = r.risk_level ?? (score >= 80 ? 'Low Risk' : score >= 60 ? 'Medium Risk' : 'High Risk');

  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text("CyberShield AI — Security Audit Report", 40, 50);

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Target Website: ${r.domain || r.url || 'N/A'}`, 40, 75);
  doc.text(`Scan Date: ${new Date().toLocaleString()}`, 40, 95);
  doc.text(`Overall Security Score: ${score} / 100 (${risk})`, 40, 115);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Executive Summary", 40, 155);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const summaryText = `The target website ${r.domain || 'target'} has been evaluated through an automated evidence-based security assessment. The overall security score is ${score}/100 (${risk}). HTTPS, TLS configuration, security headers, cookie flags, DNS mail protection (SPF/DMARC), and attack surface assets were audited to ensure compliance with best practices.`;
  doc.text(summaryText, 40, 175, { maxWidth: 520, lineHeightFactor: 1.5 });

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Key Security Findings", 40, 245);

  let y = 270;
  findings.forEach((f, index) => {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${index + 1}. [${f.severity}] ${f.title || f.name || f.header}`, 40, y);
    y += 18;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Evidence: ${f.evidence || 'N/A'}`, 55, y);
    y += 16;
    if (f.remediation) {
      doc.text(`Recommendation: ${f.remediation}`, 55, y);
      y += 18;
    }
    y += 12;
  });

  doc.save(`${(r.domain || 'security_report').replace(/[^a-zA-Z0-9]/g, '_')}_audit_report.pdf`);
}

function exportCSV(r) {
  if (!r) return;
  const list = r.findings || r.vulnerabilities || [];
  const rows = [
    ['ID', 'Severity', 'Title', 'Confidence', 'Evidence'],
    ...list.map(v => [v.id || '', v.severity, v.title || v.name || v.header, v.confidence || 'High', v.evidence || '']),
  ];
  downloadFile(`${r.domain || 'report'}.csv`, rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJSON(r) {
  if (!r) return downloadFile(`${r.domain || 'report'}.json`, JSON.stringify(r, null, 2), 'application/json');
}

// ─── Arc Score Ring ───────────────────────────────────────────────────────────
function ArcScore({ score }) {
  const size = 180;
  const strokeW = 14;
  const r = (size / 2) - strokeW;
  const circum = 2 * Math.PI * r;
  const arc = 0.75; // 270° arc
  const offset = circum * (1 - arc * (score / 100));
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  const riskLabel = score >= 80 ? 'Low Risk' : score >= 60 ? 'Medium Risk' : 'High Risk';
  const riskColor = score >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : score >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeW}
            strokeDasharray={`${circum * arc} ${circum * (1 - arc)}`} strokeLinecap="round" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
            strokeDasharray={`${circum * arc * (score / 100)} ${circum - (circum * arc * (score / 100))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-extrabold text-slate-900 font-heading leading-none">{score}</span>
          <span className="text-sm text-slate-500 font-medium mt-1">/ 100</span>
        </div>
      </div>
      <span className={`mt-3 text-xs font-bold px-4 py-1.5 rounded-full border ${riskColor}`}>{riskLabel}</span>
    </div>
  );
}

// ─── Health Card ──────────────────────────────────────────────────────────────
function HealthCard({ icon: Icon, label, value, ok, warn }) {
  const state = ok ? 'ok' : warn ? 'warn' : 'fail';
  const styles = {
    ok:   { icon: 'bg-emerald-50 text-emerald-600 border-emerald-100', val: 'text-emerald-800', dot: 'bg-emerald-500' },
    warn: { icon: 'bg-amber-50 text-amber-600 border-amber-100',       val: 'text-amber-800',   dot: 'bg-amber-500' },
    fail: { icon: 'bg-red-50 text-red-600 border-red-100',             val: 'text-red-800',     dot: 'bg-red-500' },
  }[state];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200">
      <div className={`w-12 h-12 rounded-2xl border ${styles.icon} flex items-center justify-center shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">{label}</div>
        <div className={`text-base font-bold truncate ${styles.val} flex items-center gap-2`}>
          <span className={`w-2 h-2 rounded-full ${styles.dot} shrink-0`} />
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50   text-blue-700   border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50  text-amber-700  border-amber-100',
    red:   'bg-red-50    text-red-700    border-red-100',
    purple:'bg-purple-50 text-purple-700 border-purple-100',
    slate: 'bg-slate-50  text-slate-700  border-slate-200',
  };
  return (
    <div className={`flex flex-col items-center p-5 rounded-2xl border ${colors[color]} hover:shadow-sm transition-all`}>
      <Icon size={24} className="mb-2 opacity-80" />
      <span className="text-3xl font-extrabold font-heading leading-none">{value}</span>
      <span className="text-xs font-semibold mt-1.5 opacity-80 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────
const SEV_STYLE = {
  Critical:      'bg-red-100 text-red-800 border border-red-200',
  High:          'bg-orange-100 text-orange-800 border border-orange-200',
  Medium:        'bg-amber-100 text-amber-800 border border-amber-200',
  Low:           'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Informational: 'bg-blue-100 text-blue-800 border border-blue-200',
  Info:          'bg-blue-100 text-blue-800 border border-blue-200',
};
function SevBadge({ sev }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide ${SEV_STYLE[sev] || SEV_STYLE.Low}`}>{sev}</span>;
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h2 className="font-heading font-bold text-slate-900 flex items-center gap-2.5 text-xl md:text-2xl">
          <span className="w-9 h-9 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0">
            <Icon size={18} />
          </span>
          {title}
        </h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1 ml-11 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeHeaders(h) {
  if (Array.isArray(h)) return h;
  return Object.entries(h || {}).map(([header, ok]) => ({
    header, status: ok ? 'Present' : 'Missing', severity: ok ? 'Info' : 'Medium',
  }));
}
function normalizeCookies(c) {
  if (Array.isArray(c)) return c;
  if (!c) return [];
  return [c];
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ user, scanResult, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [attackTab, setAttackTab] = useState('pages');
  const [visible, setVisible] = useState(false);
  const [subInfo, setSubInfo] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [expandedFindings, setExpandedFindings] = useState({});
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const email = user?.email || user;
    if (email) {
      fetch(`http://localhost:8000/api/subscription?email=${encodeURIComponent(email)}`)
        .then(r => r.json()).then(setSubInfo).catch(() => {});
      fetch(`http://localhost:8000/api/scan-history?email=${encodeURIComponent(email)}`)
        .then(r => r.json()).then(d => setScanHistory(d.scans || [])).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!scanResult) return;
    const email = user?.email || user;
    const body = {
      email: email || null,
      target: scanResult.domain || scanResult.url || '',
      score: scanResult.security_score ?? scanResult.score ?? 0,
      risk_level: scanResult.risk_level || null,
      findings_count: (scanResult.findings || scanResult.vulnerabilities || []).length,
      scan_mode: scanResult.scan_mode || 'passive',
    };
    fetch('http://localhost:8000/api/scan-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json()).then(() => {
      if (email) {
        fetch(`http://localhost:8000/api/scan-history?email=${encodeURIComponent(email)}`)
          .then(r => r.json()).then(d => setScanHistory(d.scans || [])).catch(() => {});
      }
    }).catch(() => {});
  }, [scanResult]);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    }
    onNavigate('landing');
  };

  const score = scanResult?.security_score ?? scanResult?.score ?? 0;
  const findings = scanResult?.findings || scanResult?.vulnerabilities || [];
  const headers = normalizeHeaders(scanResult?.headers);
  const cookies = normalizeCookies(scanResult?.cookies);
  const assets = scanResult?.assets || [];
  const ports = scanResult?.ports || [];
  const dnsRec = scanResult?.dns || {};
  const technologies = scanResult?.technologies || [];
  const aiExplanations = scanResult?.ai_explanations || [];
  const scoreBreakdown = scanResult?.score_breakdown || {};

  const findingsBySeverity = {
    Critical: findings.filter(f => f.severity === 'Critical').length,
    High: findings.filter(f => f.severity === 'High').length,
    Medium: findings.filter(f => f.severity === 'Medium').length,
    Low: findings.filter(f => f.severity === 'Low').length,
  };
  const filtered = findings.filter(f => severityFilter === 'All' || f.severity === severityFilter);

  const planName = subInfo?.plan || user?.plan || 'Free';
  const scansUsed = subInfo?.scans_used ?? 0;
  const scanLimit = subInfo?.scan_limit ?? 5;
  const scanPct = scanLimit > 0 ? Math.min((scansUsed / scanLimit) * 100, 100) : 0;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Search, label: 'New Scan', id: 'scan' },
    { icon: History, label: 'Scan History', id: 'history' },
    { icon: FileText, label: 'Reports', id: 'reports' },
    { icon: CreditCard, label: 'Pricing', id: 'payment' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  const attackCats = {
    pages:    { label: 'Pages',    icon: Globe,    items: assets.filter(a => a.type === 'page')   },
    forms:    { label: 'Forms',    icon: FileText,  items: assets.filter(a => a.type === 'form')   },
    scripts:  { label: 'Scripts',  icon: Terminal,  items: assets.filter(a => a.type === 'script') },
    apis:     { label: 'APIs',     icon: Server,    items: assets.filter(a => a.type === 'api')    },
    resources:{ label: 'Resources',icon: Package,   items: assets.filter(a => !['page','form','script','api'].includes(a.type)) },
    external: { label: 'External', icon: ExternalLink, items: [] },
  };

  const userName = user?.name || user?.full_name || (typeof user === 'string' ? user : 'User');

  const toggleFinding = (index) => {
    setExpandedFindings(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Executive summary text generator
  const getExecutiveSummary = () => {
    if (!scanResult) return '';
    const sslValid = scanResult.ssl?.valid;
    const missingHeadersCount = headers.filter(h => h.status === 'Missing').length;
    const dnsOk = Boolean(dnsRec.spf && dnsRec.dmarc);

    let posture = 'moderate';
    if (score >= 80) posture = 'strong';
    else if (score < 60) posture = 'critical';

    return `The target website (${scanResult.domain}) demonstrates a ${posture} security posture with an overall score of ${score}/100. ${
      sslValid ? 'Transport layer protection (HTTPS/TLS) is properly active.' : 'SSL/TLS certificate issues were observed.'
    } ${
      missingHeadersCount === 0 ? 'All recommended HTTP security headers are correctly implemented.' : `${missingHeadersCount} security headers require attention to prevent browser-based attacks.`
    } ${
      dnsOk ? 'Mail and domain authentication records (SPF, DMARC) are fully configured.' : 'DNS mail security records (SPF/DMARC) are missing, exposing the domain to potential spoofing.'
    }`;
  };

  return (
    <div className={`min-h-screen bg-slate-50 font-sans transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>

      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-heading font-extrabold text-lg text-slate-800 tracking-tight hidden sm:block">
              AI Security<span className="text-blue-600">Analyzer</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = item.id === 'dashboard';
              return (
                <button key={item.id} onClick={() => item.id !== 'dashboard' && onNavigate(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}>
                  <Icon size={15} />{item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <span className={`hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
              planName === 'Business' ? 'bg-purple-50 text-purple-700 border-purple-200' :
              planName === 'Pro' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <Sparkles size={11} />{planName}
            </span>

            <button className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors relative">
              <Bell size={18} />
              {findings.some(f => f.severity === 'Critical') && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </button>

            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>

            <button onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50 font-medium transition-all">
              <LogOut size={14} />
            </button>

            <button onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => { setMobileOpen(false); if (item.id !== 'dashboard') onNavigate(item.id); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon size={16} />{item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Page title row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-slate-900 tracking-tight">Security Assessment Report</h1>
            <p className="text-base text-slate-600 mt-1">
              Comprehensive cybersecurity audit report for <span className="font-bold text-slate-900">{scanResult?.domain || 'Target'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('scan')}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all">
              <Search size={16} />New Scan
            </button>
            {scanResult && (
              <button onClick={() => exportPDF(scanResult)}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-sm font-bold rounded-xl transition-all shadow-sm">
                <Download size={16} />Export PDF Report
              </button>
            )}
          </div>
        </div>

        {/* ── Subscription Usage ── */}
        {subInfo && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                planName === 'Business' ? 'bg-purple-50 text-purple-700' :
                planName === 'Pro' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                <Sparkles size={20} />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-bold uppercase">Current Plan</div>
                <div className="font-bold text-slate-900 text-base">{planName}</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
                <span>Scan Quota</span>
                <span className={scansUsed >= scanLimit ? 'text-red-600 font-bold' : ''}>
                  {scansUsed} / {scanLimit} scans used
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${
                  scanPct >= 90 ? 'bg-red-500' : scanPct >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                }`} style={{ width: `${scanPct}%` }} />
              </div>
            </div>
            {scansUsed >= scanLimit && (
              <button onClick={() => onNavigate('payment')}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shrink-0">
                <Sparkles size={14} />Upgrade Plan
              </button>
            )}
          </div>
        )}

        {!scanResult ? (
          /* ── Empty State ── */
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield size={40} />
            </div>
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-slate-900 mb-3">No Security Assessment Available</h2>
            <p className="text-slate-600 text-base max-w-lg mx-auto mb-8 leading-relaxed">
              Run an evidence-based security scan to generate your comprehensive cybersecurity audit report with clear risk ratings and actionable recommendations.
            </p>
            <button onClick={() => onNavigate('scan')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-2xl shadow-md transition-all">
              Run Security Assessment <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-10 animate-fade-up">

            {/* ── SECURITY ASSESSMENT HEADER & METADATA ── */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <div className="grid md:grid-cols-4 gap-6 items-center">
                <div className="md:col-span-1 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
                  <ArcScore score={score} />
                </div>
                <div className="md:col-span-3 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
                      Website: {scanResult.domain}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                      Scan Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold uppercase">
                      Mode: {scanResult.scan_mode || 'passive'}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-xl text-slate-900 mb-2">Executive Summary</h2>
                    <p className="text-base text-slate-700 leading-relaxed font-normal">
                      {getExecutiveSummary()}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {Object.entries(findingsBySeverity).map(([sev, count]) => (
                      <div key={sev} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                        <div className={`text-2xl font-extrabold font-heading ${
                          sev === 'Critical' ? 'text-red-600' :
                          sev === 'High' ? 'text-orange-600' :
                          sev === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>{count}</div>
                        <div className="text-xs text-slate-500 font-bold uppercase mt-0.5">{sev}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECURITY HEALTH METRICS ── */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <SectionHeader icon={Activity} title="Security Health Metrics"
                subtitle="High-level posture across core transport, header, cookie, and mail security controls" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <HealthCard icon={Lock} label="SSL / TLS Certificate"
                  value={scanResult.ssl?.valid ? `Valid · ${scanResult.ssl?.tls_version || 'TLS 1.3'}` : 'Invalid / Self-Signed'}
                  ok={scanResult.ssl?.valid} warn={false} />
                <HealthCard icon={Globe} label="HTTPS Enforcement"
                  value={scanResult.ssl?.valid ? 'Enabled & Secure' : 'Disabled'}
                  ok={scanResult.ssl?.valid} warn={false} />
                <HealthCard icon={Server} label="Security Headers"
                  value={`${headers.filter(h => h.status === 'Missing').length === 0 ? 'All' : headers.filter(h => h.status === 'Present').length} / ${headers.length} Detected`}
                  ok={headers.filter(h => h.status === 'Missing').length === 0}
                  warn={headers.filter(h => h.status === 'Missing').length <= 2} />
                <HealthCard icon={Database} label="Cookie Security Flags"
                  value={cookies.length === 0 ? 'No Cookies Found' : cookies.every(c => c.secure && c.httpOnly) ? 'Secure & HttpOnly Set' : 'Missing Secure/HttpOnly'}
                  ok={cookies.length === 0 || cookies.every(c => c.secure && c.httpOnly)}
                  warn={cookies.some(c => !c.secure || !c.httpOnly)} />
                <HealthCard icon={Wifi} label="DNS & Mail Protection"
                  value={(dnsRec.spf && dnsRec.dmarc) ? 'SPF + DMARC Configured' : 'Missing Mail Records'}
                  ok={Boolean(dnsRec.spf && dnsRec.dmarc)} warn={Boolean(dnsRec.spf || dnsRec.dmarc)} />
                <HealthCard icon={Activity} label="Response Latency"
                  value={`${scanResult.responseTime || 0} ms`}
                  ok={(scanResult.responseTime || 0) < 800}
                  warn={(scanResult.responseTime || 0) < 1500} />
              </div>
            </div>

            {/* ── SCAN SUMMARY BAR ── */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <SectionHeader icon={BarChart} title="Scan Summary Statistics"
                subtitle="Overview of discovered endpoints, technology fingerprints, and findings" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                <StatChip icon={Globe} label="Pages Discovered" value={assets.filter(a => a.type === 'page').length || 1} color="blue" />
                <StatChip icon={Server} label="APIs & Endpoints" value={assets.filter(a => a.type === 'api').length} color="purple" />
                <StatChip icon={Cpu} label="Technologies" value={technologies.length} color="green" />
                <StatChip icon={Terminal} label="Open Ports" value={ports.length} color="amber" />
                <StatChip icon={AlertTriangle} label="Total Findings" value={findings.length} color={findings.some(f => f.severity === 'Critical') ? 'red' : 'amber'} />
              </div>
            </div>

            {/* ── SECURITY FINDINGS (READABLE CARDS) ── */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-200">
                <SectionHeader icon={AlertTriangle} title={`Security Findings (${filtered.length})`}
                  subtitle="Detailed findings and recommended remediation actions for non-technical and technical stakeholders">
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => exportPDF(scanResult)} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                      <Download size={14} />PDF Report
                    </button>
                    <button onClick={() => exportCSV(scanResult)} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 text-xs font-bold rounded-xl transition-all">
                      <Database size={14} />CSV
                    </button>
                    <button onClick={() => exportJSON(scanResult)} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 text-xs font-bold rounded-xl transition-all">
                      <HardDrive size={14} />JSON
                    </button>
                  </div>
                </SectionHeader>

                {/* Severity filter */}
                <div className="flex flex-wrap gap-2 items-center mt-4">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mr-2"><Filter size={13} />Filter Severity:</span>
                  {['All', 'Critical', 'High', 'Medium', 'Low', 'Informational'].map(f => (
                    <button key={f} onClick={() => setSeverityFilter(f)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                        severityFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>{f}</button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <div className="p-16 text-center text-slate-500 text-base">
                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                    {severityFilter === 'All' ? 'No security findings detected. Excellent posture!' : `No ${severityFilter} severity findings detected.`}
                  </div>
                ) : filtered.map((f, i) => {
                  const isExpanded = expandedFindings[i];
                  return (
                    <div key={i} className="p-8 hover:bg-slate-50/70 transition-colors space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <SevBadge sev={f.severity} />
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />Verified Finding
                          </span>
                          {f.cvss_score && (
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-800 border border-purple-200">
                              CVSS Score {f.cvss_score}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono font-bold">ID: {f.id || 'RULE-MATCH'}</span>
                      </div>

                      <h3 className="font-heading font-extrabold text-lg md:text-xl text-slate-900">{f.title || f.name || f.header}</h3>
                      
                      {f.description && (
                        <p className="text-base text-slate-700 leading-relaxed font-normal">{f.description}</p>
                      )}

                      {/* Why it matters / Impact */}
                      <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl text-sm text-slate-800 space-y-1">
                        <div className="font-bold text-blue-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                          <Info size={14} className="text-blue-600" /> Why It Matters &amp; Risk Impact
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed">
                          {f.why_it_matters || f.impact || 'Absence of this control increases exposure to client-side attacks, unauthorized data tampering, or eavesdropping.'}
                        </p>
                      </div>

                      {/* Actionable Recommendation */}
                      {f.remediation && (
                        <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-sm text-emerald-900 space-y-1">
                          <div className="font-bold text-emerald-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600" /> Recommended Action / Fix
                          </div>
                          <p className="text-emerald-900 text-sm leading-relaxed font-medium">
                            {f.remediation}
                          </p>
                        </div>
                      )}

                      {/* Expandable Technical Details */}
                      <div>
                        <button onClick={() => toggleFinding(i)}
                          className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors pt-1">
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          {isExpanded ? 'Hide Technical Details' : 'View Technical Evidence & Details'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono space-y-2 shadow-inner">
                            <div className="text-blue-400 font-bold uppercase tracking-wider text-[11px]">Scanner Evidence &amp; Verification Output</div>
                            <div className="break-all whitespace-pre-wrap">{f.evidence || 'No raw evidence payload recorded.'}</div>
                            <div className="text-slate-400 pt-1 border-t border-slate-800 flex flex-wrap gap-4">
                              <span>Detection Method: {f.detection_method || 'HTTP Header Audit'}</span>
                              <span>Confidence: {f.confidence || 'High'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── COLLAPSIBLE TECHNICAL DETAILS ACCORDION ── */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <button onClick={() => setShowTechnical(prev => !prev)}
                className="w-full flex items-center justify-between text-left focus:outline-none">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shrink-0">
                    <Terminal size={20} />
                  </span>
                  <div>
                    <h2 className="font-heading font-bold text-xl text-slate-900">Advanced Technical Details &amp; Raw Scan Data</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Inspect raw HTTP headers, TLS handshake details, DNS records, and detected technologies</p>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  {showTechnical ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {showTechnical && (
                <div className="mt-8 pt-8 border-t border-slate-200 space-y-8 animate-fade-up">
                  {/* Technology Stack */}
                  <div>
                    <h3 className="font-bold text-base text-slate-800 mb-3 flex items-center gap-2">
                      <Cpu size={16} className="text-blue-600" /> Fingerprinted Technology Stack
                    </h3>
                    {technologies.length === 0 ? (
                      <p className="text-sm text-slate-500">No technologies identified.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {technologies.map((t, idx) => (
                          <span key={idx} className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700">
                            {t.name || t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DNS Records */}
                  <div>
                    <h3 className="font-bold text-base text-slate-800 mb-3 flex items-center gap-2">
                      <Globe size={16} className="text-blue-600" /> DNS &amp; Mail Security Records
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="font-bold text-slate-700 mb-1">SPF Record</div>
                        <div className="font-mono text-xs text-slate-600 break-all">{dnsRec.spf || 'Not Configured'}</div>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="font-bold text-slate-700 mb-1">DMARC Record</div>
                        <div className="font-mono text-xs text-slate-600 break-all">{dnsRec.dmarc || 'Not Configured'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Headers */}
                  <div>
                    <h3 className="font-bold text-base text-slate-800 mb-3 flex items-center gap-2">
                      <Server size={16} className="text-blue-600" /> HTTP Security Headers Audit
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                            <th className="text-left p-3 border-b border-slate-200">Header Name</th>
                            <th className="text-left p-3 border-b border-slate-200">Status</th>
                            <th className="text-left p-3 border-b border-slate-200">Severity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs">
                          {headers.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-800">{h.header}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded font-bold ${h.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {h.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{h.severity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── AI Explanations ── */}
            {aiExplanations.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <SectionHeader icon={Sparkles} title="AI Technical Explanations"
                  subtitle="Contextual security explanations generated exclusively from verified scanner findings" />
                <div className="grid md:grid-cols-2 gap-6">
                  {aiExplanations.map((exp, i) => (
                    <div key={i} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-base">
                      <div className="font-heading font-extrabold text-lg text-blue-900">{exp.title}</div>
                      <div><span className="text-slate-500 font-bold">What it means: </span><span className="text-slate-800">{exp.what_it_means}</span></div>
                      <div><span className="text-slate-500 font-bold">Why it matters: </span><span className="text-slate-800">{exp.why_it_matters}</span></div>
                      <div><span className="text-slate-500 font-bold">Remediation: </span><span className="text-emerald-800 font-bold">{exp.verification_steps}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Recent Scans ── */}
        {scanHistory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-200">
              <SectionHeader icon={History} title={`Recent Scans (${scanHistory.length})`}
                subtitle="Your scan history log stored in backend database">
                <button onClick={() => onNavigate('history')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1">
                  View All History <ChevronRight size={16} />
                </button>
              </SectionHeader>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Target Domain', 'Scan Date', 'Score', 'Risk Level', 'Findings', 'Scan Mode', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scanHistory.slice(0, 8).map((s, i) => {
                    const sc = s.score;
                    const riskColor = sc >= 80 ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                      : sc >= 60 ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-red-800 bg-red-50 border-red-200';
                    return (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-5 font-mono text-slate-800 font-bold text-sm truncate max-w-[200px]">{s.target}</td>
                        <td className="px-6 py-5 text-slate-500 text-sm whitespace-nowrap">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-lg font-extrabold font-heading ${sc >= 80 ? 'text-emerald-600' : sc >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{sc}</span>
                          <span className="text-slate-400 text-xs">/100</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${riskColor}`}>
                            {s.risk_level || (sc >= 80 ? 'Low' : sc >= 60 ? 'Medium' : 'High')}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-800 font-bold">{s.findings_count}</td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                            s.scan_mode === 'active' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>{s.scan_mode}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2.5">
                            <button onClick={() => onNavigate('scan')} title="Rescan"
                              className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors">
                              <RefreshCw size={14} />
                            </button>
                            <button title="View Report"
                              className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors">
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white mt-16 py-8">
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 font-medium">
          <span>© 2026 CyberShield AI Security Analyzer · SOC 2 Type II · OWASP Compliant</span>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate('payment')} className="hover:text-blue-600 transition-colors flex items-center gap-1.5 font-bold">
              <Sparkles size={14} />Upgrade Plan
            </button>
            <button onClick={() => onNavigate('landing')} className="hover:text-slate-900 transition-colors">Landing Page</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
