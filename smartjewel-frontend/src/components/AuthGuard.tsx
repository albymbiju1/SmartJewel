import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const RequireAuth: React.FC<{ children: React.ReactElement }>
  = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Check if the route is an inventory route
  const isInventoryRoute = location.pathname.startsWith('/inventory');

  // Check if user has permission to access inventory routes
  const hasInventoryAccess = 
    user?.role?.role_name === 'Admin' || 
    user?.role?.role_name === 'Staff_L3' ||
    user?.perms?.some(perm => perm.startsWith('inventory.')) ||
    user?.permissions?.some(perm => perm.startsWith('inventory.'));

  if (isLoading) return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  
  // If trying to access inventory route without permission, redirect to home
  if (isInventoryRoute && !hasInventoryAccess) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};