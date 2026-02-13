import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';

function Router() {
  const { token, user } = useAuth();

  if (token && user?.role === 'admin') return <AdminDashboard />;
  if (token) return <ChatPage />;

  // Registration is handled inside the Login sign-up modal
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
