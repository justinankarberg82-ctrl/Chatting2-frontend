import { useState } from 'react';

export default function Register({ onRegistered, onCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function submit() {
    if (!email || !password) {
      alert('Email and password are required');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: email.split('@')[0],
          email,
          password,
          major: 'General'
        })
      });

      if (!res.ok) {
        const msg = res.status === 409 ? 'Email already exists' : 'Registration failed';
        alert(msg);
        return;
      }

      alert('Registration successful. Please login.');
      onRegistered();
    } catch (err) {
      alert('Server error. Is backend running?');
    }
  }

  return (
    <div>
      <h2>Register</h2>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      <div>
        <button onClick={submit}>Register</button>
        <button onClick={onCancel}>Back to Login</button>
      </div>
    </div>
  );
}
