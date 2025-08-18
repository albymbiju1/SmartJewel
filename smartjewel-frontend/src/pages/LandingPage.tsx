import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ImageSlider from '../components/ImageSlider';
import { useAuth } from '../contexts/AuthContext';

const features = [
  { title: 'Inventory Management', desc: 'Track, add, and manage all your jewellery items with categories, barcodes, and real-time stock.' },
  { title: 'Sales & Billing', desc: 'Easy billing, GST calculation, and sales history for customers and staff.' },
  { title: 'AI Recommendations', desc: 'Personalized product suggestions for customers based on their preferences and history.' },
  { title: 'Virtual Try-On', desc: 'Let customers try jewellery virtually using uploaded images.' },
  { title: 'Visual Search', desc: 'Find similar jewellery by uploading a photo.' },
  { title: 'Sales Forecast', desc: 'Predict future sales for inventory planning.' },
  { title: 'Role-Based Access', desc: 'Admin, staff, and customer roles with fine-grained permissions.' },
  { title: 'System Logs', desc: 'Track all important actions for security and auditing.' }
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
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
      {/* Main Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          {/* Logo Section */}
          <div className="logo">
            <img src="/logo192.png" alt="SmartJewel" className="logo-image" />
          </div>
            
          {/* Search Bar */}
          <div className="search-section">
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search for Gold Jewellery, Diamond Jewellery and more..." 
                className="search-input"
              />
              <div className="search-actions">
                <button className="voice-search-btn" title="Voice Search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
                <div className="search-divider"></div>
                <button className="search-btn" title="Search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
            
          {/* Right Section */}
          <div className="nav-actions">
            <div className="nav-icon" title="Store Locator">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div className="nav-icon" title="Try At Home">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9,22 9,12 15,12 15,22"></polyline>
              </svg>
            </div>
            <div className="nav-icon" title="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
            <div 
              ref={userMenuRef}
              className="nav-icon" 
              title={isAuthenticated ? user?.full_name || user?.email : "Account"}
              onClick={() => {
                if (isAuthenticated) {
                  setShowUserMenu(!showUserMenu);
                } else {
                  navigate('/login');
                }
              }}
              style={{ position: 'relative' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {isAuthenticated && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  border: '2px solid white'
                }}></div>
              )}
              
              {/* User Menu Dropdown */}
              {isAuthenticated && showUserMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  marginTop: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  minWidth: '200px',
                  zIndex: 1000
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      {user?.full_name || user?.email}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {user?.role?.role_name}
                    </div>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // Navigate to profile/dashboard
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#dc2626'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="nav-icon cart-icon" title="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span className="cart-count">0</span>
            </div>
          </div>
        </div>

        {/* Category Navigation */}
        <div className="category-nav">
          <div className="category-container">
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
              </svg>
              <span>All Jewellery</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              <span>Gold</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
              <span>Diamond</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              <span>Earrings</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
              <span>Rings</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
                <path d="M8 12h8"></path>
              </svg>
              <span>Daily Wear</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Collections</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              <span>Wedding</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
              <span>Gifting</span>
            </div>
            <div className="category-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>More</span>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Hero Section with Image Slider */}
      <div className="hero-section">
        <ImageSlider />
      </div>
      
      {/* Welcome Section */}
      <div className="section">
        <div className="container text-center">
          <h2 className="section-title">Welcome to SmartJewel</h2>
          <p className="section-subtitle">Your premier destination for exquisite jewelry</p>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="section bg-gray-50">
        <div className="container">
          <h2 className="section-title">Our Features</h2>
          <div className="grid-4">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">💎</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
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
              <div className="logo-icon">👑</div>
              <h3 className="text-xl font-bold">SmartJewel</h3>
            </div>
            <p style={{ color: '#9ca3af' }}>
              Empowering jewelry businesses with smart technology
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} SmartJewel. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
