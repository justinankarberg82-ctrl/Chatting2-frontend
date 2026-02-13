import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onRegister }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  // passwordless login: account only

  function handleSubmit(e) {
    e.preventDefault();
    submit();
  }

  async function submit() {
    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         alert(data.error || 'Login failed');
         return;
       }

      const data = await res.json();
      if (!data.token) {
        alert('Login failed: no token received');
        return;
      }

      login(data.token);
     } catch (err) {
       alert('Server error. Please check backend configuration.');
     }
  }

  // signup removed

  return (
    <>
      {/* Blur overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 10,
        }}
      />

      {/* Login modal */}
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 360,
            padding: 24,
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            zIndex: 20,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          {/* Close button */}
          <button
            onClick={onRegister}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>

        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
            Log in
          </div>

          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onFocus={e => {
              e.target.style.borderColor = '#000';
              e.target.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.15)';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#d0d0d0';
              e.target.style.boxShadow = 'none';
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 18px',
              marginBottom: 16,
              borderRadius: '999px',
              border: '1px solid #d0d0d0',
              fontSize: 15,
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />

          {/* password removed */}

          {/* signup UI fully removed */}

          <button
            type="submit"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 18px',
              borderRadius: '999px',
              border: 'none',
              background: '#000000',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </form>

        {/* signup removed */}
      </div>
    </>
  );
}
