import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { Search, Heart, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { NotificationBell } from './NotificationBell';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [cartBump, setCartBump] = useState(false);
  const prevCartCount = useRef<number>(0);

  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartBump(true);
      const t = window.setTimeout(() => setCartBump(false), 350);
      return () => window.clearTimeout(t);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    const fn = () => { setCartBump(true); window.setTimeout(() => setCartBump(false), 350); };
    window.addEventListener('sj:cart:bounce', fn as EventListener);
    return () => window.removeEventListener('sj:cart:bounce', fn as EventListener);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <img src="/logo192.png" alt="SmartJewel" className="h-8 w-auto" />
          </button>
          <nav className="hidden md:flex items-center gap-6 text-gray-700 font-medium">
            <Link to="/products" className="hover:text-amber-600">All Jewellery</Link>
            <Link to="/products?category=gold" className="hover:text-amber-600">Gold</Link>
            <Link to="/products?category=diamond" className="hover:text-amber-600">Diamond</Link>
            <Link to="/products?category=wedding" className="hover:text-amber-600">Wedding</Link>
            <Link to="/products?category=gifting" className="hover:text-amber-600">Gifting</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">

          {/* Notifications */}
          <NotificationBell />

          <button className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => setShowSearch(s => !s)} title="Search">
            <Search className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <Link to="/wishlist" className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50" title="Wishlist">
            <Heart className="w-5 h-5" strokeWidth={1.5} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center shadow">{wishlistCount}</span>
            )}
          </Link>
          <Link to="/cart" className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 ${cartBump ? 'animate-bounce-once' : ''}`} title="Cart" aria-label="Cart" data-cart-anchor>
            <ShoppingCart className="w-5 h-5" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] leading-[18px] text-center shadow ${cartBump ? 'animate-bounce-once' : ''}`}>{cartCount}</span>
            )}
          </Link>
        </div>
      </div>
      <div className={`${showSearch ? 'block' : 'hidden'} border-t border-gray-100 bg-white`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <SearchBar placeholder="Search for rings, necklaces, designs and more" />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
