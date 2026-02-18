import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import Landing from './pages/Landing';
import { API_BASE } from './lib/net';

function parseRoute(pathname, search) {
  const rawPath = String(pathname || '').replace(/\/+$/g, '');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const qs = new URLSearchParams(String(search || ''));
  const qUser = qs.get('u') || qs.get('user') || '';
  if (qUser && String(qUser).trim()) {
    return { kind: 'autologin', username: String(qUser) };
  }

  const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
  if (!parts.length) return { kind: 'landing' };

  const first = String(parts[0] || '').toLowerCase();
  if (first === 'login') return { kind: 'login' };

  // If the URL uses a prefix but doesn't include a username, show a caution state.
  if ((first === 'u' || first === 'chat' || first === 'admin') && !parts[1]) {
    return { kind: 'autologin', username: '' };
  }

  // Supported URL forms:
  // - /<username>
  // - /u/<username>
  // - /chat/<username>
  // - /admin/<username>
  if (first === 'u' && parts[1]) return { kind: 'autologin', username: parts[1] };
  if ((first === 'chat' || first === 'admin') && parts[1]) {
    return { kind: 'autologin', username: parts[1] };
  }
  return { kind: 'autologin', username: parts[0] };
}

function normalizeUsername(raw) {
  let u = String(raw || '');
  try {
    u = decodeURIComponent(u);
  } catch {
    // ignore
  }
  u = u.trim();
  if (u.startsWith('@')) u = u.slice(1).trim();
  // Never allow path separators.
  if (u.includes('/') || u.includes('\\')) return '';
  if (u.length > 64) u = u.slice(0, 64);
  return u;
}

function navigate(to) {
  try {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    window.location.assign(to);
  }
}

function Router() {
  const { token, user, login, caution, clearCaution } = useAuth();
  const [locKey, setLocKey] = useState(() => `${window.location.pathname}${window.location.search}`);
  const [autoState, setAutoState] = useState({ status: 'idle', error: null, username: '' });

  const closeCaution = () => {
    // Close caution like a modal: return to landing background.
    clearCaution?.();
    navigate('/');
  };

  useEffect(() => {
    const onPop = () => setLocKey(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const route = useMemo(() => {
    return parseRoute(window.location.pathname, window.location.search);
  }, [locKey]);

  useEffect(() => {
    if (token) return;
    if (caution) return;
    if (route.kind !== 'autologin') {
      setAutoState((s) => (s.status === 'idle' ? s : { status: 'idle', error: null, username: '' }));
      return;
    }

    const username = normalizeUsername(route.username);
    if (!username) {
      setAutoState({ status: 'error', error: 'Missing username in URL.', username: '' });
      return;
    }

    let cancelled = false;
    (async () => {
      setAutoState({ status: 'loading', error: null, username });
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const rawMsg = String(data.error || data.message || '').trim();
          const msg = (() => {
            if (res.status === 400) return 'Missing username in URL.';
            if (res.status === 409) return 'This account is already logged in (active session).';
            if (res.status === 401) {
              if (rawMsg.toLowerCase().includes('disabled')) return 'Account disabled. Contact the admin.';
              return 'Username not allowed. Ask the admin to add/enable your account.';
            }
            if (res.status === 403) return 'Account disabled. Contact the admin.';
            return rawMsg || `Login failed (HTTP ${res.status}).`;
          })();
          if (!cancelled) setAutoState({ status: 'error', error: msg, username });
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!data.token) {
          if (!cancelled) setAutoState({ status: 'error', error: 'Login failed: no token received.', username });
          return;
        }

        if (cancelled) return;
        setAutoState({ status: 'done', error: null, username });
        login(data.token);
      } catch {
        if (!cancelled) setAutoState({ status: 'error', error: 'Server error while logging in.', username });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, route, login, caution]);

  if (token && user?.role === 'admin') return <AdminDashboard />;
  if (token) return <ChatPage />;

  // Global caution (forced logout, server restart, disabled/deleted)
  if (caution) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #cfe8ff 0%, #eaf5ff 55%, #ffffff 100%)',
          color: '#0f172a',
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <style>{`
          @keyframes cautionIn {
            from { opacity: 0; transform: translateY(10px) scale(0.99); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div
          onClick={closeCaution}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
          }}
        />

        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            zIndex: 60,
            width: 560,
            maxWidth: '92vw',
            borderRadius: 18,
            padding: 18,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.74) 100%)',
            border: '1px solid rgba(15, 23, 42, 0.10)',
            boxShadow: '0 28px 80px rgba(2, 6, 23, 0.18)',
            animation: 'cautionIn 220ms ease both',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={closeCaution}
            aria-label="Close"
            title="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(15, 23, 42, 0.12)',
              background: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 900,
              color: '#0f172a',
            }}
          >
            ×
          </button>

          <div style={{ fontSize: 14, color: 'rgba(15, 23, 42, 0.72)' }}>
            {caution?.reason ? `Reason: ${String(caution.reason).replace(/_/g, ' ')}` : ''}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '12px 12px',
              borderRadius: 14,
              background:
                'linear-gradient(180deg, rgba(254,242,242,0.95) 0%, rgba(254,226,226,0.85) 100%)',
              border: '1px solid rgba(244, 63, 94, 0.28)',
              color: '#9f1239',
              fontSize: 14,
              fontWeight: 500,
              boxShadow: '0 10px 24px rgba(159, 18, 57, 0.10)',
            }}
          >
            {caution?.message || 'Session ended.'}
          </div>
        </div>
      </div>
    );
  }

  if (route.kind === 'login') return <Login onRegister={() => navigate('/')} />;

  if (route.kind === 'autologin') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #cfe8ff 0%, #eaf5ff 55%, #ffffff 100%)',
          color: '#0f172a',
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <style>{`
          @keyframes cautionIn {
            from { opacity: 0; transform: translateY(10px) scale(0.99); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Modal backdrop (click outside to close) */}
        <div
          onClick={closeCaution}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
          }}
        />

        {/* Modal card */}
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            zIndex: 60,
            width: 560,
            maxWidth: '92vw',
            borderRadius: 18,
            padding: 18,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.74) 100%)',
            border: '1px solid rgba(15, 23, 42, 0.10)',
            boxShadow: '0 28px 80px rgba(2, 6, 23, 0.18)',
            animation: 'cautionIn 220ms ease both',
            textAlign: 'center',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeCaution}
            aria-label="Close"
            title="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(15, 23, 42, 0.12)',
              background: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 900,
              color: '#0f172a',
            }}
          >
            ×
          </button>

          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
            {autoState.status === 'loading' ? 'Signing you in' : 'Sign-in'}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(15, 23, 42, 0.72)' }}>
            {autoState.username ? `User: ${autoState.username}` : 'Reading username from URL…'}
          </div>

          {autoState.status === 'error' && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 12px',
                borderRadius: 14,
                background:
                  'linear-gradient(180deg, rgba(254,242,242,0.95) 0%, rgba(254,226,226,0.85) 100%)',
                border: '1px solid rgba(244, 63, 94, 0.28)',
                color: '#9f1239',
                fontSize: 14,
                fontWeight: 500,
                boxShadow: '0 10px 24px rgba(159, 18, 57, 0.10)',
              }}
            >
              {autoState.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
