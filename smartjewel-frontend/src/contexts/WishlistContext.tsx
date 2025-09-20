import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { productPriceService } from '../services/productPriceService';

interface WishlistItem {
  productId: string;
  name: string;
  price?: number;
  currentPrice?: number; // Fresh price from API
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
  refreshPrices: () => Promise<void>;
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
        
        // Refresh prices after loading wishlist items
        if (backendItems.length > 0) {
          setTimeout(() => {
            const productIds = backendItems.map((item: WishlistItem) => item.productId);
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
      console.warn('Failed to refresh wishlist prices:', error);
    }
  };

  const count = useMemo(() => items.length, [items]);

  const value: WishlistContextValue = { items, toggleWishlist, isWishlisted, remove, clear, refreshPrices, count };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}