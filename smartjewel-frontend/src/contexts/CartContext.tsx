import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { productPriceService } from '../services/productPriceService';

export interface CartItem {
  productId: string;
  sku?: string;
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
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
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
  
  // Debounce timer for API calls
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced sync function to prevent excessive API calls
  const debouncedSync = (newItems: CartItem[]) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(async () => {
      if (user) {
        try {
          await api.put('/customers/me/cart', { items: newItems });
        } catch (error) {
          console.error('Failed to sync cart to backend:', error);
        }
      }
    }, 500); // 500ms debounce
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

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

  const addToCart = async (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    try {
      // First, check stock availability
      const response = await api.get('/inventory/products');
      const products = response.data.products || [];
      const product = products.find((p: any) => p.sku === item.sku || p._id === item.productId);
      
      if (!product) {
        console.warn('Product not found for stock validation');
        return;
      }

      const availableQuantity = product.quantity || 0;
      const currentCartQuantity = items.find(x => x.productId === item.productId && x.size === item.size && x.style === item.style)?.quantity || 0;
      const requestedQuantity = currentCartQuantity + quantity;

      if (requestedQuantity > availableQuantity) {
        if (availableQuantity === 0) {
          console.warn('Product is out of stock');
          return;
        } else {
          console.warn(`Only ${availableQuantity} items available, requested ${requestedQuantity}`);
          // Limit to available quantity
          quantity = Math.max(0, availableQuantity - currentCartQuantity);
          if (quantity <= 0) {
            console.warn('Cannot add more items - stock limit reached');
            return;
          }
        }
      }

      const newItems = (() => {
        const idx = items.findIndex(x => x.productId === item.productId && x.size === item.size && x.style === item.style);
        if (idx >= 0) {
          const next = [...items];
          next[idx] = { ...next[idx], quantity: Math.min(availableQuantity, next[idx].quantity + quantity) };
          return next;
        }
        return [...items, { ...item, quantity: Math.max(1, Math.min(availableQuantity, quantity)) }];
      })();

      setItems(newItems);
      debouncedSync(newItems);
    } catch (error) {
      console.error('Failed to validate stock before adding to cart:', error);
      // Fallback to original behavior if stock check fails
      const newItems = (() => {
        const idx = items.findIndex(x => x.productId === item.productId && x.size === item.size && x.style === item.style);
        if (idx >= 0) {
          const next = [...items];
          next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + quantity) };
          return next;
        }
        return [...items, { ...item, quantity: Math.max(1, Math.min(99, quantity)) }];
      })();

      setItems(newItems);
      debouncedSync(newItems);
    }
  };

  const removeFromCart = async (productId: string) => {
    const newItems = items.filter(x => x.productId !== productId);
    setItems(newItems);
    debouncedSync(newItems);
  };
  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      // Check stock availability before updating quantity
      const response = await api.get('/inventory/products');
      const products = response.data.products || [];
      const product = products.find((p: any) => p._id === productId);
      
      let finalQuantity = quantity;
      
      if (product) {
        const availableQuantity = product.quantity || 0;
        finalQuantity = Math.max(1, Math.min(availableQuantity, quantity));
        
        if (finalQuantity !== quantity && availableQuantity > 0) {
          console.warn(`Limited to ${availableQuantity} items available`);
        }
      } else {
        // Fallback to original behavior if product not found
        finalQuantity = Math.max(1, Math.min(99, quantity));
      }
      
      const newItems = items.map(x => x.productId === productId ? { ...x, quantity: finalQuantity } : x);
      setItems(newItems);
      debouncedSync(newItems);
    } catch (error) {
      console.error('Failed to validate stock before updating quantity:', error);
      // Fallback to original behavior
      const newItems = items.map(x => x.productId === productId ? { ...x, quantity: Math.max(1, Math.min(99, quantity)) } : x);
      setItems(newItems);
      debouncedSync(newItems);
    }
  };
  const clearCart = async () => {
    const newItems: CartItem[] = [];
    setItems(newItems);
    debouncedSync(newItems);
  };

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