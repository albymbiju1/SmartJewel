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
import { default as AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { StaffDirectory } from './pages/admin/StaffDirectory';
import { StaffSchedulePage } from './pages/admin/StaffSchedulePage';
import { CustomerManagementDashboard } from './pages/admin/CustomerManagementDashboard';
import { StoreManagementPage } from './pages/admin/StoreManagementPage';
import { SalesReportPage } from './pages/admin/SalesReportPage';
import { ReportsPage } from './pages/admin/ReportsPage';
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
import { CustomerGuard } from './components/CustomerGuard';
import { WishlistPage } from './pages/products/WishlistPage';
import { CartPage } from './pages/products/CartPage';
import { CheckoutPage } from './pages/products/CheckoutPage';
import { OrderConfirmationPage } from './pages/products/OrderConfirmationPage';
import { default as OrdersMyOrdersPage } from './pages/orders/MyOrdersPage';
import { OrderDetailsPage } from './pages/products/OrderDetailsPage';
import { ProfilePage } from './pages/ProfilePage';
import EventBridge from './components/EventBridge';
import { VerifyOtp } from './pages/VerifyOtp';
import { StoreProductsPage } from './pages/store/StoreProductsPage';
import { StoreManagerDashboard } from './pages/store/StoreManagerDashboard';
import { StoreOrdersPage } from './pages/store/StoreOrdersPage';
import { StoreAppointmentsPage } from './pages/store/StoreAppointmentsPage';
import { AdvancedSearchPage } from './pages/products/AdvancedSearchPage';
import FindStorePage from './pages/FindStorePage';
import WhatsAppTestPage from './pages/WhatsAppTestPage';

export const AppRouter: React.FC = () => (
  <Router>
    {/* Bridge custom events within Router so useNavigate works */}
    <EventBridge />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<App />} />
      <Route path="/register" element={<App />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/find-store" element={<FindStorePage />} />
      <Route path="/whatsapp-test" element={<WhatsAppTestPage />} />

      {/* Admin Routes (protected) */}
      <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/inventory" element={<RequireAuth><InventoryDashboard /></RequireAuth>} />
      <Route path="/admin/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
      <Route path="/admin/orders" element={<RequireAuth><AdminOrdersPage /></RequireAuth>} />
      <Route path="/admin/staff" element={<RequireAuth><StaffDirectory /></RequireAuth>} />
      <Route path="/admin/staff/:id/schedule" element={<RequireAuth><StaffSchedulePage /></RequireAuth>} />
      <Route path="/admin/sales" element={<RequireAuth><SalesReportPage /></RequireAuth>} />
      <Route path="/admin/customers" element={<RequireAuth><CustomerManagementDashboard /></RequireAuth>} />
      {/* Removed Engagement and Logs routes as per user request */}
      <Route path="/admin/stores" element={<RequireAuth><StoreManagementPage /></RequireAuth>} />

      {/* Store Manager Routes (protected) */}
      <Route path="/store/dashboard" element={<RequireAuth><StoreManagerDashboard /></RequireAuth>} />
      <Route path="/store/products" element={<RequireAuth><StoreProductsPage /></RequireAuth>} />
      <Route path="/store/inventory" element={<RequireAuth><InventoryDashboard /></RequireAuth>} />
      <Route path="/store/orders" element={<RequireAuth><StoreOrdersPage /></RequireAuth>} />
      <Route path="/store/appointments" element={<RequireAuth><StoreAppointmentsPage /></RequireAuth>} />
      <Route path="/store/reports" element={<RequireAuth><div>Store Reports</div></RequireAuth>} />

      {/* Sales Executive Routes (protected) */}
      <Route path="/sales/pos" element={<RequireAuth><SalesDashboard /></RequireAuth>} />
      <Route path="/sales/customers" element={<RequireAuth><div>Customer Management</div></RequireAuth>} />
      <Route path="/sales/ai-assist" element={<RequireAuth><div>AI Assistant</div></RequireAuth>} />
      <Route path="/sales/cart" element={<RequireAuth><CartPage /></RequireAuth>} />

      {/* Product Routes (public for customers) */}
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/search" element={<AdvancedSearchPage />} />
      <Route path="/products/all" element={<AllJewelleryPage />} />
      <Route path="/products/gold" element={<GoldCollectionPage />} />
      <Route path="/products/diamond" element={<DiamondCollectionPage />} />
      <Route path="/products/wedding" element={<WeddingCollectionPage />} />
      <Route path="/products/collections" element={<CollectionsPage />} />
      <Route path="/products/gifting" element={<GiftingPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
      <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
      <Route path="/my-orders" element={<RequireAuth><CustomerGuard><OrdersMyOrdersPage /></CustomerGuard></RequireAuth>} />
      <Route path="/order-details/:orderId" element={<RequireAuth><CustomerGuard><OrderDetailsPage /></CustomerGuard></RequireAuth>} />

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