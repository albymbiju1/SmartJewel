import React, { useEffect } from 'react';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from './Toast';
import { flyToCart } from '../utils/flyToCart';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Bridges temporary CustomEvents dispatched from UI to Context APIs
// Listened events:
// - 'sj:toggleWishlist' -> WishlistContext.toggleWishlist (auth required)
// - 'sj:addToCart' -> CartContext.addToCart (auth required)
// - 'sj:buyNow' -> add to cart then navigate to checkout (auth required)
const EventBridge: React.FC = () => {
  const { toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const redirectToLogin = () => navigate('/login', { replace: false });

    const onToggleWishlist = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (!detail?.productId || !detail?.name) return;
      if (!isAuthenticated) {
        redirectToLogin();
        return;
      }
      toggleWishlist({
        productId: String(detail.productId),
        name: String(detail.name),
        price: typeof detail.price === 'number' ? detail.price : undefined,
        image: typeof detail.image === 'string' ? detail.image : undefined,
        metal: typeof detail.metal === 'string' ? detail.metal : undefined,
        purity: typeof detail.purity === 'string' ? detail.purity : undefined,
      });
    };

    const onAddToCart = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (!detail?.productId || !detail?.name) return;
      if (!isAuthenticated) {
        redirectToLogin();
        return;
      }
      const quantity = typeof detail.quantity === 'number' ? detail.quantity : 1;
      addToCart({
        productId: String(detail.productId),
        sku: typeof detail.sku === 'string' ? detail.sku : undefined,
        name: String(detail.name),
        price: typeof detail.price === 'number' ? detail.price : undefined,
        image: typeof detail.image === 'string' ? detail.image : undefined,
        size: typeof detail.size === 'string' && detail.size ? detail.size : undefined,
        style: typeof detail.style === 'string' && detail.style ? detail.style : undefined,
        metal: typeof detail.metal === 'string' ? detail.metal : undefined,
        purity: typeof detail.purity === 'string' ? detail.purity : undefined,
      }, quantity);
      // Visual confirmation globally for addToCart events
      toast.success('Added to Bag', { description: String(detail.name) });
      try {
        const src: Element | null = typeof detail.sourceSelector === 'string'
          ? document.querySelector(detail.sourceSelector)
          : (detail.sourceElement as Element | null);
        if (src) flyToCart({ source: src });
      } catch {}
      window.dispatchEvent(new CustomEvent('sj:cart:bounce'));
    };

    const onBuyNow = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (!detail?.productId || !detail?.name) return;
      if (!isAuthenticated) {
        redirectToLogin();
        return;
      }
      const quantity = typeof detail.quantity === 'number' ? detail.quantity : 1;
      addToCart({
        productId: String(detail.productId),
        sku: typeof detail.sku === 'string' ? detail.sku : undefined,
        name: String(detail.name),
        price: typeof detail.price === 'number' ? detail.price : undefined,
        image: typeof detail.image === 'string' ? detail.image : undefined,
        size: typeof detail.size === 'string' && detail.size ? detail.size : undefined,
        style: typeof detail.style === 'string' && detail.style ? detail.style : undefined,
        metal: typeof detail.metal === 'string' ? detail.metal : undefined,
        purity: typeof detail.purity === 'string' ? detail.purity : undefined,
      }, quantity);
      navigate('/checkout');
    };

    window.addEventListener('sj:toggleWishlist', onToggleWishlist as EventListener);
    window.addEventListener('sj:addToCart', onAddToCart as EventListener);
    window.addEventListener('sj:buyNow', onBuyNow as EventListener);
    return () => {
      window.removeEventListener('sj:toggleWishlist', onToggleWishlist as EventListener);
      window.removeEventListener('sj:addToCart', onAddToCart as EventListener);
      window.removeEventListener('sj:buyNow', onBuyNow as EventListener);
    };
  }, [toggleWishlist, addToCart, toast, isAuthenticated, navigate]);

  return null;
};

export default EventBridge;