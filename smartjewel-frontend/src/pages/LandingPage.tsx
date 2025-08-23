import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageSlider from '../components/ImageSlider';
import { useAuth } from '../contexts/AuthContext';
import { MENU as MEGA_MENU, NAV_TABS } from '../menuConfig';

const luxuryServices = [
  {
    title: 'Bespoke Craftsmanship',
    desc: 'Experience the artistry of custom jewelry design, where each piece is meticulously crafted to reflect your unique vision and style.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    )
  },
  {
    title: 'Heritage Collections',
    desc: 'Discover timeless pieces that celebrate generations of jewelry-making excellence, featuring rare gemstones and precious metals.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    )
  },
  {
    title: 'Personal Consultation',
    desc: 'Receive expert guidance from our master jewelers who understand the significance of every precious moment in your life.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
      </svg>
    )
  },
  {
    title: 'Lifetime Guarantee',
    desc: 'Every piece comes with our commitment to excellence, ensuring your treasured jewelry maintains its brilliance for generations.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    )
  },
  {
    title: 'Virtual Showcase',
    desc: 'Experience our collections from the comfort of your home with immersive virtual viewing and personalized styling sessions.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  },
  {
    title: 'Exclusive Events',
    desc: 'Join our private collection previews and trunk shows, where you can discover limited-edition pieces before anyone else.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    )
  },
  {
    title: 'Concierge Service',
    desc: 'Enjoy white-glove service with personal shopping assistance, home delivery, and priority access to our finest pieces.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m8.25 4.5V16.5a1.5 1.5 0 0 1 3 0v1.75m-3-1.75a1.5 1.5 0 0 0 3 0m-3 0h-3m-2.25-4.5h16.5a1.125 1.125 0 0 1 1.125 1.125v2.5c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 0 1 2.25 14.75v-2.5c0-.621.504-1.125 1.125-1.125Z" />
        <path d="M5.25 9.75V8.25a6.75 6.75 0 0 1 13.5 0v1.5" />
      </svg>
    )
  },
  {
    title: 'Investment Advisory',
    desc: 'Make informed decisions with our expertise in precious metals and gemstone markets, ensuring your jewelry appreciates in value.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H4.5m-1.5 0H21m0 0h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.125a9 9 0 0 0-9-9V3.375c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
      </svg>
    )
  }
];

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
      
      {/* Welcome Section */}
      <section className="py-16">
        <div className="container-xl text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-gray-800">Where Timeless Elegance Meets Modern Luxury</h2>
          <p className="max-w-3xl mx-auto leading-8 text-gray-500 mt-3">
            For over three generations, SmartJewel has been the epitome of fine jewelry craftsmanship.
            Each piece in our collection tells a story of passion, precision, and unparalleled artistry,
            designed to celebrate life's most precious moments with extraordinary beauty.
          </p>
          <div className="mt-8 flex justify-center gap-12 flex-wrap">
            <div className="text-center">
              <div className="text-3xl font-bold text-[color:var(--brand-gold)] font-serif">75+</div>
              <div className="text-sm text-gray-500 uppercase tracking-widest">Years of Heritage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[color:var(--brand-gold)] font-serif">10,000+</div>
              <div className="text-sm text-gray-500 uppercase tracking-widest">Satisfied Clients</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[color:var(--brand-gold)] font-serif">500+</div>
              <div className="text-sm text-gray-500 uppercase tracking-widest">Exclusive Designs</div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Luxury Services Section */}
      <section className="py-16 bg-gray-50">
        <div className="container-xl">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl text-gray-800">The SmartJewel Experience</h2>
            <p className="max-w-xl mx-auto text-gray-500 mt-3">
              Discover the exceptional services that make every moment with us truly extraordinary.
              From bespoke design to lifetime care, we ensure your jewelry journey is nothing short of perfection.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {luxuryServices.map((service, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-8 h-full flex flex-col transition shadow-sm hover:shadow-lg">
                <div className="mb-6 rounded-xl w-16 h-16 flex items-center justify-center text-white"
                     style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                  <div className="w-8 h-8">{service.icon}</div>
                </div>
                <h3 className="font-serif text-xl font-semibold text-gray-800 mb-4">{service.title}</h3>
                <p className="text-gray-500 leading-7 text-[0.95rem] flex-1">{service.desc}</p>
              </div>
            ))}
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
