import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  const [items, setItems] = useState<WishlistItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as WishlistItem[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const toggleWishlist = (item: WishlistItem) => {
    setItems(prev => prev.some(x => x.productId === item.productId)
      ? prev.filter(x => x.productId !== item.productId)
      : [...prev, item]
    );
  };

  const isWishlisted = (productId: string) => items.some(x => x.productId === productId);
  const remove = (productId: string) => setItems(prev => prev.filter(x => x.productId !== productId));
  const clear = () => setItems([]);
  const count = useMemo(() => items.length, [items]);

  const value: WishlistContextValue = { items, toggleWishlist, isWishlisted, remove, clear, count };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}