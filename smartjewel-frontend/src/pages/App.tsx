import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { setAuthToken } from '../api';

export const App: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<any>(null);

  return (
    <div className="erp-shell">
      <div className="panel">
        <h1 className="logo">SmartJewel</h1>
        {!user && view === 'login' && (
          <LoginForm
            onSuccess={(tokens, u) => {
              setAuthToken(tokens.access_token);
              setUser(u);
            }}
            switchToRegister={() => setView('register')}
          />
        )}
        {!user && view === 'register' && (
          <RegisterForm
            onSuccess={() => setView('login')}
            switchToLogin={() => setView('login')}
          />
        )}
        {user && (
          <div>
            <p>Welcome, {user.name || user.email}</p>
            <button onClick={() => { setUser(null); setAuthToken(undefined); }}>Logout</button>
          </div>
        )}
      </div>
    </div>
  );
};
