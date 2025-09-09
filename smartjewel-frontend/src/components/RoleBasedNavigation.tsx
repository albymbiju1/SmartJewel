import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNavigationForRole, NavItem } from '../config/roleNavigation';

interface RoleBasedNavigationProps {
  children: React.ReactNode;
}

export const RoleBasedNavigation: React.FC<RoleBasedNavigationProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLButtonElement>(null);

  const navigation = user ? getNavigationForRole(user.role?.role_name || '') : null;

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdown = document.querySelector('.user-dropdown');
      if (userMenuRef.current && userMenuRef.current.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;
      setShowUserMenu(false);
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  if (!isAuthenticated || !user || !navigation) {
    return <>{children}</>;
  }

  const handleNavClick = (item: NavItem) => {
    if (item.href) {
      navigate(item.href);
    }
    setActiveDropdown(null);
  };

  const isActiveRoute = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md border-b-2 border-gray-100">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center h-20">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <img
                    className="h-12 w-auto"
                    src="/logo192.png"
                    alt="SmartJewel"
                  />
                </div>
              </div>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  {user.role?.role_name === 'Admin' ? 'Admin' : 
                   user.role?.role_name === 'Staff_L1' ? 'Store Manager (Staff Type 1)' :
                   user.role?.role_name === 'Staff_L2' ? 'Sales Executive (Staff Type 2)' :
                   user.role?.role_name === 'Staff_L3' ? 'Inventory Staff (Staff Type 3)' : 
                   'Dashboard'}
                </h1>
              </div>
            </div>

            {/* Main Navigation Tabs */}
            <div className="flex space-x-6">
              {navigation.mainTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleNavClick(tab)}
                  className={`px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                    isActiveRoute(tab.href)
                      ? 'text-white bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg transform scale-105'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-md'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                ref={userMenuRef}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-2 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-500">{user.role?.role_name}</div>
                </div>
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="user-dropdown absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="font-semibold text-gray-900">
                      {user.full_name || user.email}
                    </div>
                    <div className="text-sm text-gray-500">{user.role?.role_name}</div>
                  </div>
                  <div className="py-1">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>My Profile</span>
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Settings</span>
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Left Sidebar (for items like Add, Edit, Approve Discounts) */}
        {navigation.leftSidebarItems && navigation.leftSidebarItems.length > 0 && (
          <div className="w-72 bg-white shadow-lg border-r border-gray-200">
            <div className="h-full py-6">
              <div className="px-4 mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
              </div>
              <nav className="space-y-2 px-4">
                {navigation.leftSidebarItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleNavClick(item)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-3 ${
                      isActiveRoute(item.href)
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600 shadow-md'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      isActiveRoute(item.href) ? 'bg-blue-600' : 'bg-gray-400'
                    }`}></div>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Main Content */}
          <main className="flex-1 p-8 bg-gray-50">
            {children}
          </main>

          {/* Right Sidebar (for navigation items like Items, Stock, etc.) */}
          {navigation.sidebarItems && navigation.sidebarItems.length > 0 && (
            <div className="w-72 bg-white shadow-lg border-l border-gray-200">
              <div className="h-full py-6">
                <div className="px-4 mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigation</h3>
                </div>
                <nav className="space-y-2 px-4">
                  {navigation.sidebarItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item)}
                      className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-3 ${
                        isActiveRoute(item.href)
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600 shadow-md'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        isActiveRoute(item.href) ? 'bg-blue-600' : 'bg-gray-400'
                      }`}></div>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
