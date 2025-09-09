import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageSlider from '../components/ImageSlider';
import { useAuth } from '../contexts/AuthContext';
import { MENU as MEGA_MENU, NAV_TABS } from '../menuConfig';
import { getRoleBasedRedirectPath } from '../utils/roleRedirect';


export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | HTMLButtonElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdown = document.querySelector('.tq-account-dropdown');
      // If click is on the account button or inside the dropdown, ignore
      if (userMenuRef.current && userMenuRef.current.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;
      // Otherwise close menu
      setShowUserMenu(false);
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);
  
  // Redirect authenticated users to their role-based dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = getRoleBasedRedirectPath(user.role?.role_name || '');
      if (redirectPath !== '/') {
        navigate(redirectPath);
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Debug: Log to verify component is rendering
  console.log('LandingPage component rendering');
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <nav className="relative z-40 bg-white shadow-sm" role="navigation" aria-label="Primary">
        {/* Main header row */}
        <div className="container-xl relative flex items-center justify-between gap-4 py-2">
          <div className="hidden md:flex items-center gap-4">
            <button className="inline-flex items-center gap-2 text-gray-600 hover:text-brand-burgundy px-2 py-1 rounded-md" title="Find a Store">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>Find a Store</span>
            </button>
          </div>

          <div className="flex items-center">
            <img src="/logo192.png" alt="SmartJewel logo" width="192" height="192" className="h-10 md:h-12 w-auto object-contain select-none" />
          </div>

          <div className="relative flex items-center gap-2">
            {/* Quick inventory nav (visible only for admins and inventory staff) */}
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
            <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy" title="Wishlist" aria-label="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <button className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:text-brand-burgundy" title="Cart" aria-label="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>

            </button>
          </div>

          {/* Account dropdown */}
          {isAuthenticated && showUserMenu && (
            <div className="tq-account-dropdown absolute right-6 top-[52px] md:top-[66px] lg:top-[76px] w-60 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden" role="menu" aria-label="Account menu">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="font-semibold text-sm text-gray-900">{user?.full_name || user?.email}</div>
                <div className="text-xs text-gray-500">{user?.role?.role_name}</div>
              </div>
              <button className="w-full text-left bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={()=>setShowUserMenu(false)}>My Profile</button>
              <button className="w-full text-left bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50" onClick={()=>{ setShowUserMenu(false); logout(); navigate('/login', { replace: true }); }}>Sign Out</button>
            </div>
          )}
        </div>

        {/* Search bar row */}
        <div className={`${showSearch ? 'block' : 'hidden'} border-y border-gray-100 bg-white`} role="search">
          <div className="max-w-[900px] mx-auto px-6 py-2.5 flex items-center gap-3">
            <svg className="text-gray-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
            <input className="flex-1 h-10 bg-white border border-gray-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" type="text" placeholder="Search for rings, necklaces, designs and more" aria-label="Search products" />
            <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-brand-burgundy" title="Search with image" aria-label="Search with image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7h3l2-3h6l2 3h3v12H4z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span className="text-sm">Image</span>
            </button>
          </div>
          {/* Autocomplete dropdown (static sample) */}
          <div className="max-w-[900px] mx-auto px-6 pb-3" role="listbox" aria-label="Search suggestions">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Popular searches</div>
            <div className="flex gap-2 flex-wrap">
              <button role="option" className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Diamond rings</button>
              <button role="option" className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Bridal sets</button>
              <button role="option" className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Gold chains</button>
            </div>
          </div>
        </div>

        {/* Category navigation with mega menu */}
        <div className="border-b border-gray-100 bg-white sticky top-0 z-header">
          <div className="container-xl relative h-12 flex items-center" onMouseLeave={() => setActiveMenu(null)}>
            <ul className="list-none flex gap-7 items-center relative" role="menubar" aria-label="Category Navigation" onKeyDown={(e)=>{
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
                  className={`relative border-0 bg-transparent text-sm tracking-wide cursor-pointer py-2 transition-colors ${activeMenu===item.key ? 'text-brand-burgundy font-semibold' : 'text-gray-700 hover:text-brand-burgundy'}`}
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={activeMenu===item.key}
                  onMouseEnter={() => setActiveMenu(item.key)}
                  onFocus={() => setActiveMenu(item.key)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    <svg className={`transition-transform ${activeMenu===item.key ? 'rotate-180 text-brand-burgundy' : 'rotate-0 text-gray-400'}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"></path></svg>
                  </span>
                  {activeMenu===item.key && (
                    <span className="absolute left-0 -bottom-3 block h-[2px] w-full bg-brand-burgundy"></span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {/* Mega menu appears for the hovered item, with gentle motion like Tanishq */}
          {activeMenu && (
            <div className="absolute left-0 top-12 w-full max-w-[1100px] hidden md:block">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-6 p-6 bg-white border border-gray-200 rounded-xl shadow-2xl animate-[fadeSlide_.2s_ease-out]" onMouseEnter={() => setActiveMenu(activeMenu)}>
                {/* Columns */}
                {(MEGA_MENU[activeMenu!]?.columns || MEGA_MENU['all'].columns).map((col) => (
                  <div key={col.title}>
                    <div className="font-serif text-sm text-gray-900 mb-2">{col.title}</div>
                    {col.items.map((it) => (
                      <a key={it.label} href={it.href || '#'} className="block text-gray-600 text-sm my-1 no-underline hover:text-brand-burgundy cursor-pointer">{it.label}</a>
                    ))}
                  </div>
                ))}
                {/* Promo column if present */}
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
              </div>
            </div>
          )}
        </div>
      </div>
      </nav>
      
      {/* Hero Section with Image Slider */}
      <section>
        <ImageSlider />
      </section>
      
      {/* Categories Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
         {/* Section Header */}
        <div className="text-center mb-12">
          <h1 className="font-fraunces font-normal text-[40px] leading-[48px] text-black">
            Our Exclusive Collections
          </h1>
          <p className="font-fraunces font-light text-[20px] leading-[28px] text-[#56544E] mt-2">
             Discover our carefully curated selection of fine jewelry
          </p>
         </div>


          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {/* Earrings */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=earrings')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/earrings-cat.webp"
                  alt="Earrings"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Earrings</h3>
            </div>

            {/* Finger Rings */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=rings')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/rings-cat.jpg"
                  alt="Finger Rings"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Finger Rings</h3>
            </div>

            {/* Pendants */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=pendants')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/pendants-cat.webp"
                  alt="Pendants"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Pendants</h3>
            </div>

            {/* Mangalsutra */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=mangalsutra')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/mangalsutra-cat.jpg"
                  alt="Mangalsutra"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Mangalsutra</h3>
            </div>

            {/* Bracelets */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=bracelets')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/bracelets-cat.webp"
                  alt="Bracelets"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Bracelets</h3>
            </div>

            {/* Bangles */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=bangles')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/bangles-cat.jpg"
                  alt="Bangles"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Bangles</h3>
            </div>

            {/* Chains */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=chains')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75 transition-opacity">
                <img
                  src="/chains-cat.webp"
                  alt="Chains"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">Chains</h3>
            </div>

            {/* View All */}
            <div className="group cursor-pointer" onClick={() => navigate('/products')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-dashed border-amber-300 group-hover:border-amber-400 transition-colors flex items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="mt-2 block font-fraunces font-medium text-[14px] leading-[18px] text-amber-700">View All</span>
                </div>
              </div>
              <h3 className="mt-4 font-fraunces font-bold text-[18px] leading-[24px] text-black text-center">View All</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Now Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-fraunces font-normal text-[40px] leading-[48px] text-black mb-2">Trending Now</h2>
            <p className="font-fraunces font-light text-[20px] leading-[28px] text-[#56544E] max-w-2xl mx-auto">
              Discover our most sought-after pieces that are capturing hearts and setting trends.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Product 1 */}
            <div className="group cursor-pointer" onClick={() => navigate('/products?category=pendants')}>
              <div className="aspect-square overflow-hidden rounded-lg bg-white group-hover:shadow-lg transition-shadow">
                <img
                  src="/auspicious-trending.jpg"
                  alt="Traditional Gold Pendant"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <h3 className="mt-4 font-fraunces font-medium text-[16px] leading-[20px] text-black">Traditional Gold Pendant</h3>
              <p className="mt-1 font-fraunces font-light text-[14px] leading-[18px] text-[#56544E]">Heritage Collection</p>
              <p className="mt-1 font-fraunces font-medium text-[18px] leading-[22px] text-black">₹78,500</p>
            </div>
          </div>

          <div className="text-center mt-10">
            <button 
              onClick={() => navigate('/products')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200"
            >
              View All Products
              <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 mt-16">
        <div className="container-xl py-12 grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl w-8 h-8 flex items-center justify-center text-white"
                   style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}></div>
              <h3 className="text-xl font-bold font-serif text-white">SmartJewel</h3>
            </div>
            <p className="text-gray-400 leading-7 max-w-xs">
              Crafting extraordinary jewelry experiences since 1948. Where heritage meets innovation,
              and every piece tells a story of timeless elegance.
            </p>
            <div className="mt-6 flex gap-4 text-[color:var(--brand-gold)] text-sm">
              <div>
                <strong>Visit Our Showroom</strong><br />
                <span className="text-gray-400">123 Pala, Kottayam</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-white mb-4 font-serif">Collections</h3>
            <ul className="list-none p-0">
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Bridal Collection</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Diamond Classics</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Gold Heritage</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Precious Gems</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white mb-4 font-serif">Services</h3>
            <ul className="list-none p-0">
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Bespoke Design</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Jewelry Appraisal</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Repair & Restoration</a></li>
              <li className="mb-2"><a className="text-gray-300 no-underline transition-colors hover:text-white" href="#">Concierge Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 py-4">
          <p className="text-gray-400 text-center">
            &copy; {new Date().getFullYear()} SmartJewel. All rights reserved. |
            <span className="text-[color:var(--brand-gold)] ml-2">Crafted with Excellence</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
