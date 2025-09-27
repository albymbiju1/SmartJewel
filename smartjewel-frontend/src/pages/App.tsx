import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { useAuth } from '../contexts/AuthContext';
import { getRoleBasedRedirectPath } from '../utils/roleRedirect';

export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'register'>('login');
  const { user, login, logout, isAuthenticated, isLoading } = useAuth();

  // Set view based on URL path
  useEffect(() => {
    if (location.pathname === '/register') {
      setView('register');
    } else {
      setView('login');
    }
  }, [location.pathname]);


  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl w-full max-w-md">
          <div className="auth-header">
            <div className="flex justify-center mb-4">
              <img src="/logo192.png" alt="SmartJewel logo" width="192" height="192" className="h-10 md:h-12 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  // If already authenticated, do not show this page; redirect to role-based dashboard
  if (isAuthenticated && user) {
    const redirectPath = getRoleBasedRedirectPath(user.role?.role_name || '');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600 text-sm">Redirecting to dashboard…</div>
        {(() => { navigate(redirectPath); return null; })()}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Main Content */}
      <div className="flex justify-center items-center min-h-screen p-6">
        {view === 'login' && (
          <LoginForm
            onSuccess={(tokens, u) => {
              login(tokens, u);
              const redirectPath = getRoleBasedRedirectPath(u.role?.role_name || '');
              navigate(redirectPath);
            }}
            switchToRegister={() => navigate('/register')}
          />
        )}
        {view === 'register' && (
          <RegisterForm
            onSuccess={(email) => navigate('/verify-otp', { state: { email } })}
            switchToLogin={() => navigate('/login')}
          />
        )}
      </div>
    </div>
  );
};
