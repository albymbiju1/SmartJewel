import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { MENU as MEGA_MENU, NAV_TABS } from '../menuConfig';
import { SearchBar } from './SearchBar';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { cartCount } = useCart();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [mmCategories, setMmCategories] = useState<string[]>([]);
  const [mmMetals, setMmMetals] = useState<string[]>([]);
  const [mmPrices, setMmPrices] = useState<string[]>([]);
  const [mmPurities, setMmPurities] = useState<string[]>([]);
  const [mmColors, setMmColors] = useState<string[]>([]);
  const [mmEarringTypes, setMmEarringTypes] = useState<string[]>([]);
  const [mmOccasions, setMmOccasions] = useState<string[]>([]);
  const [mmStyles, setMmStyles] = useState<string[]>([]);
  const [mmBudgets, setMmBudgets] = useState<string[]>([]);
  const [mmFor, setMmFor] = useState<string[]>([]);

  const userMenuRef = useRef<HTMLDivElement | HTMLButtonElement>(null);

  const [cartBump, setCartBump] = useState(false);
  const prevCartCount = useRef<number>(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdown = document.querySelector('.tq-account-dropdown');
      if (userMenuRef.current && userMenuRef.current.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;
      setShowUserMenu(false);
    };
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    setMmCategories([]);
    setMmMetals([]);
    setMmPrices([]);
    setMmPurities([]);
    setMmColors([]);
    setMmEarringTypes([]);
    setMmOccasions([]);
    setMmStyles([]);
    setMmBudgets([]);
    setMmFor([]);
  }, [activeMenu]);

  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartBump(true);
      window.setTimeout(() => setCartBump(false), 350);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    const fn = () => { setCartBump(true); window.setTimeout(() => setCartBump(false), 350); };
    window.addEventListener('sj:cart:bounce', fn as EventListener);
    return () => window.removeEventListener('sj:cart:bounce', fn as EventListener);
  }, []);

  const normalizeCategory = (c: string) => c.toLowerCase().replace(/\s+/g, '-');
  const priceLabelToSlug = (label: string) => {
    const t = label.toLowerCase();
    if (t.includes('under') && (t.includes('25') || t.includes('25k'))) return 'under-25k';
    if (t.includes('25') && (t.includes('50') || t.includes('50k'))) return '25k-50k';
    if ((t.includes('50') && t.includes('100')) || t.includes('100k')) return '50k-100k';
    if (t.includes('above') || t.includes('1,00,000') || t.includes('100k')) return 'above-100k';
    return '';
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm" role="navigation" aria-label="Primary">
      <div className="container-xl relative flex items-center justify-between gap-4 py-2">
        <div className="hidden md:flex items-center gap-4">
          <button 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-brand-burgundy px-2 py-1 rounded-md" 
            title="Find a Store"
            onClick={() => navigate('/find-store')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>Find a Store</span>
          </button>
        </div>

        <div className="flex items-center">
          <img src="/logo192.png" alt="SmartJewel logo" width="192" height="192" className="h-10 md:h-12 w-auto object-contain select-none" />
        </div>

        <div className="relative flex items-center gap-2">
          {isAuthenticated && (user?.role?.role_name === 'Admin' || user?.role?.role_name === 'Staff_L3') && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/items')}>Items</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/stock')}>Stock</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/tags')}>Tags</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/locations')}>Locations</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/prices')}>Prices</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/valuation')}>Valuation</button>
              <button className="text-sm text-gray-700 hover:text-brand-burgundy" onClick={()=>navigate('/inventory/bom')}>BOM</button>
            </div>
          )}
          <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy" title="Search" aria-label="Search" onClick={() => setShowSearch((s)=>!s)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
          </button>
          <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy" title={isAuthenticated ? (user?.full_name || user?.email || 'Account'): 'Account'} onClick={()=>{ isAuthenticated ? setShowUserMenu(!showUserMenu) : navigate('/login')}} aria-label="Account" ref={userMenuRef as React.RefObject<HTMLButtonElement>}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </button>
          <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy" title="Wishlist" aria-label="Wishlist" onClick={()=>navigate('/wishlist')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center shadow">
                {wishlistCount}
              </span>
            )}
          </button>
          <button id="app-cart-button" className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy ${cartBump ? 'animate-bounce-once' : ''}`} title="Cart" aria-label="Cart" onClick={()=>navigate('/cart')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] leading-[18px] text-center shadow ${cartBump ? 'animate-bounce-once' : ''}`}>
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {isAuthenticated && showUserMenu && (
          <div className="tq-account-dropdown absolute right-6 top-[52px] md:top-[66px] lg:top-[76px] w-60 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden" role="menu" aria-label="Account menu">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="font-semibold text-sm text-gray-900">{user?.full_name || user?.email}</div>
              <div className="text-xs text-gray-500">{user?.role?.role_name}</div>
            </div>
            <button className="w-full text-left bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={()=>{ setShowUserMenu(false); navigate('/profile'); }}>My Profile</button>
            <button className="w-full text-left bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={()=>{ setShowUserMenu(false); navigate('/my-orders'); }}>My Orders</button>
            <button className="w-full text-left bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50" onClick={()=>{ setShowUserMenu(false); logout(); navigate('/login', { replace: true }); }}>Sign Out</button>
          </div>
        )}
      </div>

      <div className={`${showSearch ? 'block' : 'hidden'} border-y border-gray-100 bg-white`} role="search">
        <div className="max-w-[900px] mx-auto px-6 py-3">
          <SearchBar placeholder="Search for rings, necklaces, designs and more" />
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white z-header sticky top-0">
        <div className="container-xl relative h-12 flex items-center" onMouseLeave={() => setActiveMenu(null)}>
          <ul className="list-none flex gap-6 items-center relative" role="menubar" aria-label="Category Navigation" onKeyDown={(e)=>{
            const items = NAV_TABS.map(t => t.key);
            const idx = activeMenu ? items.indexOf(activeMenu) : -1;
            if(e.key==='Escape'){ setActiveMenu(null); }
            if(e.key==='ArrowRight'){
              const next = items[(Math.max(idx, -1)+1)%items.length];
              setActiveMenu(next);
            }
            if(e.key==='ArrowLeft'){
              const prev = items[(items.length + (idx===-1?items.length-1:idx-1))%items.length];
              setActiveMenu(prev);
            }
            if(e.key==='ArrowDown'){
              if(!activeMenu) setActiveMenu(items[0]);
            }
          }}>
          {NAV_TABS.map((item)=> (
            <li key={item.key} className="relative" role="none">
              <button
                className={`border-0 bg-transparent text-[15px] font-medium cursor-pointer py-2 transition-colors border-b-2 border-transparent ${activeMenu===item.key ? 'text-gray-900 border-brand-burgundy' : 'text-gray-700 hover:text-gray-900 hover:border-gray-300'}`}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={activeMenu===item.key}
                onMouseEnter={() => setActiveMenu(item.key)}
                onFocus={() => setActiveMenu(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
          </ul>
          {activeMenu && (
            <div className="absolute left-0 top-12 w-full max-w-[1100px] hidden md:block">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-6 p-6 bg-white border border-gray-200 rounded-xl shadow-2xl animate-[fadeSlide_.2s_ease-out]" onMouseEnter={() => setActiveMenu(activeMenu)}>
                {(MEGA_MENU[activeMenu!]?.columns || MEGA_MENU['all'].columns).map((col) => (
                  <div key={col.title}>
                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-gray-100">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 shadow"></span>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-gray-700 font-semibold">{col.title}</div>
                    </div>
                    {col.items.map((it) => {
                      const isCategory = col.title.toLowerCase().includes('category') || 
                                        col.title.toLowerCase()==='for her' || 
                                        col.title.toLowerCase()==='for him' || 
                                        col.title.toLowerCase()==='trending' || 
                                        col.title.toLowerCase()==='themes';
                      const isMetal = col.title.toLowerCase().includes('metal') && (it.label.toLowerCase()==='gold' || it.label.toLowerCase()==='diamond' || it.label.toLowerCase()==='platinum' || it.label.toLowerCase()==='silver');
                      const isPrice = col.title.toLowerCase().includes('price');
                      const isByBudget = col.title.toLowerCase().includes('budget');
                      const isByOccasion = col.title.toLowerCase().includes('by occasion');
                      const isPurity = col.title.toLowerCase().includes('purity');
                      const isColor = col.title.toLowerCase().includes('colour') || col.title.toLowerCase().includes('color') || col.title.toLowerCase().includes('metal colour');
                      const isEarringType = col.title.toLowerCase().includes('earrings types') || col.title.toLowerCase().includes('earring types');
                      const isOccasion = col.title.toLowerCase().includes('occasion') && !col.title.toLowerCase().includes('by occasion');
                      const isStyle = col.title.toLowerCase().includes('style');
                      const isFor = col.title.toLowerCase().includes('for') && !col.title.toLowerCase().includes('price') && !col.title.toLowerCase().includes('budget') && !col.title.toLowerCase().includes('by occasion');
                      const catSlug = normalizeCategory(it.label);
                      const priceSlug = priceLabelToSlug(it.label);
                      const metalSlug = it.label.toLowerCase();
                      const selected = (isCategory && mmCategories.includes(catSlug)) || 
                                      (isMetal && mmMetals.includes(metalSlug)) || 
                                      (isPrice && priceSlug && mmPrices.includes(priceSlug)) ||
                                      (isByBudget && mmBudgets.includes(it.label)) ||
                                      (isByOccasion && mmOccasions.includes(it.label)) ||
                                      (isPurity && mmPurities.includes(it.label)) ||
                                      (isColor && mmColors.includes(it.label)) ||
                                      (isEarringType && mmEarringTypes.includes(it.label)) ||
                                      (isOccasion && mmOccasions.includes(it.label)) ||
                                      (isStyle && mmStyles.includes(it.label)) ||
                                      (isFor && mmFor.includes(it.label));
                      const onClick = (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (isCategory) {
                          setMmCategories(prev => prev.includes(catSlug) ? prev.filter(x=>x!==catSlug) : [...prev, catSlug]);
                        } else if (isMetal) {
                          setMmMetals(prev => prev.includes(metalSlug) ? prev.filter(x=>x!==metalSlug) : [...prev, metalSlug]);
                        } else if (isByBudget) {
                          setMmBudgets(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isPrice) {
                          setMmPrices(prev => prev.includes(priceSlug) ? prev.filter(x=>x!==priceSlug) : [...prev, priceSlug]);
                        } else if (isPurity) {
                          setMmPurities(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isColor) {
                          setMmColors(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isEarringType) {
                          setMmEarringTypes(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isOccasion || isByOccasion) {
                          setMmOccasions(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isStyle) {
                          setMmStyles(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (isFor) {
                          setMmFor(prev => prev.includes(it.label) ? prev.filter(x=>x!==it.label) : [...prev, it.label]);
                        } else if (it.href) {
                          navigate(it.href);
                          setActiveMenu(null);
                        }
                      };
                      return (
                        <a
                          key={it.label}
                          href={it.href || '#'}
                          onClick={onClick}
                          className={`group relative block text-gray-700 text-sm my-1 no-underline rounded px-1 transition-colors duration-150 hover:text-brand-burgundy hover:bg-amber-50/50 ${selected ? 'text-brand-burgundy font-medium bg-amber-50/60' : ''}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            {selected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" className="text-amber-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
                                <defs>
                                  <linearGradient id="sjStar" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#f43f5e" />
                                  </linearGradient>
                                </defs>
                                <path fill="url(#sjStar)" d="M12 2l1.8 4.9L19 8.2l-4 3.1 1.4 5.2L12 13.8 7.6 16.5 9 11.3 5 8.2l5.2-1.3L12 2z"/>
                              </svg>
                            )}
                            {it.label}
                          </span>
                          <span className="pointer-events-none absolute left-0 -bottom-0.5 h-[2px] w-0 bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-200 group-hover:w-full"></span>
                        </a>
                      );
                    })}
                  </div>
                ))}
                {MEGA_MENU[activeMenu]?.promo && (
                  <div className="hidden md:flex flex-col gap-3">
                    <img src={MEGA_MENU[activeMenu]!.promo!.image} alt="promo" className="w-full h-28 object-cover rounded-lg" />
                    <div className="text-sm font-medium text-gray-900">{MEGA_MENU[activeMenu]!.promo!.title}</div>
                    <a className="inline-flex items-center gap-1 text-brand-burgundy text-sm no-underline hover:underline" href={MEGA_MENU[activeMenu]!.promo!.href}>
                      {MEGA_MENU[activeMenu]!.promo!.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                    </a>
                  </div>
                )}
                <div className="col-span-full flex items-center justify-end gap-3 pt-2">
                  <button className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm" onClick={()=>{ 
                    setMmCategories([]); 
                    setMmMetals([]); 
                    setMmPrices([]); 
                    setMmPurities([]);
                    setMmColors([]);
                    setMmEarringTypes([]);
                    setMmOccasions([]);
                    setMmStyles([]);
                    setMmBudgets([]);
                    setMmFor([]);
                  }}>Clear</button>
                  <button className="px-3 py-1.5 rounded-md bg-brand-burgundy text-white hover:opacity-90 text-sm" onClick={()=>{
                    const search = new URLSearchParams();
                    if (mmCategories.length) search.set('categories', mmCategories.join(','));
                    if (mmMetals.length) search.set('metal', mmMetals.join(','));
                    let minPrice: number | null = null;
                    let maxPrice: number | null = null;
                    if (mmPrices.length) {
                      const priceRange = mmPrices[0];
                      if (priceRange === 'under-25k') {
                        maxPrice = 25000;
                      } else if (priceRange === '25k-50k') {
                        minPrice = 25000;
                        maxPrice = 50000;
                      } else if (priceRange === '50k-100k') {
                        minPrice = 50000;
                        maxPrice = 100000;
                      } else if (priceRange === 'above-100k') {
                        minPrice = 100000;
                      }
                    }
                    if (mmBudgets.length) {
                      const budgetRange = mmBudgets[0];
                      if (budgetRange.includes('Under') || budgetRange.includes('under')) {
                        maxPrice = 10000;
                      } else if (budgetRange.includes('10,000') && budgetRange.includes('25,000')) {
                        minPrice = 10000;
                        maxPrice = 25000;
                      } else if (budgetRange.includes('25,000') && budgetRange.includes('50,000')) {
                        minPrice = 25000;
                        maxPrice = 50000;
                      } else if (budgetRange.includes('50,000') || budgetRange.includes('50000')) {
                        minPrice = 50000;
                      }
                    }
                    if (minPrice !== null) search.set('min_price', String(minPrice));
                    if (maxPrice !== null) search.set('max_price', String(maxPrice));
                    if (mmPurities.length) search.set('purity', mmPurities.join(','));
                    if (mmColors.length) search.set('color', mmColors.join(','));
                    if (mmEarringTypes.length) search.set('earringType', mmEarringTypes.join(','));
                    if (mmOccasions.length) search.set('occasion', mmOccasions.join(','));
                    if (mmStyles.length) search.set('style', mmStyles.join(','));
                    if (mmFor.length) search.set('for', mmFor.join(','));
                    navigate(`/products?${search.toString()}`);
                    setActiveMenu(null);
                  }}>Apply</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
