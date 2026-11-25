import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ScanPage from './pages/ScanPage';
import History from './pages/History';
import PaymentPage from './pages/PaymentPage';
import PaymentsHistory from './pages/PaymentsHistory';

const BACKEND_URL = 'http://localhost:8000';

export default function App() {
  const [page, setPage] = useState('landing');
  const [user, setUser] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const navigate = (p) => setPage(p);

  const handleLogin = (userObj) => {
    setUser(userObj);
    navigate('dashboard');
  };

  const handleScanComplete = (result) => {
    setScanResult(result);
    navigate('dashboard');
  };

  const handlePaymentSuccess = ({ plan }) => {
    if (user) setUser(u => ({ ...u, plan }));
    navigate('dashboard');
  };

  // Check for existing session on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser({
            email: data.email,
            name: data.full_name,
            full_name: data.full_name,
            plan: data.plan,
            avatar_url: data.avatar_url,
          });
        }
      } catch {
        // No session or backend error
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cs-bg">
        <div className="flex flex-col items-center gap-4 text-cs-muted">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Restoring session…</span>
        </div>
      </div>
    );
  }

  if (page === 'landing')         return <Landing onGetStarted={() => navigate('login')} onSelectPlan={() => navigate('payment')} />;
  if (page === 'login')           return <Login onLogin={handleLogin} />;
  if (page === 'dashboard')       return <Dashboard user={user} scanResult={scanResult} onNavigate={navigate} />;
  if (page === 'scan')            return <ScanPage onScanComplete={handleScanComplete} onBack={() => navigate('dashboard')} />;
  if (page === 'history')         return <History user={user} onBack={() => navigate('dashboard')} onNavigate={navigate} />;
  if (page === 'payment')         return <PaymentPage user={user} onBack={() => navigate('dashboard')} onPaymentSuccess={handlePaymentSuccess} />;
  if (page === 'payments-history') return <PaymentsHistory user={user} onBack={() => navigate('dashboard')} onNavigate={navigate} />;

  return <Landing onGetStarted={() => navigate('login')} onSelectPlan={() => navigate('payment')} />;
}