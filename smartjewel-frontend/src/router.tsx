import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { App } from './pages/App';
import { LandingPage } from './pages/LandingPage';
import { Logout } from './pages/Logout';
import { ItemsPage } from './pages/inventory/ItemsPage';
import { StockPage } from './pages/inventory/StockPage';
import { TagsPage } from './pages/inventory/TagsPage';
import { LocationsPage } from './pages/inventory/LocationsPage';
import { PricesPage } from './pages/inventory/PricesPage';
import { ValuationPage } from './pages/inventory/ValuationPage';
import { BomPage } from './pages/inventory/BomPage';
import { InventoryDashboard } from './pages/inventory/InventoryDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StaffDirectory } from './pages/admin/StaffDirectory';
import { StaffSchedulePage } from './pages/admin/StaffSchedulePage';
import { CustomerManagementDashboard } from './pages/admin/CustomerManagementDashboard';
import { SalesDashboard } from './pages/sales/SalesDashboard';
import { ProductsPage } from './pages/products/ProductsPage';
import { AllJewelleryPage } from './pages/products/AllJewelleryPage';
import { GoldCollectionPage } from './pages/products/GoldCollectionPage';
import { DiamondCollectionPage } from './pages/products/DiamondCollectionPage';
import { WeddingCollectionPage } from './pages/products/WeddingCollectionPage';
import { CollectionsPage } from './pages/products/CollectionsPage';
import { GiftingPage } from './pages/products/GiftingPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { RequireAuth } from './components/AuthGuard';
import { WishlistPage } from './pages/products/WishlistPage';
import { CartPage } from './pages/products/CartPage';
import { CheckoutPage } from './pages/products/CheckoutPage';
import { OrderConfirmationPage } from './pages/products/OrderConfirmationPage';
import { ProfilePage } from './pages/ProfilePage';
import EventBridge from './components/EventBridge';

export const AppRouter: React.FC = () => (
  <Router>
    {/* Bridge custom events within Router so useNavigate works */}
    <EventBridge />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<App />} />
      <Route path="/register" element={<App />} />
      <Route path="/logout" element={<Logout />} />

      {/* Admin Routes (protected) */}
      <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/inventory" element={<RequireAuth><InventoryDashboard /></RequireAuth>} />
      <Route path="/admin/reports" element={<RequireAuth><div>Admin Reports</div></RequireAuth>} />
      <Route path="/admin/staff" element={<RequireAuth><StaffDirectory /></RequireAuth>} />
      <Route path="/admin/staff/:id/schedule" element={<RequireAuth><StaffSchedulePage /></RequireAuth>} />
      <Route path="/admin/sales" element={<RequireAuth><div>Sales Overview</div></RequireAuth>} />
      <Route path="/admin/customers" element={<RequireAuth><CustomerManagementDashboard /></RequireAuth>} />
      <Route path="/admin/engagement" element={<RequireAuth><div>Customer Engagement</div></RequireAuth>} />
      <Route path="/admin/logs" element={<RequireAuth><div>System Logs</div></RequireAuth>} />

      {/* Store Manager Routes (protected) */}
      <Route path="/store/products" element={<RequireAuth><div>Store Products</div></RequireAuth>} />
      <Route path="/store/inventory" element={<RequireAuth><InventoryDashboard /></RequireAuth>} />
      <Route path="/store/reports" element={<RequireAuth><div>Store Reports</div></RequireAuth>} />
      <Route path="/store/staff" element={<RequireAuth><div>Store Staff</div></RequireAuth>} />
      <Route path="/store/add" element={<RequireAuth><div>Add Products</div></RequireAuth>} />
      <Route path="/store/edit" element={<RequireAuth><div>Edit Products</div></RequireAuth>} />
      <Route path="/store/approve-discounts" element={<RequireAuth><div>Approve Discounts</div></RequireAuth>} />

      {/* Sales Executive Routes (protected) */}
      <Route path="/sales/pos" element={<RequireAuth><SalesDashboard /></RequireAuth>} />
      <Route path="/sales/customers" element={<RequireAuth><div>Customer Management</div></RequireAuth>} />
      <Route path="/sales/ai-assist" element={<RequireAuth><div>AI Assistant</div></RequireAuth>} />
      <Route path="/sales/cart" element={<RequireAuth><CartPage /></RequireAuth>} />

      {/* Product Routes (public for customers) */}
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/products/all" element={<AllJewelleryPage />} />
      <Route path="/products/gold" element={<GoldCollectionPage />} />
      <Route path="/products/diamond" element={<DiamondCollectionPage />} />
      <Route path="/products/wedding" element={<WeddingCollectionPage />} />
      <Route path="/products/collections" element={<CollectionsPage />} />
      <Route path="/products/gifting" element={<GiftingPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/order-confirmation" element={<OrderConfirmationPage />} />

      {/* Profile (protected) */}
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />

      {/* Inventory Routes (protected) */}
      <Route path="/inventory/dashboard" element={<RequireAuth><InventoryDashboard /></RequireAuth>} />
      <Route path="/inventory/items" element={<RequireAuth><ItemsPage /></RequireAuth>} />
      <Route path="/inventory/stock" element={<RequireAuth><StockPage /></RequireAuth>} />
      <Route path="/inventory/tags" element={<RequireAuth><TagsPage /></RequireAuth>} />
      <Route path="/inventory/locations" element={<RequireAuth><LocationsPage /></RequireAuth>} />
      <Route path="/inventory/prices" element={<RequireAuth><PricesPage /></RequireAuth>} />
      <Route path="/inventory/valuation" element={<RequireAuth><ValuationPage /></RequireAuth>} />
      <Route path="/inventory/bom" element={<RequireAuth><BomPage /></RequireAuth>} />
      <Route path="/inventory/reports" element={<RequireAuth><div>Inventory Reports</div></RequireAuth>} />
    </Routes>
  </Router>
);
