import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

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

    const socket = io('http://localhost:5000', { auth: { token } });
    socket.on('user:event', (evt) => {
      if (evt?.type === 'FORCE_LOGOUT') {
        setLogoutSignal({
          reason: evt.reason || 'logout',
          at: evt.at || new Date().toISOString(),
        });
      }
    });

    socket.on('connect_error', (err) => {
      if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
        setLogoutSignal({ reason: 'server_restart', at: new Date().toISOString() });
        // Clear local session; /api/logout may not accept expired tokens.
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');
        setToken(null);
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
    setToken(token);
  }

  function logout() {
    const t = token || sessionStorage.getItem('token') || localStorage.getItem('token');
    if (t) {
      fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      }).catch(() => {});
    }
    setLogoutSignal(null);
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, logoutSignal, setLogoutSignal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
