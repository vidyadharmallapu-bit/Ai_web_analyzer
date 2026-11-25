import React, { useState, useEffect } from 'react';
import {
  Shield, Check, Lock, ArrowRight, CheckCircle2, XCircle, Loader2,
  Sparkles, CreditCard, ArrowLeft, AlertTriangle, Star, Users, Zap, X, QrCode, Smartphone
} from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyAmount: 0,
    yearlyAmount: 0,
    monthlyDisplay: '₹0',
    yearlyDisplay: '₹0',
    scanLimit: 5,
    badge: 'Starter',
    color: 'slate',
    features: [
      '5 scans per month',
      'Basic security analysis',
      'SSL validation',
      'HTTP header audit',
      'Community support',
    ],
    missing: ['PDF reports', 'Advanced vulnerabilities', 'AI explanations'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyAmount: 29900,
    yearlyAmount: 287040,
    monthlyDisplay: '₹299',
    yearlyDisplay: '₹2,870',
    scanLimit: 100,
    badge: 'Most Popular',
    color: 'blue',
    highlight: true,
    features: [
      '100 scans per month',
      'Full OWASP Top 10 analysis',
      'PDF, CSV & JSON reports',
      'Advanced vulnerability detection',
      'AI technical explanations',
      'Priority email support',
    ],
    missing: [],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyAmount: 99900,
    yearlyAmount: 959040,
    monthlyDisplay: '₹999',
    yearlyDisplay: '₹9,590',
    scanLimit: 500,
    badge: 'Enterprise',
    color: 'purple',
    features: [
      '500 scans per month',
      'All Pro features',
      'Active port scan probing',
      'Scheduled / automated scans',
      'Team access (up to 10 users)',
      'API access & Webhooks',
      'Dedicated onboarding',
      '24 / 7 priority support',
    ],
    missing: [],
  },
];

const COLOR = {
  slate:  { ring: 'border-slate-200',  btn: 'bg-slate-800 hover:bg-slate-700 text-white', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  blue:   { ring: 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]', btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  purple: { ring: 'border-purple-400 shadow-[0_0_0_3px_rgba(147,51,234,0.10)]', btn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
};

export default function PaymentPage({ user, onBack, onPaymentSuccess }) {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [payStatus, setPayStatus] = useState(null); // 'success' | 'failed' | 'cancelled' | 'pending' | null
  const [activePlan, setActivePlan] = useState(null);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState(user?.name || user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isTestMode, setIsTestMode] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  // Check URL params for ?status=success returned from PhonePe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam === 'success') {
      setPayStatus('success');
    }
  }, []);

  // Detect test mode from backend
  useEffect(() => {
    fetch('http://localhost:8000/')
      .then(r => r.json())
      .then(d => setIsTestMode(d.payment_mode === 'test'))
      .catch(() => {});
  }, []);

  // Polling effect for payment status when pending
  useEffect(() => {
    let interval = null;
    if (payStatus === 'pending' && orderId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/payments/status/${orderId}`);
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            clearInterval(interval);
            setPayStatus('success');
            if (onPaymentSuccess) onPaymentSuccess({ plan: activePlan?.name, status: 'success' });
          } else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(data.status)) {
            clearInterval(interval);
            setPayStatus(data.status.toLowerCase());
          }
        } catch (err) {
          // Ignore network blips during polling
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [payStatus, orderId, activePlan]);

  const handleCheckout = async (plan) => {
    if (!email.trim()) { setError('Please enter your email address before proceeding.'); return; }
    setActivePlan(plan);
    setLoadingPlan(plan.id);
    setLoading(true);
    setError('');

    if (plan.monthlyAmount === 0) {
      setTimeout(() => {
        setLoading(false); setLoadingPlan(null);
        setPayStatus('success');
        if (onPaymentSuccess) onPaymentSuccess({ plan: plan.name, status: 'success' });
      }, 900);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.name,
          billing_period: billing,
          email: email.trim(),
          full_name: fullName.trim() || 'Security User',
        }),
      });
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.detail || 'Failed to create PhonePe payment order');

      setOrderId(orderData.order_id);
      setRedirectUrl(orderData.redirect_url || '');
      setLoading(false);
      setLoadingPlan(null);
      setPayStatus('pending'); // Show QR code and pending payment modal

      // In test mode or sandbox, also verify automatically if needed or let user scan QR code
    } catch (err) {
      setLoading(false); setLoadingPlan(null);
      setError(err.message || 'Payment initiation failed. Please try again.');
    }
  };

  const verifyAndComplete = async () => {
    setLoading(true);
    try {
      const amountVal = (billing === 'yearly' && activePlan?.yearlyAmount > 0 ? activePlan.yearlyAmount : activePlan.monthlyAmount) / 100;
      const verifyRes = await fetch('http://localhost:8000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          payment_id: `pay_phonepe_${Date.now()}`,
          signature: 'phonepe_verified_sig',
          plan: activePlan.name,
          amount: amountVal,
          billing_period: billing,
          email: email.trim(),
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.detail || 'Payment verification failed');

      setLoading(false);
      setPayStatus('success');
      setInvoice(verifyData.invoice_number || null);
      if (onPaymentSuccess) onPaymentSuccess({ plan: activePlan.name, status: 'success', invoice: verifyData.invoice_number });
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── Pending / QR Code Payment Modal ──
  if (payStatus === 'pending') {
    const amountDisplay = billing === 'yearly' && activePlan?.yearlyAmount > 0 ? activePlan.yearlyDisplay : activePlan.monthlyDisplay;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(redirectUrl || 'https://www.phonepe.com')}`;

    return (
      <div className="min-h-screen bg-slate-900/40 backdrop-blur-md font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full flex items-center gap-1.5">
              <Sparkles size={13} />PhonePe Gateway
            </span>
            <button onClick={() => setPayStatus('cancelled')} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <h2 className="font-heading font-extrabold text-2xl text-slate-800 mb-1">Complete Payment</h2>
          <p className="text-slate-500 text-sm mb-6">
            <strong className="text-slate-800">{activePlan?.name} Plan</strong> • <span className="text-blue-600 font-bold">{amountDisplay}</span>
          </p>

          {/* QR Code Container */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 mb-6 inline-block shadow-inner">
            <img src={qrCodeUrl} alt="PhonePe Payment QR Code" className="w-48 h-48 mx-auto rounded-xl object-contain bg-white p-2 border border-slate-200" />
            <p className="text-xs font-bold text-slate-600 mt-3 flex items-center justify-center gap-1.5">
              <QrCode size={14} className="text-blue-600" /> Scan with PhonePe or any UPI app
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="text-xs text-slate-400 font-mono">Order ID: {orderId}</div>
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 py-2.5 rounded-xl border border-blue-100">
              <Loader2 size={16} className="animate-spin" /> Waiting for payment...
            </div>
          </div>

          {redirectUrl && (
            <div className="mb-4">
              <a href={redirectUrl} target="_blank" rel="noopener noreferrer"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mb-2 text-sm shadow-sm">
                <Smartphone size={16} /> Pay via PhonePe App / Web
              </a>
            </div>
          )}

          {/* Test mode instant verify helper */}
          {isTestMode && (
            <button onClick={verifyAndComplete} disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all mb-3 shadow-sm">
              {loading ? 'Verifying...' : '⚡ [Test Mode] Simulate Successful Payment'}
            </button>
          )}

          <button onClick={() => setPayStatus('cancelled')}
            className="w-full py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold rounded-xl text-sm transition-all">
            Cancel Payment
          </button>
        </div>
      </div>
    );
  }

  // ── Success Screen ──
  if (payStatus === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-lg animate-fade-up">
          <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-800 mb-2">Payment Successful!</h2>
          <p className="text-slate-500 text-sm mb-2">
            Your account has been upgraded to{' '}
            <strong className="text-slate-800">{activePlan?.name}</strong>.
          </p>
          {invoice && (
            <p className="text-xs text-slate-400 mb-6">Invoice: <span className="font-mono font-bold text-slate-600">{invoice}</span></p>
          )}
          <button onClick={onBack}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            Go to Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Failed Screen ──
  if (payStatus === 'failed') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-lg animate-fade-up">
          <div className="w-20 h-20 bg-red-50 border-2 border-red-200 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-800 mb-2">Payment Failed</h2>
          <p className="text-slate-500 text-sm mb-6">{error || 'We could not process your payment. Please try again.'}</p>
          <div className="flex gap-3">
            <button onClick={() => setPayStatus(null)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all">
              Try Again
            </button>
            <button onClick={onBack}
              className="flex-1 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold rounded-xl transition-all">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Cancelled Screen ──
  if (payStatus === 'cancelled') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-lg animate-fade-up">
          <div className="w-20 h-20 bg-slate-100 border-2 border-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <X size={40} />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-800 mb-2">Payment Cancelled</h2>
          <p className="text-slate-500 text-sm mb-6">You closed the payment window. No charge was made.</p>
          <div className="flex gap-3">
            <button onClick={() => setPayStatus(null)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all">
              Try Again
            </button>
            <button onClick={onBack}
              className="flex-1 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold rounded-xl transition-all">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Pricing Page ──
  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-heading font-extrabold text-lg text-slate-800">
              AI Security<span className="text-blue-600">Analyzer</span>
            </span>
            {isTestMode && (
              <span className="ml-2 px-2.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                TEST MODE
              </span>
            )}
          </div>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
            <ArrowLeft size={16} />Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14 pb-20">

        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-4">
            <Sparkles size={12} />PhonePe Secure Checkout
          </div>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-800 mb-4 leading-tight">
            Choose Your Security Plan
          </h1>
          <p className="text-slate-500 text-base">
            Instant account upgrade upon verified payment. Powered by PhonePe — scan QR code or pay via UPI, cards, net banking, and wallets.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-semibold ${billing === 'monthly' ? 'text-slate-800' : 'text-slate-400'}`}>Monthly</span>
            <button onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className="w-12 h-6 bg-blue-100 rounded-full p-1 relative transition-colors">
              <div className={`w-4 h-4 bg-blue-600 rounded-full transition-transform duration-300 ${billing === 'yearly' ? 'translate-x-6' : ''}`} />
            </button>
            <span className={`text-sm font-semibold ${billing === 'yearly' ? 'text-slate-800' : 'text-slate-400'}`}>
              Yearly <span className="text-xs text-emerald-600 font-bold">(Save 20%)</span>
            </span>
          </div>
        </div>

        {/* User Info */}
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-5 mb-12 shadow-sm">
          <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
            <CreditCard size={15} className="text-blue-600" />Account Billing Details
          </h3>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-medium mb-3">
              <AlertTriangle size={14} />{error}
            </div>
          )}
          <div className="space-y-3">
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Email Address *"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" required />
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map(plan => {
            const c = COLOR[plan.color];
            const displayPrice = billing === 'yearly' && plan.yearlyAmount > 0 ? plan.yearlyDisplay : plan.monthlyDisplay;
            const period = billing === 'yearly' && plan.yearlyAmount > 0 ? '/year' : '/month';
            const isLoading = loadingPlan === plan.id && loading;

            return (
              <div key={plan.id}
                className={`relative bg-white border-2 rounded-3xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${c.ring}`}>

                {/* Popular badge */}
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-md">
                    ⭐ {plan.badge}
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-extrabold text-xl text-slate-800">{plan.name}</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.badge}`}>{plan.badge}</span>
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold font-heading text-slate-800">{displayPrice}</span>
                    <span className="text-sm text-slate-400">{period}</span>
                  </div>
                  {billing === 'yearly' && plan.yearlyAmount > 0 && (
                    <p className="text-xs text-emerald-600 font-bold mb-5">≈ {plan.monthlyDisplay}/mo billed annually</p>
                  )}

                  <div className="flex items-center gap-2 mb-5 mt-3">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="text-sm font-semibold text-slate-600">{plan.scanLimit} scans / month</span>
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map(feat => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          plan.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          plan.color === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Check size={11} />
                        </div>
                        {feat}
                      </li>
                    ))}
                    {plan.missing.map(feat => (
                      <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-300 line-through">
                        <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                          <X size={11} className="text-slate-300" />
                        </div>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>

                <button onClick={() => handleCheckout(plan)} disabled={loading}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${c.btn}`}>
                  {isLoading ? (
                    <><Loader2 size={16} className="animate-spin" />Processing…</>
                  ) : plan.monthlyAmount === 0 ? (
                    <>Get Started Free <ArrowRight size={16} /></>
                  ) : (
                    <>Upgrade to {plan.name} <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-16 pt-10 border-t border-slate-200 flex flex-wrap justify-center items-center gap-10 text-slate-400 text-xs">
          <div className="flex items-center gap-2"><Lock size={15} className="text-emerald-500" />256-bit SSL Encrypted</div>
          <div className="flex items-center gap-2"><Shield size={15} className="text-blue-500" />PhonePe Gateway Secured</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-blue-400" />Instant Subscription Activation</div>
          <div className="flex items-center gap-2"><Users size={15} className="text-purple-500" />PhonePe UPI · QR · Cards · Net Banking</div>
        </div>

        {/* Test mode notice */}
        {isTestMode && (
          <div className="mt-8 max-w-lg mx-auto flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>PHONEPE TEST MODE ACTIVE — </strong>Displays payment QR code and polls gateway status. Use simulated success for testing.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
