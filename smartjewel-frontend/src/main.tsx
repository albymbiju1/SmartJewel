import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './router';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import EventBridge from './components/EventBridge';
import { ToastProvider } from './components/Toast';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <WishlistProvider>
      <CartProvider>
        <ToastProvider>
          {/* Bridge custom events to contexts (temporary) */}
          <EventBridge />
          {/* Global cart anchor for fly-to-cart fallback (positioned top-right, off-screen) */}
          <div data-cart-anchor style={{ position: 'fixed', top: 8, right: 8, width: 24, height: 24, pointerEvents: 'none', zIndex: 999 }} />
          <AppRouter />
        </ToastProvider>
      </CartProvider>
    </WishlistProvider>
  </AuthProvider>
);
