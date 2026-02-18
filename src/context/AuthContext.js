import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, SOCKET_ORIGIN } from '../lib/net';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const fromSession = sessionStorage.getItem('token');
    if (fromSession) return fromSession;
    // Backward-compat: migrate legacy localStorage token into sessionStorage.
    const fromLocal = localStorage.getItem('token');
    if (fromLocal) {
      sessionStorage.setItem('token', fromLocal);
      localStorage.removeItem('token');
      return fromLocal;
    }
    return null;
  });
  const socketRef = useRef(null);
  const [logoutSignal, setLogoutSignal] = useState(null);
  const [caution, setCaution] = useState(null);

  function clearSession() {
    try {
      sessionStorage.removeItem('token');
      localStorage.removeItem('token');
    } catch {
      // ignore
    }
    setToken(null);
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }
  }

  function forceLogout(nextCaution) {
    setCaution(nextCaution || { reason: 'logout', at: new Date().toISOString() });
    setLogoutSignal(null);
    clearSession();
  }

  function decodeJwtPayload(t) {
    try {
      const part = t.split('.')[1];
      if (!part) return null;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  const user = useMemo(() => {
    if (!token) return null;
    return decodeJwtPayload(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_ORIGIN || undefined, { auth: { token } });
    socket.on('user:event', (evt) => {
      if (evt?.type !== 'FORCE_LOGOUT') return;

      const reason = String(evt?.reason || 'logout');
      const message =
        reason === 'disabled'
          ? 'Your account was disabled by an admin.'
          : reason === 'deleted'
            ? 'Your account was deleted by an admin.'
            : 'Session ended.';

      forceLogout({ reason, message, at: evt?.at || new Date().toISOString() });
    });

    // If server forcibly disconnects sockets (e.g., user disabled/deleted) but the logout event
    // was missed, still end the session and show caution.
    socket.on('disconnect', (reason) => {
      const r = String(reason || '');
      if (!token) return;
      if (r === 'io server disconnect' || r === 'server namespace disconnect') {
        forceLogout({
          reason: 'session_ended',
          message: 'Session ended.',
          at: new Date().toISOString(),
        });
      }
    });

    socket.on('connect_error', (err) => {
      if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
        forceLogout({
          reason: 'server_restart',
          message: 'Server restarted. Please open your URL again.',
          at: new Date().toISOString(),
        });
      }
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [token]);

  function login(token) {
    // Session-only token: closing the browser logs the user out.
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
    setLogoutSignal(null);
    setCaution(null);
    setToken(token);
  }

  function logout() {
    const t = token || sessionStorage.getItem('token') || localStorage.getItem('token');
    if (t) {
      fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      }).catch(() => {});
    }
    setLogoutSignal(null);
    setCaution(null);
    clearSession();

    // If the user is on a username URL (auto-login), go back to landing.
    try {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.assign('/');
      }
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        forceLogout,
        caution,
        clearCaution: () => setCaution(null),
        logoutSignal,
        setLogoutSignal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
