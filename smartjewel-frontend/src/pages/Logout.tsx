import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Logout: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    // Clear tokens/state
    logout();

    // Client-side redirect first
    navigate('/login', { replace: true });

    // Final hard fallback in case SPA navigation fails for any reason
    const t = setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, 100);

    return () => clearTimeout(t);
  }, [logout, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 text-sm">Signing you out…</div>
    </div>
  );
};

