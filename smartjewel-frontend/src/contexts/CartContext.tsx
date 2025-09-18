import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { productPriceService } from '../services/productPriceService';

export interface CartItem {
  productId: string;
  name: string;
  price?: number;
  currentPrice?: number; // Fresh price from API
  image?: string;
  quantity: number;
  size?: string;
  style?: string;
  metal?: string;
  purity?: string;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refreshPrices: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = 'sj_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as CartItem[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Sync from backend on login, clear on logout
  useEffect(() => {
    const fetchCart = async () => {
      if (!user) {
        setItems([]);
        return;
      }
      try {
        const res = await api.get('/customers/me/cart');
        const backendItems = Array.isArray(res.data.items) ? res.data.items : [];
        setItems(backendItems);
        
        // Refresh prices after loading cart items
        if (backendItems.length > 0) {
          setTimeout(() => {
            const productIds = backendItems.map((item: CartItem) => item.productId);
            productPriceService.getCurrentPrices(productIds).then(currentPrices => {
              setItems(prev => prev.map(item => ({
                ...item,
                currentPrice: currentPrices.get(item.productId) || item.price
              })));
            }).catch(() => {
              // Ignore price refresh errors
            });
          }, 100);
        }
      } catch (e) {
        // ignore
      }
    };
    if (!authLoading) fetchCart();
  }, [user, authLoading]);

  const addToCart = (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.productId === item.productId && x.size === item.size && x.style === item.style);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + quantity) };
        if (user) { api.put('/customers/me/cart', { items: next }).catch(()=>{}); }
        return next;
      }
      const next = [...prev, { ...item, quantity: Math.max(1, Math.min(99, quantity)) }];
      if (user) { api.put('/customers/me/cart', { items: next }).catch(()=>{}); }
      return next;
    });
  };

  const removeFromCart = (productId: string) => setItems(prev => {
    const next = prev.filter(x => x.productId !== productId);
    if (user) { api.put('/customers/me/cart', { items: next }).catch(()=>{}); }
    return next;
  });
  const updateQuantity = (productId: string, quantity: number) => setItems(prev => {
    const next = prev.map(x => x.productId === productId ? { ...x, quantity: Math.max(1, Math.min(99, quantity)) } : x);
    if (user) { api.put('/customers/me/cart', { items: next }).catch(()=>{}); }
    return next;
  });
  const clearCart = () => setItems(prev => {
    const next: CartItem[] = [];
    if (user) { api.put('/customers/me/cart', { items: next }).catch(()=>{}); }
    return next;
  });

  const refreshPrices = async () => {
    if (items.length === 0) return;
    
    try {
      // Clear price cache to force fresh price fetching
      productPriceService.clearAllCache();
      
      const productIds = items.map(item => item.productId);
      const currentPrices = await productPriceService.getCurrentPrices(productIds);
      
      setItems(prev => prev.map(item => ({
        ...item,
        currentPrice: currentPrices.get(item.productId) || item.price
      })));
    } catch (error) {
      console.warn('Failed to refresh cart prices:', error);
    }
  };

  const cartCount = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items]);
  const cartTotal = useMemo(() => items.reduce((sum, it) => {
    // Use currentPrice if available, otherwise fall back to stored price
    const price = it.currentPrice || it.price || 0;
    return sum + price * it.quantity;
  }, 0), [items]);

  const value: CartContextValue = { items, addToCart, removeFromCart, updateQuantity, clearCart, refreshPrices, cartCount, cartTotal };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}