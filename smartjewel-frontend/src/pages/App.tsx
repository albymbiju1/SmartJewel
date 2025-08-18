import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { useAuth } from '../contexts/AuthContext';

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

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

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
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo192.png" alt="SmartJewel" />
            </div>
            <h1>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="logo">
            <img src="/logo192.png" alt="SmartJewel" className="logo-image" />
          </Link>
          
          <div className="nav-actions">
            <Link to="/" className="nav-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9,22 9,12 15,12 15,22"></polyline>
              </svg>
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="auth-container">
        {!isAuthenticated && view === 'login' && (
          <LoginForm
            onSuccess={(tokens, u) => {
              login(tokens, u);
            }}
            switchToRegister={() => navigate('/register')}
          />
        )}
        {!isAuthenticated && view === 'register' && (
          <RegisterForm
            onSuccess={() => navigate('/login')}
            switchToLogin={() => navigate('/login')}
          />
        )}
        {isAuthenticated && user && (
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo">
                <img src="/logo192.png" alt="SmartJewel" />
              </div>
              <h1>Welcome Back!</h1>
              <p>Hello, {user.full_name || user.email}</p>
            </div>
            <div className="auth-form">
              <button 
                onClick={logout}
                className="auth-button"
              >
                Logout
              </button>
              <Link to="/" className="auth-button" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
