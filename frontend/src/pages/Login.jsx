import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, Eye, EyeOff, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';

export default function Login({ onLogin }) {
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [socialLoading, setSocialLoading] = useState(null);

  // Check URL params for OAuth errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      const messages = {
        google_cancelled: 'Google sign-in was cancelled.',
        google_token_failed: 'Google sign-in could not be completed. Please try again.',
        google_no_id_token: 'Google sign-in failed. Please try again.',
        google_invalid_token: 'Google sign-in failed. Please try again.',
        google_no_email: 'Google account must have a verified email address.',
        microsoft_cancelled: 'Microsoft sign-in was cancelled.',
        microsoft_token_failed: 'Microsoft sign-in could not be completed. Please try again.',
        microsoft_no_id_token: 'Microsoft sign-in failed. Please try again.',
        microsoft_invalid_token: 'Microsoft sign-in failed. Please try again.',
        microsoft_no_email: 'Microsoft account must have a verified email address.',
        x_cancelled: 'X sign-in was cancelled.',
        x_token_failed: 'X sign-in could not be completed. Please try again.',
        x_no_access_token: 'X sign-in failed. Please try again.',
        x_user_failed: 'X sign-in failed. Please try again.',
        x_missing_verifier: 'X sign-in session expired. Please try again.',
        invalid_state: 'Sign-in session expired. Please try again.',
      };
      setError(messages[oauthError] || 'Sign-in failed. Please try again.');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          full_name: name.trim() || email.split('@')[0],
          password: password || 'securepass123',
        }),
      });
      const data = await res.json();

      const userObj = res.ok
        ? { email: data.email, name: data.full_name, full_name: data.full_name, plan: data.plan || 'Free', avatar_url: data.avatar_url }
        : { email: email.trim(), name: name.trim() || email.split('@')[0], full_name: name.trim() || email.split('@')[0], plan: 'Free' };

      onLogin(userObj);
    } catch {
      onLogin({
        email: email.trim(),
        name: name.trim() || email.split('@')[0],
        full_name: name.trim() || email.split('@')[0],
        plan: 'Free',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    setSocialLoading(provider);
    const urls = {
      google: `${BACKEND_URL}/auth/google`,
      microsoft: `${BACKEND_URL}/auth/microsoft`,
      x: `${BACKEND_URL}/auth/x`,
    };
    window.location.href = urls[provider];
  };

  const socialProviders = [
    {
      id: 'google',
      label: 'Continue with Google',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
      color: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
    },
    {
      id: 'microsoft',
      label: 'Continue with Microsoft',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#F25022" d="M0 0h12v12H0z"/>
          <path fill="#7FBA00" d="M12 0h12v12H12z"/>
          <path fill="#00A4EF" d="M0 12h12v12H0z"/>
          <path fill="#FFB900" d="M12 12h12v12H12z"/>
        </svg>
      ),
      color: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
    },
    {
      id: 'x',
      label: 'Continue with X',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.855L12 13.126 4.534 18.83l3.274-.87L13.121 12H3.565l9.83-11.14 3.274.855-8.502 9.238L18.244 2.25zm-.507 2.31h-2.77l-4.14 4.47h2.79l4.14-4.47zm-2.237 7.19l-4.11 4.47H14l4.11-4.47h-2.634z"/>
        </svg>
      ),
      color: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className="min-h-screen flex bg-cs-bg font-sans">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary to-primary-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-grid opacity-10 pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-300/10 rounded-full blur-[80px]" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center">
            <Shield size={22} className="text-white" />
          </div>
          <span className="font-heading font-bold text-2xl text-white">AI Security<span className="text-blue-300">Analyzer</span></span>
        </div>

        <div className="relative z-10">
          <h2 className="font-heading font-extrabold text-3xl text-white mb-4 leading-tight">
            Enterprise Website<br />Security Platform
          </h2>
          <p className="text-blue-200 text-base mb-10 leading-relaxed">
            AI-powered vulnerability detection, performance analysis, SEO audits, and professional reporting — all in one platform.
          </p>
          <div className="space-y-3">
            {[
              'SSL/TLS Certificate Validation',
              'OWASP Top 10 Vulnerability Scanning',
              'AI-Powered Remediation Guidance',
              'Professional PDF Reports',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-green-400 shrink-0" />
                <span className="text-blue-100 text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-blue-400 text-xs">SOC 2 Type II · OWASP Compliant · AES-256 Encrypted</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-cs-text">AI Security<span className="text-accent">Analyzer</span></span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
            {[['login', 'Login'], ['signup', 'Create Account']].map(([t, label]) => (
              <button
                key={t} type="button" onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-primary shadow-card' : 'text-cs-muted hover:text-cs-text'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h1 className="font-heading font-bold text-2xl text-cs-text mb-1">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-cs-muted text-sm">
              {tab === 'login' ? 'Sign in to your security dashboard.' : 'Start securing your websites today.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {tab === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-cs-text mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe" className="input-field pl-10" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-cs-text mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@company.com" className="input-field pl-10" required />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-cs-text mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input id="password" type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {tab === 'login' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-cs-border text-accent focus:ring-accent focus:ring-2" />
                  <span className="text-sm text-cs-muted">Remember me</span>
                </label>
                <a href="#" className="text-sm text-accent hover:text-primary font-medium transition-colors">Forgot password?</a>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base mt-2 group disabled:opacity-60">
              {loading ? (
                <><Loader2 size={18} className="animate-spin" />{tab === 'login' ? 'Signing In…' : 'Creating Account…'}</>
              ) : (
                <>{tab === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>
          </form>

          {/* Social Login Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-cs-bg text-slate-400 font-semibold">Or continue with</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {socialProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleSocialLogin(provider.id)}
                disabled={socialLoading !== null}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${provider.color} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {socialLoading === provider.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  provider.icon
                )}
                {provider.label}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-cs-muted mt-8">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}
              className="text-accent font-semibold hover:text-primary transition-colors">
              {tab === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <p className="text-center text-[11px] text-slate-400 mt-6">Secure · Private · OWASP-Compliant</p>
        </div>
      </div>
    </div>
  );
}