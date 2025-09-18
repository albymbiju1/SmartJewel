import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

interface WishlistItem {
  productId: string;
  name: string;
  price?: number;
  image?: string;
  metal?: string;
  purity?: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  toggleWishlist: (item: WishlistItem) => void;
  isWishlisted: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

const STORAGE_KEY = 'sj_wishlist_v1';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as WishlistItem[] : [];
    } catch {
      return [];
    }
  });

  // Persist locally for quick UX
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Sync from backend on login
  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user) {
        // On logout, clear local wishlist
        setItems([]);
        return;
      }
      try {
        const res = await api.get('/customers/me/wishlist');
        const backendItems = Array.isArray(res.data.items) ? res.data.items : [];
        setItems(backendItems);
      } catch (e) {
        // fallback to local if backend not available
      }
    };
    if (!authLoading) fetchWishlist();
  }, [user, authLoading]);

  const toggleWishlist = async (item: WishlistItem) => {
    setItems(prev => {
      const next = prev.some(x => x.productId === item.productId)
        ? prev.filter(x => x.productId !== item.productId)
        : [...prev, item];
      // Fire-and-forget sync to backend if logged in
      if (user) {
        api.put('/customers/me/wishlist', { items: next }).catch(()=>{});
      }
      return next;
    });
  };

  const isWishlisted = (productId: string) => items.some(x => x.productId === productId);
  const remove = (productId: string) => setItems(prev => {
    const next = prev.filter(x => x.productId !== productId);
    if (user) { api.put('/customers/me/wishlist', { items: next }).catch(()=>{}); }
    return next;
  });
  const clear = () => setItems(prev => {
    const next: WishlistItem[] = [];
    if (user) { api.put('/customers/me/wishlist', { items: next }).catch(()=>{}); }
    return next;
  });
  const count = useMemo(() => items.length, [items]);

  const value: WishlistContextValue = { items, toggleWishlist, isWishlisted, remove, clear, count };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}