import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const CustomerGuard: React.FC<{ children: React.ReactElement }>
  = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  const isCustomer = user?.role?.role_name === 'Customer';
  if (!isCustomer) return <Navigate to="/" replace />;

  return children;
};
