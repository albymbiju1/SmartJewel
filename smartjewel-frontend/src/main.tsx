import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './router';
import { AuthProvider } from './contexts/AuthContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);
