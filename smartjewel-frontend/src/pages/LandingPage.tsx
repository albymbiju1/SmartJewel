import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ImageSlider from '../components/ImageSlider';
import { useAuth } from '../contexts/AuthContext';

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
      {/* Tanishq-like Header */}
      <nav className="tq-header" role="navigation" aria-label="Primary">
        {/* Main header row */}
        <div className="tq-header-row">
          <div className="tq-left-actions">
            <button className="tq-link-btn" title="Find a Store">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>Find a Store</span>
            </button>
          </div>

          <div className="tq-logo">
            <img src="/logo192.png" alt="SmartJewel" />
          </div>

          <div className="tq-right-actions">
            <button className="tq-icon-btn" title="Search" aria-label="Search" onClick={()=>{const el=document.querySelector('.tq-search'); if(el) el.classList.toggle('open')}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
            </button>
            <button className="tq-icon-btn" title={isAuthenticated ? (user?.full_name || user?.email || 'Account'): 'Account'} onClick={()=>{ isAuthenticated ? setShowUserMenu(!showUserMenu) : navigate('/login')}} aria-label="Account" ref={userMenuRef as React.RefObject<HTMLButtonElement>} >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <button className="tq-icon-btn" title="Wishlist" aria-label="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <button className="tq-icon-btn tq-cart" title="Cart" aria-label="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span className="cart-count">0</span>
            </button>
          </div>

          {/* Account dropdown */}
          {isAuthenticated && showUserMenu && (
            <div className="tq-account-dropdown" role="menu" aria-label="Account menu">
              <div className="tq-account-header">
                <div className="tq-account-name">{user?.full_name || user?.email}</div>
                <div className="tq-account-role">{user?.role?.role_name}</div>
              </div>
              <button className="tq-account-item" onClick={()=>setShowUserMenu(false)}>My Profile</button>
              <button className="tq-account-item danger" onClick={()=>{ setShowUserMenu(false); logout(); navigate('/login'); }}>Sign Out</button>
            </div>
          )}
        </div>

        {/* Search bar row */}
        <div className="tq-search" role="search">
          <div className="tq-search-inner">
            <svg className="tq-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
            <input className="tq-search-input" type="text" placeholder="Search for rings, necklaces, designs and more" aria-label="Search products" />
            <button className="tq-search-camera" title="Search with image" aria-label="Search with image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7h3l2-3h6l2 3h3v12H4z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span className="tq-search-camera-text">Image</span>
            </button>
          </div>
          {/* Autocomplete dropdown (static sample) */}
          <div className="tq-search-suggest" role="listbox" aria-label="Search suggestions">
            <div className="tq-suggest-title">Popular searches</div>
            <button role="option" className="tq-suggest-item">Diamond rings</button>
            <button role="option" className="tq-suggest-item">Bridal sets</button>
            <button role="option" className="tq-suggest-item">Gold chains</button>
          </div>
        </div>

        {/* Category navigation with mega menu */}
        <div className="tq-nav">
          <ul className="tq-nav-list" role="menubar">
            {[
              {label:'All Jewellery', key:'all'},
              {label:'Gold', key:'gold'},
              {label:'Diamond', key:'diamond'},
              {label:'Wedding', key:'wedding'},
              {label:'Dailywear', key:'daily'},
              {label:'Collections', key:'collections'},
              {label:'Gifting', key:'gifting'}
            ].map((item)=> (
              <li key={item.key} className="tq-nav-item" role="none">
                <button className="tq-nav-link" role="menuitem" aria-haspopup="true" aria-expanded="false">
                  {item.label}
                </button>
                <div className="tq-mega">
                  <div className="tq-mega-col">
                    <div className="tq-mega-title">Category</div>
                    <a className="tq-mega-link">Earrings</a>
                    <a className="tq-mega-link">Rings</a>
                    <a className="tq-mega-link">Necklaces</a>
                    <a className="tq-mega-link">Bracelets</a>
                  </div>
                  <div className="tq-mega-col">
                    <div className="tq-mega-title">Shop by Price</div>
                    <a className="tq-mega-link">Under ₹25,000</a>
                    <a className="tq-mega-link">₹25,000 - ₹50,000</a>
                    <a className="tq-mega-link">₹50,000 - ₹1,00,000</a>
                    <a className="tq-mega-link">₹1,00,000 & above</a>
                  </div>
                  <div className="tq-mega-col">
                    <div className="tq-mega-title">Occasion</div>
                    <a className="tq-mega-link">Everyday</a>
                    <a className="tq-mega-link">Office</a>
                    <a className="tq-mega-link">Festive</a>
                    <a className="tq-mega-link">Wedding</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      
      {/* Hero Section with Image Slider */}
      <div className="hero-section">
        <ImageSlider />
      </div>
      
      {/* Welcome Section */}
      <div className="section">
        <div className="container text-center">
          <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", color: '#1f2937' }}>
            Where Timeless Elegance Meets Modern Luxury
          </h2>
          <p className="section-subtitle" style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.8', color: '#6b7280' }}>
            For over three generations, SmartJewel has been the epitome of fine jewelry craftsmanship.
            Each piece in our collection tells a story of passion, precision, and unparalleled artistry,
            designed to celebrate life's most precious moments with extraordinary beauty.
          </p>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', fontFamily: "'Playfair Display', serif" }}>75+</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Years of Heritage</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', fontFamily: "'Playfair Display', serif" }}>10,000+</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Satisfied Clients</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', fontFamily: "'Playfair Display', serif" }}>500+</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Exclusive Designs</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Luxury Services Section */}
      <div className="section bg-gray-50">
        <div className="container">
          <div className="text-center" style={{ marginBottom: '4rem' }}>
            <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", color: '#1f2937' }}>
              The SmartJewel Experience
            </h2>
            <p className="section-subtitle" style={{ maxWidth: '600px', margin: '0 auto', color: '#6b7280' }}>
              Discover the exceptional services that make every moment with us truly extraordinary.
              From bespoke design to lifetime care, we ensure your jewelry journey is nothing short of perfection.
            </p>
          </div>
          <div className="grid-4">
            {luxuryServices.map((service, index) => (
              <div key={index} className="feature-card" style={{
                transition: 'all 0.3s ease',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '2rem',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div className="feature-icon" style={{
                  marginBottom: '1.5rem',
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  borderRadius: '12px',
                  width: '4rem',
                  height: '4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <div style={{ width: '2rem', height: '2rem' }}>
                    {service.icon}
                  </div>
                </div>
                <h3 className="feature-title" style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '1rem'
                }}>
                  {service.title}
                </h3>
                <p className="feature-desc" style={{
                  color: '#6b7280',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                  flex: '1'
                }}>
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <div className="flex" style={{ alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="logo-icon" style={{
                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                color: 'white',
                fontSize: '1.5rem'
              }}>💎</div>
              <h3 className="text-xl font-bold" style={{
                fontFamily: "'Playfair Display', serif",
                color: 'white'
              }}>SmartJewel</h3>
            </div>
            <p style={{ color: '#9ca3af', lineHeight: '1.6', maxWidth: '300px' }}>
              Crafting extraordinary jewelry experiences since 1948. Where heritage meets innovation,
              and every piece tells a story of timeless elegance.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <div style={{ color: '#d97706', fontSize: '0.875rem' }}>
                <strong>Visit Our Showroom</strong><br />
                <span style={{ color: '#9ca3af' }}>123 Luxury Lane, Diamond District</span>
              </div>
            </div>
          </div>
          <div className="footer-section">
            <h3 style={{ color: 'white', marginBottom: '1rem', fontFamily: "'Playfair Display', serif" }}>Collections</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Bridal Collection</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Diamond Classics</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Gold Heritage</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Precious Gems</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h3 style={{ color: 'white', marginBottom: '1rem', fontFamily: "'Playfair Display', serif" }}>Services</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Bespoke Design</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Jewelry Appraisal</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Repair & Restoration</a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.2s' }}>Concierge Service</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom" style={{ borderTop: '1px solid #374151', paddingTop: '1rem' }}>
          <p style={{ color: '#9ca3af', textAlign: 'center' }}>
            &copy; {new Date().getFullYear()} SmartJewel. All rights reserved. |
            <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>Crafted with Excellence</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
