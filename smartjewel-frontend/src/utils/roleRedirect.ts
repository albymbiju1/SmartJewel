import { ROLE_MAPPINGS } from '../config/roleNavigation';

export const getRoleBasedRedirectPath = (roleName: string): string => {
  const mappedRole = ROLE_MAPPINGS[roleName as keyof typeof ROLE_MAPPINGS];
  
  switch (mappedRole) {
    case 'admin':
      return '/admin/dashboard';
    case 'store_manager':
      return '/store/products'; 
    case 'sales_executive':
      return '/sales/pos';
    case 'inventory_staff':
      return '/inventory/dashboard';
    default:
      return '/'; // Fallback to landing page
  }
};
