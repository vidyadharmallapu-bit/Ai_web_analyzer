import React, { useEffect, useRef, useState } from 'react';
import {
  Shield, Lock, Globe, Search, Gauge, Activity, FileText, BarChart,
  AlertTriangle, CheckCircle, Server, Bug, Bot, Sparkles,
  ChevronDown, Menu, X, ArrowRight, Zap, Eye, Star,
  ExternalLink, Check, HelpCircle
} from 'lucide-react';

/* ─────────────────────────────────────────
   Reusable sub-components
───────────────────────────────────────── */

function NavBar({ onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const links = ['Home', 'Features', 'Scanner', 'Dashboard', 'Reports', 'Documentation', 'Contact'];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-[0_10px_40px_-24px_rgba(15,45,82,0.35)] border-b border-slate-200/80'
          : 'bg-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-[72px]">
        {/* Logo */}
        <a href="#home" className="flex items-center gap-2.5 group" aria-label="CyberShield Home">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
            <Shield size={20} className="text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-slate-900 tracking-tight">
            Cyber<span className="text-accent">Shield</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} className="nav-link">{l}</a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={onGetStarted} className="btn-secondary py-2 px-5 text-sm">
            Login
          </button>
          <button onClick={onGetStarted} className="btn-primary py-2 px-5 text-sm">
            Start Scan <ArrowRight size={15} />
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/98 backdrop-blur-xl border-t border-cs-border">
          <nav className="container py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="px-4 py-3 rounded-lg text-sm font-medium text-cs-text hover:bg-slate-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l}
              </a>
            ))}
            <div className="flex gap-3 mt-3 pt-3 border-t border-cs-border">
              <button onClick={onGetStarted} className="flex-1 btn-secondary py-3 text-sm">Login</button>
              <button onClick={onGetStarted} className="flex-1 btn-primary py-3 text-sm">Start Scan</button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function CountUp({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          setCount(Math.round(progress * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────
   Hero Section
───────────────────────────────────────── */
function HeroSection({ onGetStarted }) {
  const metrics = [
    { label: 'Performance', value: 96, color: '#3B82F6' },
    { label: 'SEO', value: 94, color: '#8B5CF6' },
    { label: 'Security', value: 99, color: '#22C55E' },
    { label: 'Accessibility', value: 95, color: '#F59E0B' },
  ];

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-primary via-primary-800 to-slate-900 pt-16">
      {/* Background grid */}
      <div className="absolute inset-0 bg-hero-grid opacity-20" />
      {/* Glows */}
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-300/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="container relative z-10 py-20 lg:py-32 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

        {/* Left */}
        <div className="animate-fade-up">
          <div className="badge-primary mb-6 w-fit">
            <Sparkles size={13} /> AI-Powered Security Platform
          </div>

          <h1 className="text-4xl sm:text-5xl xl:text-[3.6rem] font-heading font-extrabold text-white leading-[1.12] mb-6">
            AI-Powered Website<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
              Security Analyzer
            </span>
          </h1>

          <p className="text-blue-100 text-lg leading-relaxed mb-9 max-w-xl">
            Analyze any website in seconds with advanced AI-driven vulnerability detection, security assessment, SEO analysis, performance testing, SSL validation, accessibility audits, and intelligent reporting.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <button onClick={onGetStarted} className="btn-primary-lg group bg-white !text-primary hover:!bg-blue-50 !shadow-none">
              Start Free Scan <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button className="btn-secondary-lg !bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
              <Eye size={18} /> View Live Demo
            </button>
          </div>

          <div className="flex flex-wrap gap-5">
            {['AI Powered', 'Real-Time Analysis', 'Security Focused', 'Lightning Fast', 'Professional Reports'].map((t) => (
              <span key={t} className="check-pill text-blue-100">
                <CheckCircle size={16} className="text-green-400 shrink-0" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right — floating dashboard */}
        <div className="relative h-[480px] lg:h-[520px] hidden sm:block animate-fade-up delay-200">
          {/* Main card */}
          <div className="glass-card absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 p-6 z-20 bg-white/90 backdrop-blur-2xl border border-white/60">
            <div className="flex items-center justify-between mb-5">
              <span className="font-heading font-semibold text-slate-800 text-sm">Website Health</span>
              <span className="badge-success text-xs">98%</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((m) => (
                <div key={m.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-xs text-cs-muted mb-1">{m.label}</div>
                  <div className="text-xl font-bold font-heading" style={{ color: m.color }}>{m.value}</div>
                  <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-xs text-cs-muted">SSL Status</span>
              <span className="badge-success text-xs"><Lock size={11} /> Valid</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-cs-muted">Risk Level</span>
              <span className="badge-success text-xs">Low</span>
            </div>
          </div>

          {/* Floating top-left */}
          <div className="glass-card absolute top-4 left-0 p-4 w-44 z-30 animate-float bg-white/90 backdrop-blur-2xl border border-white/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield size={13} className="text-green-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Secure</span>
            </div>
            <div className="text-2xl font-bold font-heading text-slate-800">99</div>
            <div className="text-xs text-cs-muted">Security Score</div>
          </div>

          {/* Floating bottom-right */}
          <div className="glass-card absolute bottom-12 right-0 p-4 w-48 z-30 animate-float-slow bg-white/90 backdrop-blur-2xl border border-white/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap size={13} className="text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Performance</span>
            </div>
            <div className="text-2xl font-bold font-heading text-slate-800">96<span className="text-sm text-cs-muted">/100</span></div>
            <div className="h-1.5 mt-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '96%' }} />
            </div>
          </div>

          {/* Floating top-right */}
          <div className="glass-card absolute top-8 right-4 p-3 z-30 w-36 animate-float delay-300 bg-white/90 backdrop-blur-2xl border border-white/60">
            <div className="flex items-center gap-1.5">
              <Activity size={13} className="text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600">All Systems</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">No threats detected</div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-16 md:h-20 fill-cs-bg">
          <path d="M0,80L1440,0L1440,80L0,80Z" />
        </svg>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Trusted By
───────────────────────────────────────── */
function TrustedBy() {
  const brands = ['Google', 'Microsoft', 'GitHub', 'Cloudflare', 'AWS', 'Cisco', 'Docker', 'DigitalOcean'];
  return (
    <section className="section-sm bg-cs-bg border-y border-cs-border">
      <div className="container text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cs-muted mb-10">
          Trusted by Developers &amp; Security Professionals worldwide
        </p>
        <div className="flex flex-wrap justify-center gap-8 md:gap-14">
          {brands.map((b) => (
            <span key={b} className="text-lg md:text-xl font-bold font-heading text-slate-400 grayscale opacity-60 hover:opacity-90 hover:text-slate-600 transition-all cursor-default">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Features
───────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    { icon: Bot, title: 'AI Vulnerability Detection', desc: 'Machine-learning models trained on millions of CVEs detect zero-days and emerging threats before attackers can exploit them.', color: 'from-violet-500 to-purple-600' },
    { icon: Gauge, title: 'Performance Analysis', desc: 'Deep-dive metrics on Core Web Vitals, TTFB, LCP, FID and CLS help you optimise user experience and search ranking.', color: 'from-blue-500 to-cyan-500' },
    { icon: Search, title: 'SEO Audit', desc: 'Comprehensive technical SEO analysis — meta tags, structured data, canonical URLs, indexability — for maximum visibility.', color: 'from-indigo-500 to-blue-500' },
    { icon: Lock, title: 'SSL Certificate Validation', desc: 'Continuous monitoring of certificate chains, cipher suites, TLS versions, expiry dates and HSTS configuration.', color: 'from-emerald-500 to-green-600' },
    { icon: CheckCircle, title: 'Accessibility Checker', desc: 'Validate against WCAG 2.1 AA/AAA guidelines — contrast ratios, ARIA labels, keyboard navigation and screen-reader support.', color: 'from-amber-500 to-orange-500' },
    { icon: FileText, title: 'Professional PDF Reports', desc: 'One-click executive-grade reports with risk scores, remediation roadmaps, and JSON/CSV exports for your audit trail.', color: 'from-rose-500 to-pink-600' },
  ];

  return (
    <section id="features" className="section bg-white">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="badge-primary mb-4 w-fit mx-auto"><Sparkles size={13} /> Features</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Enterprise-Grade Security <span className="text-gradient">In One Platform</span>
          </h2>
          <p className="text-cs-muted text-lg">Everything you need to ensure your web applications are secure, performant, and fully compliant.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, color }, i) => (
            <div
              key={i}
              className="premium-card p-6 group cursor-default hover-lift"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-card group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={22} className="text-white" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-cs-text mb-2">{title}</h3>
              <p className="text-cs-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Stats
───────────────────────────────────────── */
function StatsSection() {
  const stats = [
    { value: 10000, suffix: '+', label: 'Websites Scanned' },
    { value: 99, suffix: '.9%', label: 'Detection Accuracy' },
    { value: 30, suffix: 's', label: 'Avg Scan Time' },
    { value: 500, suffix: '+', label: 'OWASP Checks' },
  ];

  return (
    <section className="section-sm bg-primary">
      <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-4xl font-heading font-extrabold text-white mb-1">
              <CountUp end={s.value} suffix={s.suffix} />
            </div>
            <div className="text-blue-200 text-sm font-medium">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Scanner Section (preview — links to real scan)
───────────────────────────────────────── */
function ScannerSection({ onGetStarted }) {
  const steps = [
    'Checking DNS Records',
    'Analyzing SSL Certificate',
    'Scanning HTTP Headers',
    'Testing Performance',
    'Checking SEO Metrics',
    'Running AI Analysis',
    'Checking Vulnerabilities',
    'Generating Professional Report',
  ];

  return (
    <section id="scanner" className="section bg-gradient-to-br from-slate-900 to-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="container relative z-10 max-w-3xl mx-auto text-center">
        <div className="badge mb-6 bg-blue-900/60 text-blue-300 border-blue-700 w-fit mx-auto"><Shield size={13} /> Live Scanner</div>
        <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
          Scan Any Website <span className="text-blue-300">Instantly</span>
        </h2>
        <p className="text-blue-200 text-lg mb-10">Enter any URL below and our AI engine will deliver a complete security intelligence report.</p>

        {/* Input bar */}
        <div className="flex flex-col sm:flex-row gap-3 p-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl mb-12 shadow-card-lg">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
            <input
              readOnly
              onClick={onGetStarted}
              placeholder="https://example.com"
              className="w-full pl-11 pr-4 py-4 bg-transparent border-none text-white placeholder:text-blue-300 focus:outline-none text-base cursor-pointer"
            />
          </div>
          <button onClick={onGetStarted} className="btn-accent px-8 py-4 rounded-xl font-bold">
            Analyze Now <ArrowRight size={18} />
          </button>
        </div>

        {/* Steps preview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-blue-400 text-[10px] font-bold">{i + 1}</span>
              </div>
              <span className="text-blue-200 text-xs font-medium">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Dashboard Preview
───────────────────────────────────────── */
function DashboardPreview({ onGetStarted }) {
  const scores = [
    { label: 'Performance', value: 96, color: '#3B82F6' },
    { label: 'SEO', value: 91, color: '#8B5CF6' },
    { label: 'Security', value: 99, color: '#22C55E' },
    { label: 'Accessibility', value: 88, color: '#F59E0B' },
    { label: 'Best Practices', value: 94, color: '#06B6D4' },
  ];

  return (
    <section id="dashboard" className="section bg-cs-bg">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="badge-primary mb-4 w-fit mx-auto"><BarChart size={13} /> Analytics</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Powerful <span className="text-gradient">Analytics Dashboard</span>
          </h2>
          <p className="text-cs-muted text-lg">Your complete security posture at a glance — scores, trends, and actionable insights.</p>
        </div>

        <div className="card-md rounded-3xl overflow-hidden shadow-card-lg border border-slate-200">
          {/* Mock browser chrome */}
          <div className="bg-slate-100 px-4 py-3 flex items-center gap-3 border-b border-slate-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded-md px-3 py-1.5 text-xs text-slate-400 border border-slate-200">cybershield.ai/dashboard</div>
          </div>

          {/* Dashboard body */}
          <div className="bg-slate-50 p-6 md:p-8 grid md:grid-cols-3 gap-5">
            {/* Scores */}
            <div className="md:col-span-2 grid sm:grid-cols-3 gap-4">
              {scores.map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card">
                  <div className="text-xs text-cs-muted mb-2 font-medium">{s.label}</div>
                  <div className="relative w-20 h-20 mx-auto mb-2">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                      <circle
                        cx="40" cy="40" r="32" fill="none" strokeWidth="8"
                        stroke={s.color} strokeLinecap="round"
                        strokeDasharray={`${(s.value / 100) * 201.1} 201.1`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-bold font-heading text-lg" style={{ color: s.color }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary sidebar */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card">
                <div className="text-xs font-semibold text-cs-muted mb-3">Quick Stats</div>
                {[
                  { l: 'Response Time', v: '142ms', ok: true },
                  { l: 'SSL Status', v: 'Valid', ok: true },
                  { l: 'Risk Level', v: 'Low', ok: true },
                  { l: 'Vulnerabilities', v: '3 Minor', ok: false },
                ].map((row) => (
                  <div key={row.l} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-none">
                    <span className="text-xs text-cs-muted">{row.l}</span>
                    <span className={`text-xs font-semibold ${row.ok ? 'text-green-600' : 'text-amber-600'}`}>{row.v}</span>
                  </div>
                ))}
              </div>
              <button onClick={onGetStarted} className="btn-primary w-full py-3">
                Run Full Scan <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Why Choose Us
───────────────────────────────────────── */
function WhyUs() {
  const items = [
    { icon: Bot, title: 'AI Powered', desc: 'Deep-learning models provide industry-leading accuracy and zero false positives.', color: 'text-violet-600 bg-violet-50 border-violet-100' },
    { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 Type II compliant infrastructure. Your data never leaves our secure environment.', color: 'text-blue-600 bg-blue-50 border-blue-100' },
    { icon: Zap, title: 'Lightning Fast', desc: 'Full security intelligence report delivered in under 30 seconds on average.', color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { icon: FileText, title: 'Detailed Reports', desc: 'Executive-ready PDF reports with developer-friendly remediation code snippets.', color: 'text-green-600 bg-green-50 border-green-100' },
  ];

  return (
    <section className="section bg-white">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="badge-primary mb-4 w-fit mx-auto"><Star size={13} /> Why CyberShield</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Built for <span className="text-gradient">Modern Security Teams</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map(({ icon: Icon, title, desc, color }, i) => (
            <div key={i} className="card-hover p-6 text-center group">
              <div className={`w-14 h-14 rounded-2xl ${color} border flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform`}>
                <Icon size={26} />
              </div>
              <h3 className="font-heading font-semibold text-lg text-cs-text mb-2">{title}</h3>
              <p className="text-cs-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Testimonials
───────────────────────────────────────── */
function Testimonials() {
  const items = [
    { name: 'Sarah Jenkins', role: 'CISO, TechFlow Inc.', quote: 'CyberShield replaced three separate tools. The AI recommendations are incredibly precise and developer-friendly. Our team loves it.', initials: 'SJ', bg: 'from-violet-500 to-purple-600' },
    { name: 'David Chen', role: 'Lead Engineer, DevStack', quote: 'The PDF reports make communicating security needs to stakeholders effortless. The UI is genuinely the best in the industry.', initials: 'DC', bg: 'from-blue-500 to-cyan-500' },
    { name: 'Emily Rodriguez', role: 'DevSecOps, Nexus Labs', quote: 'Zero false positives, lightning-fast scans. We integrated it into our CI/CD pipeline in under an hour. Absolute must-have.', initials: 'ER', bg: 'from-rose-500 to-pink-500' },
  ];

  return (
    <section className="section bg-cs-bg">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="badge-primary mb-4 w-fit mx-auto"><Star size={13} /> Testimonials</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Loved by <span className="text-gradient">Security Teams</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div key={i} className="card-hover p-7">
              <div className="flex text-amber-400 mb-4 gap-0.5">
                {[1,2,3,4,5].map((s) => <Star key={s} size={15} fill="currentColor" />)}
              </div>
              <p className="text-cs-text text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.bg} flex items-center justify-center text-white text-sm font-bold font-heading shrink-0`}>
                  {t.initials}
                </div>
                <div>
                  <div className="font-semibold text-sm text-cs-text">{t.name}</div>
                  <div className="text-xs text-cs-muted">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pricing
───────────────────────────────────────── */
function CheckoutModal({ plan, onClose }) {
  const [selectedMethod, setSelectedMethod] = useState('PhonePe');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const methods = ['PhonePe', 'Netbanking', 'UPI', 'Debit/Credit Card'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:8000/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan?.name || 'Unknown',
          price: plan?.price || '$0',
          period: plan?.period || '/trial',
          payment_method: selectedMethod,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Checkout request failed.');

      setSubmitted(true);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to submit checkout request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(15,45,82,0.45)]">
        <div className="bg-primary px-6 py-5 text-white flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-blue-200">Secure Checkout</div>
            <div className="font-heading text-xl font-bold">{plan?.name || 'Plan'} Checkout</div>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid md:grid-cols-[1.1fr,0.9fr]">
          <div className="p-6 border-b md:border-b-0 md:border-r border-slate-200">
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 mb-5">
              <div className="text-xs text-cs-muted mb-1">Selected Plan</div>
              <div className="text-lg font-heading font-bold text-cs-text">{plan?.name}</div>
              <div className="text-sm text-cs-muted">{plan?.price}{plan?.period}</div>
            </div>

            <div className="text-sm font-semibold text-cs-text mb-3">Choose payment method</div>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((method) => (
                <button
                  key={method}
                  onClick={() => setSelectedMethod(method)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    selectedMethod === method
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-cs-text border-slate-200 hover:border-primary'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <input
                className="input-field w-full"
                placeholder="Full name"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                required
              />
              <input
                className="input-field w-full"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
              <input
                className="input-field w-full"
                type="tel"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />
              {error && <div className="text-xs text-red-600 font-semibold">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm disabled:opacity-60">
                {loading ? 'Submitting...' : 'Proceed to Secure Checkout'}
              </button>
            </form>
          </div>

          <div className="p-6 bg-slate-50">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cs-muted mb-3">Checkout summary</div>
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-cs-muted">Plan</span>
                <span className="font-semibold text-cs-text">{plan?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cs-muted">Billing</span>
                <span className="font-semibold text-cs-text">{plan?.price}{plan?.period}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cs-muted">Method</span>
                <span className="font-semibold text-cs-text">{selectedMethod}</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="text-xs text-cs-muted">Status</div>
                <div className="text-sm font-semibold text-success mt-1">
                  {submitted ? 'Checkout request submitted successfully to the backend order endpoint.' : 'Awaiting secure payment confirmation.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pricing({ onGetStarted, onSelectPlan }) {
  const plans = [
    {
      name: 'Free', price: '₹0', period: '/mo',
      features: ['5 scans per month', 'Basic security checks', 'SSL validation', 'HTTP header audit', 'Community support'],
      cta: 'Start Free', highlight: false,
    },
    {
      name: 'Pro', price: '₹299', period: '/mo',
      features: ['100 scans per month', 'Full OWASP Top 10 analysis', 'PDF, CSV & JSON reports', 'Advanced vulnerability detection', 'AI technical explanations', 'Priority email support'],
      cta: 'Choose Pro', highlight: true,
    },
    {
      name: 'Business', price: '₹999', period: '/mo',
      features: ['500 scans per month', 'All Pro features', 'Active port scan probing', 'Scheduled / automated scans', 'Team access (up to 10 users)', 'API access & Webhooks', 'Dedicated onboarding', '24 / 7 priority support'],
      cta: 'Choose Business', highlight: false,
    },
  ];

  return (
    <section id="pricing" className="section bg-white">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="badge-primary mb-4 w-fit mx-auto"><Sparkles size={13} /> Pricing</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Simple, <span className="text-gradient">Transparent Pricing</span>
          </h2>
          <p className="text-cs-muted text-lg">No hidden fees. Cancel any time.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-center">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                p.highlight
                  ? 'bg-primary text-white shadow-[0_20px_60px_-10px_rgba(15,45,82,0.35)] scale-105 border border-primary-700'
                  : 'card-hover'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 badge bg-accent text-white border-none px-5 py-1.5 text-xs font-bold shadow-glow-sm">
                  MOST POPULAR
                </div>
              )}
              <div className={`text-sm font-semibold mb-2 ${p.highlight ? 'text-blue-300' : 'text-cs-muted'}`}>{p.name}</div>
              <div className="flex items-end gap-1 mb-6">
                <span className={`text-4xl font-heading font-extrabold ${p.highlight ? 'text-white' : 'text-cs-text'}`}>{p.price}</span>
                <span className={`text-sm mb-1 ${p.highlight ? 'text-blue-200' : 'text-cs-muted'}`}>{p.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check size={16} className={p.highlight ? 'text-blue-300' : 'text-accent'} />
                    <span className={p.highlight ? 'text-blue-100' : 'text-cs-text'}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onSelectPlan(p)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  p.highlight
                    ? 'bg-white text-primary hover:bg-blue-50'
                    : 'btn-primary'
                }`}
              >
                {p.cta}
              </button>
              <div className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${p.highlight ? 'text-blue-200' : 'text-cs-muted'}`}>
                Accepted Payments
              </div>
              <div className={`mt-2 flex flex-wrap gap-2 text-xs ${p.highlight ? 'text-blue-100' : 'text-cs-text'}`}>
                <span className="badge">PhonePe</span>
                <span className="badge">UPI</span>
                <span className="badge">Netbanking</span>
                <span className="badge">Cards</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   FAQ
───────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState(null);
  const items = [
    { q: 'How accurate is the AI vulnerability detection?', a: 'Our AI models achieve 99.9% detection accuracy, trained on millions of CVEs and updated continuously to catch emerging threats with zero false positives.' },
    { q: 'Does scanning affect my website\'s performance?', a: 'No. Our passive scanning technology mirrors real-user traffic patterns. We never perform disruptive or destructive tests without explicit written authorization.' },
    { q: 'Can I schedule automated scans?', a: 'Yes. Professional and Enterprise plans include daily, weekly, or custom scan schedules with real-time Slack, email, or webhook alerts for critical findings.' },
    { q: 'Do you provide remediation guidance?', a: 'Every finding includes developer-friendly remediation steps, configuration snippets, and links to relevant security documentation so your team can fix issues immediately.' },
    { q: 'Is my data secure?', a: 'Absolutely. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are SOC 2 Type II certified and never share data with third parties.' },
  ];

  return (
    <section className="section bg-cs-bg">
      <div className="container max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="badge-primary mb-4 w-fit mx-auto"><HelpCircle size={13} /> FAQ</div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-cs-text mb-4">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="card rounded-2xl overflow-hidden">
              <button
                className="w-full flex justify-between items-center p-5 text-left group"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-semibold text-sm text-cs-text group-hover:text-primary transition-colors">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-cs-muted shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180 text-primary' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-cs-muted leading-relaxed border-t border-cs-border pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   CTA
───────────────────────────────────────── */
function CTASection({ onGetStarted }) {
  return (
    <section className="section bg-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/20 rounded-full blur-[100px]" />
      <div className="container relative z-10 text-center max-w-3xl mx-auto">
        <div className="badge mb-6 bg-blue-900/60 text-blue-300 border-blue-700 w-fit mx-auto"><Shield size={13} /> Start Protecting Today</div>
        <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-white mb-6 leading-tight">
          Protect Your Website<br /> Before Attackers Find the Weaknesses
        </h2>
        <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">
          Run your first AI-powered website security analysis today — it's free and takes under 30 seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onGetStarted} className="btn-primary-lg bg-white !text-primary hover:!bg-blue-50 !shadow-none">
            Analyze Website <ArrowRight size={18} />
          </button>
          <button className="btn-secondary-lg !bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
            View Documentation
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Footer
───────────────────────────────────────── */
function Footer() {
  const col = (title, links) => ({ title, links });
  const cols = [
    col('Product', ['Features', 'Pricing', 'API', 'Changelog', 'Status']),
    col('Resources', ['Documentation', 'Blog', 'Guides', 'Webinars']),
    col('Support', ['Help Center', 'Community', 'Contact Us']),
    col('Legal', ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security']),
  ];

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-12 border-b border-slate-800">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-white">Cyber<span className="text-accent">Shield</span></span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 max-w-xs mb-6">
              Enterprise-grade AI-powered website security analysis. Trusted by thousands of developers and security teams worldwide.
            </p>
            <div className="flex gap-3">
              {[Globe, ExternalLink, Search, Shield].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 bg-slate-800 hover:bg-accent rounded-lg flex items-center justify-center transition-colors">
                  <Icon size={17} className="text-slate-400 hover:text-white" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-white text-sm font-semibold mb-4">{c.title}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}><a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 gap-4">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} CyberShield AI. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-400 transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   Landing (page assembler)
───────────────────────────────────────── */
export default function Landing({ onGetStarted }) {
  const [selectedPlan, setSelectedPlan] = useState(null);

  return (
    <div className="min-h-screen font-sans">
      <NavBar onGetStarted={onGetStarted} />
      <HeroSection onGetStarted={onGetStarted} />
      <TrustedBy />
      <FeaturesSection />
      <StatsSection />
      <ScannerSection onGetStarted={onGetStarted} />
      <DashboardPreview onGetStarted={onGetStarted} />
      <WhyUs />
      <Testimonials />
      <Pricing onGetStarted={onGetStarted} onSelectPlan={setSelectedPlan} />
      <FAQ />
      <CTASection onGetStarted={onGetStarted} />
      <Footer />
      {selectedPlan && <CheckoutModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
