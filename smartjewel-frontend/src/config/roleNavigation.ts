export interface NavItem {
  label: string;
  key: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
}

export interface RoleNavigation {
  mainTabs: NavItem[];
  sidebarItems: NavItem[];
  leftSidebarItems?: NavItem[];
}

// Define role mappings based on backend role names
export const ROLE_MAPPINGS = {
  Admin: 'admin',
  'Staff_L1': 'store_manager', // Store Manager (Staff Type 1)  
  'Staff_L2': 'sales_executive', // Sales Executive (Staff Type 2)
  'Staff_L3': 'inventory_staff', // Inventory Staff (Staff Type 3)
} as const;

export const ROLE_NAVIGATION: Record<string, RoleNavigation> = {
  // Admin Navigation
  admin: {
    mainTabs: [
      { label: 'Dashboard', key: 'dashboard', href: '/admin/dashboard' },
      { label: 'Inventory', key: 'inventory', href: '/admin/inventory' },
      { label: 'Reports', key: 'reports', href: '/admin/reports' },
      { label: 'Staff', key: 'staff', href: '/admin/staff' },
    ],
    sidebarItems: [
      { label: 'Sales', key: 'sales', href: '/admin/sales' },
      { label: 'Inventory', key: 'inventory_details', href: '/admin/inventory' },
      { label: 'Customers', key: 'customers', href: '/admin/customers' },
      { label: 'Engagement', key: 'engagement', href: '/admin/engagement' },
      { label: 'Logs', key: 'logs', href: '/admin/logs' },
    ],
    leftSidebarItems: [
      { label: 'Items (CRUD)', key: 'items', href: '/inventory/items' },
      { label: 'Stock', key: 'stock', href: '/inventory/stock' },
      { label: 'Tags', key: 'tags', href: '/inventory/tags' },
      { label: 'Stores', key: 'stores', href: '/admin/stores' },
      { label: 'View Orders', key: 'view_orders', href: '/admin/orders' },
    ]
  },

  // Store Manager (Staff Type 1) Navigation
  store_manager: {
    mainTabs: [
      { label: 'Products', key: 'products', href: '/store/products' },
      { label: 'Inventory', key: 'inventory', href: '/store/inventory' },
      { label: 'Reports', key: 'reports', href: '/store/reports' },
      { label: 'Staff', key: 'staff', href: '/store/staff' },
    ],
    sidebarItems: [
      { label: 'Tags', key: 'tags', href: '/inventory/tags' },
      { label: 'BOM', key: 'bom', href: '/inventory/bom' },
      { label: 'Valuation', key: 'valuation', href: '/inventory/valuation' },
    ],
    leftSidebarItems: [
      { label: 'Add', key: 'add', href: '/store/add' },
      { label: 'Edit', key: 'edit', href: '/store/edit' },
      { label: 'Approve Discounts', key: 'approve_discounts', href: '/store/approve-discounts' },
    ]
  },

  // Sales Executive (Staff Type 2) Navigation  
  sales_executive: {
    mainTabs: [
      { label: 'POS / Billing', key: 'pos', href: '/sales/pos' },
      { label: 'Customers', key: 'customers', href: '/sales/customers' },
      { label: 'AI Assist', key: 'ai_assist', href: '/sales/ai-assist' },
      { label: 'Cart', key: 'cart', href: '/sales/cart' },
    ],
    sidebarItems: [
      { label: 'All Jewellery', key: 'all_jewellery', href: '/products/all' },
      { label: 'Gold', key: 'gold', href: '/products/gold' },
      { label: 'Diamond', key: 'diamond', href: '/products/diamond' },
      { label: 'Wedding', key: 'wedding', href: '/products/wedding' },
      { label: 'Collections', key: 'collections', href: '/products/collections' },
      { label: 'Gifting', key: 'gifting', href: '/products/gifting' },
    ],
    leftSidebarItems: []
  },

  // Inventory Staff (Staff Type 3) Navigation
  inventory_staff: {
    mainTabs: [
      { label: 'Inventory', key: 'inventory', href: '/inventory/dashboard' },
      { label: 'Reports', key: 'reports', href: '/inventory/reports' },
    ],
    sidebarItems: [
      { label: 'Items', key: 'items', href: '/inventory/items' },
      { label: 'Stock Movements', key: 'stock_movements', href: '/inventory/stock' },
      { label: 'Tags (RFID/Barcode)', key: 'tags', href: '/inventory/tags' },
      { label: 'Locations', key: 'locations', href: '/inventory/locations' },
      { label: 'Valuation', key: 'valuation', href: '/inventory/valuation' },
      { label: 'BOM', key: 'bom', href: '/inventory/bom' },
    ],
    leftSidebarItems: []
  },
};

export const getNavigationForRole = (roleName: string): RoleNavigation => {
  const mappedRole = ROLE_MAPPINGS[roleName as keyof typeof ROLE_MAPPINGS];
  return ROLE_NAVIGATION[mappedRole] || ROLE_NAVIGATION.store_manager; // Default fallback
};
