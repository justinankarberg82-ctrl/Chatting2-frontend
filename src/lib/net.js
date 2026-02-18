// Centralized network endpoints.
// Defaults:
// - Local dev (frontend on localhost): talk to backend at http://localhost:5000
// - Deployed: use same-origin (/api + same-origin socket)

function stripTrailingSlashes(s) {
  return String(s || '').replace(/\/+$/g, '');
}

export function getApiOrigin() {
  const fromEnv = stripTrailingSlashes(process.env.REACT_APP_API_ORIGIN);
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
  }

  // Same-origin (expects reverse proxy to backend).
  return '';
}

export const API_ORIGIN = getApiOrigin();
export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

export const SOCKET_ORIGIN = (() => {
  const fromEnv = stripTrailingSlashes(process.env.REACT_APP_SOCKET_ORIGIN);
  if (fromEnv) return fromEnv;
  return API_ORIGIN; // empty => same-origin
})();
