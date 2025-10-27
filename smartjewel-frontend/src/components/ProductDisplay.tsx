import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, API_BASE_URL } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickViewModal } from './QuickViewModal';
import { MegaMenuFilter } from './MegaMenuFilter';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { stockService, ProductWithStock } from '../services/stockService';
import { catalogService } from '../services/catalogService';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flyToCart } from '../utils/flyToCart';
import { Filter as LucideFilter, Heart as HeartIcon, LayoutGrid, List as ListIcon, SlidersHorizontal, ShoppingCart as CartIcon } from 'lucide-react';

interface Product {
  _id: string;
  sku: string;
  name: string;
  category: string;
  metal: string;
  purity: string;
  weight?: number;
  weight_unit: string;
  price?: number;
  description?: string;
  image?: string;
  status: string;
  quantity?: number;
  createdAt?: string;
  isBestseller?: boolean;
}

interface ProductDisplayProps {
  category?: string;
  title: string;
  description?: string;
}

export const ProductDisplay: React.FC<ProductDisplayProps> = ({ 
  category, 
  title, 
  description = "Discover our exquisite collection of handcrafted jewelry" 
}) => {
  // Access wishlist state to render hearts accurately
  const { isWishlisted } = useWishlist();
  // Access cart context for Buy Now functionality
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<ProductWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetals, setSelectedMetals] = useState<string[]>((searchParams.get('metal') || '').split(',').filter(Boolean));
  const [priceRanges, setPriceRanges] = useState<string[]>((searchParams.get('price') || '').split(',').filter(Boolean));
  const [selectedPurities, setSelectedPurities] = useState<string[]>((searchParams.get('purity') || '').split(',').filter(Boolean).map(p => p.toUpperCase()));
  const urlCategories = useMemo(() => (searchParams.get('categories') || '').split(',').filter(Boolean), [searchParams]);
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sort') || 'popularity');
  const [viewMode, setViewMode] = useState<'grid'|'list'>(searchParams.get('view') === 'list' ? 'list' : 'grid');
  const [page, setPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10));
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product|null>(null);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const productGridRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [density, setDensity] = useState<'normal'|'dense'>('normal');

  // Scroll to top detector
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top when page changes
  useEffect(() => {
    scrollToTop();
  }, [page]);

  useEffect(() => {
    // Keep local state synced if URL params change
    setSelectedMetals((searchParams.get('metal') || '').split(',').filter(Boolean));
    setPriceRanges((searchParams.get('price') || '').split(',').filter(Boolean));
    setSelectedPurities((searchParams.get('purity') || '').split(',').filter(Boolean).map(p => p.toUpperCase()));
    // colour removed
    setSortBy(searchParams.get('sort') || 'popularity');
    setViewMode(searchParams.get('view') === 'list' ? 'list' : 'grid');
    setPage(parseInt(searchParams.get('page') || '1', 10));
  }, [searchParams]);

  const normalizeCategory = (c: string) => c.toLowerCase().replace(/\s+/g, '-');
  const toTitleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  const isNewProduct = (createdAt?: string) => {
    if (!createdAt) return false;
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return false;
    const days = (Date.now() - created) / (1000*60*60*24);
    return days <= 30;
  };

  // Load stock data for products
  const loadStockData = async (products: Product[]) => {
    if (products.length === 0) {
      setProductsWithStock([]);
      return;
    }

    try {
      setStockLoading(true);
      
      // Use the quantity directly from products since it's now included in the API response
      const productsWithStockData: ProductWithStock[] = products.map(product => {
        const quantity = product.quantity || 0;
        return {
          ...product,
          quantity: quantity,
          stockStatus: stockService.getStockStatus(quantity),
          stockDisplayText: stockService.getStockDisplayText(quantity)
        };
      });

      setProductsWithStock(productsWithStockData);
    } catch (error) {
      console.error('Failed to load stock data:', error);
      // Fallback to products without stock data
      const fallbackProducts: ProductWithStock[] = products.map(product => ({
        ...product,
        quantity: product.quantity || 0,
        stockStatus: stockService.getStockStatus(product.quantity || 0),
        stockDisplayText: stockService.getStockDisplayText(product.quantity || 0)
      }));
      setProductsWithStock(fallbackProducts);
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        // Use the catalog service instead of the inventory endpoint for better filtering
        const params: any = {
          // Add basic filters
        };
        
        // Add category filter if specified
        if (category && category !== 'all') {
          const catLower = category.toLowerCase();
          if (catLower === 'gold' || catLower === 'diamond') {
            params.metal = [toTitleCase(catLower)]; // e.g., Gold, Diamond
          } else {
            params.category = toTitleCase(catLower); // e.g., Earrings, Necklace Set
          }
        }
        
        // Add URL-based filters
        const urlCategories = (searchParams.get('categories') || '').split(',').filter(Boolean);
        if (urlCategories.length) {
          params.categories = urlCategories;
        }
        
        const urlMetals = (searchParams.get('metal') || '').split(',').filter(Boolean);
        if (urlMetals.length) {
          params.metal = urlMetals;
        }
        
        const urlPurities = (searchParams.get('purity') || '').split(',').filter(Boolean);
        if (urlPurities.length) {
          params.purity = urlPurities;
        }
        
        const urlColors = (searchParams.get('color') || '').split(',').filter(Boolean);
        if (urlColors.length) {
          params.color = urlColors;
        }
        
        const urlStyles = (searchParams.get('style') || '').split(',').filter(Boolean);
        if (urlStyles.length) {
          params.style = urlStyles;
        }
        
        const urlEarringTypes = (searchParams.get('earringType') || '').split(',').filter(Boolean);
        if (urlEarringTypes.length) {
          params.earringType = urlEarringTypes;
        }
        
        const urlOccasions = (searchParams.get('occasion') || '').split(',').filter(Boolean);
        if (urlOccasions.length) {
          params.occasion = urlOccasions;
        }
        
        const urlFor = (searchParams.get('for') || '').split(',').filter(Boolean);
        if (urlFor.length) {
          params.for = urlFor;
        }
        
        // Handle price range filters
        const minPrice = searchParams.get('min_price');
        if (minPrice) {
          params.min_price = parseFloat(minPrice);
        }
        
        const maxPrice = searchParams.get('max_price');
        if (maxPrice) {
          params.max_price = parseFloat(maxPrice);
        }
        
        const response = await catalogService.search({
          ...params,
          per_page: 200  // Request up to 200 products to handle pagination client-side
        });
        // Map CatalogItem to Product interface
        const filteredProducts: Product[] = response.results.map(item => ({
          _id: item._id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          metal: item.metal,
          purity: item.purity,
          weight: item.weight,
          weight_unit: item.weight_unit || 'g',
          price: item.price,
          image: item.image,
          description: '', // CatalogItem doesn't have description
          status: 'active', // Default status
          quantity: item.quantity,
          createdAt: (item as any).createdAt || (item as any).created_at,
          isBestseller: (item as any).isBestseller ?? (item as any).is_bestseller
        }));
        
        setProducts(filteredProducts);
        // Load stock data for the filtered products
        await loadStockData(filteredProducts);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [category, searchParams]);

  // Since we're using the catalog service which handles filtering on the backend,
  // we don't need client-side filtering anymore
  const filteredProducts = productsWithStock;
  const uniqueMetals = [...new Set(productsWithStock.map(p => p.metal))];
  const updateParams = (updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k,v])=>{ 
      if (Array.isArray(v)) { if (v.length) params.set(k, v.join(',')); else params.delete(k); }
      else if(v===null) params.delete(k); else params.set(k,v);
    });
    if (!('page' in updates)) params.set('page','1');
    setSearchParams(params);
  };

  // Sorting and pagination
  const sortedProducts = useMemo(()=>{
    const arr = [...filteredProducts];
    if (sortBy === 'price-asc') arr.sort((a,b)=> (a.price||0)-(b.price||0));
    else if (sortBy === 'price-desc') arr.sort((a,b)=> (b.price||0)-(a.price||0));
    // simple placeholders for popularity/new/bestseller could be by name/time if available
    console.log('📊 Products loaded:', arr.length);
    return arr;
  }, [filteredProducts, sortBy]);
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = sortedProducts.slice((currentPage-1)*perPage, currentPage*perPage);
  
  console.log('📄 Pagination:', {
    totalProducts: sortedProducts.length,
    perPage,
    totalPages,
    currentPage,
    pageSlice: pageSlice.length
  });

  if (isLoading || stockLoading) {
    // Skeleton grid placeholders
    const skeletonItems = Array.from({ length: 12 }, (_, i) => i);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {skeletonItems.map((i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Main content */}
          <section className="flex-1 min-w-0">
            {/* Top Controls Bar */}
            <div className="flex items-center justify-between gap-3 mb-3 bg-gray-50 rounded-lg shadow-sm px-3 py-2" role="toolbar" aria-label="Products controls">
              <div className="flex items-center gap-2">
                <button onClick={()=>setFilterDrawerOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 text-gray-800 bg-white hover:bg-gray-50" aria-haspopup="dialog" aria-controls="filters-drawer">
                  <LucideFilter className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm">Filter</span>
                </button>
                {/* Breadcrumb */}
                <div className="hidden md:flex items-center text-sm text-gray-500" role="navigation" aria-label="Breadcrumb">
                  <button onClick={()=>navigate('/')} className="hover:text-gray-700">Home</button>
                  <span className="mx-2">›</span>
                  <button onClick={()=>navigate('/products')} className="hover:text-gray-700">Products</button>
                  {category && category !== 'all' && (<><span className="mx-2">›</span><span className="capitalize text-gray-700">{category}</span></>)}
                </div>
                {/* Mobile trimmed breadcrumb */}
                <div className="flex md:hidden items-center text-xs text-gray-500" role="navigation" aria-label="Breadcrumb">
                  <button onClick={()=>navigate('/')} className="hover:text-gray-700">Home</button>
                  <span className="mx-1">›</span>
                  <span className="truncate max-w-[120px]">
                    {category && category !== 'all' ? `${category}` : 'Products'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggles */}
                <button onClick={()=>{ setViewMode('grid'); updateParams({ view: 'grid' }); }} className={`p-2 rounded-md border ${viewMode==='grid'?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-700 hover:bg-gray-50'}`} title="Grid view">
                  <LayoutGrid className="w-5 h-5" strokeWidth={1.5} />
                </button>
                <button onClick={()=>{ setViewMode('list'); updateParams({ view: 'list' }); }} className={`p-2 rounded-md border ${viewMode==='list'?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-700 hover:bg-gray-50'}`} title="List view">
                  <ListIcon className="w-5 h-5" strokeWidth={1.5} />
                </button>
                {/* Sort icon button */}
                <button onClick={()=>setSortModalOpen(true)} className="p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" title="Sort" aria-haspopup="dialog" aria-expanded={sortModalOpen}>
                  <SlidersHorizontal className="w-5 h-5" strokeWidth={1.5} />
                </button>
                {/* Density toggle */}
                <div className="relative">
                  <button onClick={()=>setDensity(density==='dense'?'normal':'dense')} className="px-2 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm" aria-pressed={density==='dense'} title="Toggle dense view">
                    {density==='dense' ? 'Dense' : 'Comfortable'}
                  </button>
                </div>
              </div>
            </div>
            {/* Pill filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {priceRanges.map(pr => (
                <span key={pr} className="pill inline-flex items-center gap-2 px-4 py-2">
                  <span className="text-sm">{pr}</span>
                  <button onClick={()=>{ const next = priceRanges.filter(x=>x!==pr); setPriceRanges(next); updateParams({ price: next }); }} className="text-gray-500 hover:text-gray-700">×</button>
                </span>
              ))}
              {selectedMetals.map(m => (
                <span key={m} className="pill inline-flex items-center gap-2 px-4 py-2">
                  <span className="text-sm capitalize">{m}</span>
                  <button onClick={()=>{ const next = selectedMetals.filter(x=>x!==m); setSelectedMetals(next); updateParams({ metal: next }); }} className="text-gray-500 hover:text-gray-700">×</button>
                </span>
              ))}
              {selectedPurities.map(p => (
                <span key={p} className="pill inline-flex items-center gap-2 px-4 py-2">
                  <span className="text-sm">{p}</span>
                  <button onClick={()=>{ const next = selectedPurities.filter(x=>x!==p); setSelectedPurities(next); updateParams({ purity: next }); }} className="text-gray-500 hover:text-gray-700">×</button>
                </span>
              ))}
              {urlCategories.map(c=> (
                <span key={c} className="pill inline-flex items-center gap-2 px-4 py-2">
                  <span className="text-sm capitalize">{c.replace('-', ' ')}</span>
                </span>
              ))}
              <button onClick={()=>setFilterDrawerOpen(true)} className="pill inline-flex items-center gap-2 px-4 py-2 hover:shadow">
                <span className="text-sm font-medium">+ Show More</span>
              </button>
            </div>

            <div className="text-gray-600">Showing {pageSlice.length ? ((currentPage-1)*perPage+1) : 0}–{(currentPage-1)*perPage + pageSlice.length} of {filteredProducts.length} products</div>
        

        {/* Active filter badges (secondary row) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {urlCategories.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              {c.replace('-', ' ')}
            </span>
          ))}
          {selectedMetals.map(m => (
            <span key={m} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-sm">
              {m}
              <button onClick={()=>{ const next = selectedMetals.filter(x=>x!==m); setSelectedMetals(next); updateParams({ metal: next }); }} className="ml-1 text-blue-700 hover:text-blue-900">×</button>
            </span>
          ))}
          {priceRanges.map(pr => (
            <span key={pr} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-900 border border-green-200 text-sm">
              {pr}
              <button onClick={()=>{ const next = priceRanges.filter(x=>x!==pr); setPriceRanges(next); updateParams({ price: next }); }} className="ml-1 text-green-700 hover:text-green-900">×</button>
            </span>
          ))}
        </div>

        {/* Filters (hidden inline; using drawer instead) intentionally removed */}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your filters to see more results</p>
          </div>
        ) : (
          <>
            <div className={`${viewMode==='grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6' : 'space-y-4'}`}>
              {pageSlice.map((product, idx) => (
                <motion.div
                  key={product._id}
                  className={`card overflow-hidden transition-all group cursor-pointer ${viewMode==='list' ? 'flex' : 'flex flex-col h-full'} hover:shadow-xl hover:scale-[1.02]`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => navigate(`/product/${product._id}`)}
                >
                  <div className={`${viewMode==='list' ? 'w-48 flex-shrink-0' : ''} aspect-square overflow-hidden relative`}>
                    {product.image ? (
                      <img
                        src={product.image.startsWith('http') ? product.image : `${API_BASE_URL}${product.image}`}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        crossOrigin="anonymous"
                        onLoad={(e) => {
                          console.log('✅ Image loaded:', product.sku, product.image);
                        }}
                        onError={(e) => {
                          const imgUrl = product.image ? (product.image.startsWith('http') ? product.image : `${API_BASE_URL}${product.image}`) : '';
                          console.error('❌ Image failed to load:', product.sku, imgUrl);
                          // Show placeholder instead of hiding
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.querySelector('.placeholder')?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    {/* Placeholder shown when image fails or doesn't exist */}
                    <div className={`placeholder ${product.image ? 'hidden' : ''} w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center`}>
                      <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {(product as any).isBestseller && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700 border border-rose-200">Bestseller</span>
                      )}
                      {isNewProduct((product as any).createdAt) && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">New</span>
                      )}
                    </div>
                    {/* Wishlist (always visible like reference) */}
                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                      <button
                        title={isWishlisted(product._id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        aria-label={isWishlisted(product._id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        aria-pressed={isWishlisted(product._id)}
                        role="button"
                        tabIndex={0}
                        className="p-2 rounded-full bg-white/90 shadow hover:bg-white"
                        onClick={(e)=>{
                          e.stopPropagation();
                          const ev = new CustomEvent('sj:toggleWishlist', { detail: { productId: product._id, name: product.name, price: product.price, image: product.image, metal: product.metal, purity: product.purity } });
                          window.dispatchEvent(ev);
                        }}
                        onKeyDown={(e)=>{
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            const ev = new CustomEvent('sj:toggleWishlist', { detail: { productId: product._id, name: product.name, price: product.price, image: product.image, metal: product.metal, purity: product.purity } });
                            window.dispatchEvent(ev);
                          }
                        }}
                      >
                        {/* Heart reflects wishlist state */}
                        <HeartIcon className={`w-5 h-5 ${isWishlisted(product._id) ? 'text-rose-600' : 'text-gray-400'}`} strokeWidth={1.5} fill={isWishlisted(product._id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  <div className={`${density==='dense' ? 'p-3' : 'p-4'} flex flex-col flex-1`}>
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-none min-h-[3rem]">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-500 leading-none">{product.category}</p>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {product.metal} - {product.purity}
                      </span>
                      {product.weight && (
                        <span className="text-xs text-gray-500">
                          {product.weight}{product.weight_unit}
                        </span>
                      )}
                    </div>

                    {product.price && (
                      <div className="mt-auto pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="product-price flex items-baseline gap-1 whitespace-nowrap">
                            <span className="rupee text-lg leading-none">₹</span>
                            <span className="amount text-lg font-bold text-gray-900 leading-none">{product.price.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e)=>{ 
                                e.stopPropagation(); 
                                const card = (e.currentTarget as HTMLElement).closest('.card');
                                const img = card?.querySelector('img');
                                const ev = new CustomEvent('sj:addToCart', { detail: {
                                  productId: product._id,
                                  sku: product.sku,
                                  name: product.name,
                                  price: product.price || 0,
                                  image: product.image || '',
                                  metal: product.metal,
                                  purity: product.purity,
                                  quantity: 1,
                                  sourceElement: img || undefined
                                }});
                                window.dispatchEvent(ev);
                              }}
                              aria-label="Add to cart"
                              className="w-10 h-10 flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100 transition"
                              title="Add to cart"
                            >
                              <CartIcon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const ev = new CustomEvent('sj:buyNow', { detail: {
                                  productId: product._id,
                                  sku: product.sku,
                                  name: product.name,
                                  price: product.price || 0,
                                  image: product.image || '',
                                  metal: product.metal,
                                  purity: product.purity,
                                  quantity: 1,
                                  sourceSelector: undefined
                                }});
                                window.dispatchEvent(ev);
                              }} 
                              disabled={product.stockStatus === 'out_of_stock'}
                              className={`h-10 px-4 flex items-center justify-center rounded-md text-sm font-medium leading-none whitespace-nowrap transition ${product.stockStatus === 'out_of_stock' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                              aria-label={product.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'Buy Now'}
                              title={product.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'Buy Now'}
                            >
                              Buy Now
                            </button>
                          </div>
                        </div>                    
                        {/* Stock Status Display */}
                        <div>
                        </div>
                        <div className="flex items-center gap-2">
  
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Enhanced Pagination */}
            <div className="mt-12 mb-8">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Previous Button */}
                <button 
                  disabled={currentPage <= 1} 
                  onClick={() => { 
                    const p = String(currentPage - 1); 
                    setPage(currentPage - 1); 
                    updateParams({ page: p }); 
                  }} 
                  className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                    currentPage <= 1 
                      ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </span>
                </button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {(() => {
                    const pages = [];
                    const showEllipsisStart = currentPage > 3;
                    const showEllipsisEnd = currentPage < totalPages - 2;

                    // Always show first page
                    if (totalPages > 0) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => { setPage(1); updateParams({ page: '1' }); }}
                          className={`px-3 py-2 rounded-lg border min-w-[40px] font-medium transition-all ${
                            1 === currentPage
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          1
                        </button>
                      );
                    }

                    // Ellipsis after first page
                    if (showEllipsisStart) {
                      pages.push(
                        <span key="ellipsis-start" className="px-2 text-gray-400">•••</span>
                      );
                    }

                    // Middle pages (current - 1, current, current + 1)
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    
                    for (let p = start; p <= end; p++) {
                      pages.push(
                        <button
                          key={p}
                          onClick={() => { setPage(p); updateParams({ page: String(p) }); }}
                          className={`px-3 py-2 rounded-lg border min-w-[40px] font-medium transition-all ${
                            p === currentPage
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    }

                    // Ellipsis before last page
                    if (showEllipsisEnd) {
                      pages.push(
                        <span key="ellipsis-end" className="px-2 text-gray-400">•••</span>
                      );
                    }

                    // Always show last page
                    if (totalPages > 1) {
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => { setPage(totalPages); updateParams({ page: String(totalPages) }); }}
                          className={`px-3 py-2 rounded-lg border min-w-[40px] font-medium transition-all ${
                            totalPages === currentPage
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                </div>

                {/* Mobile: Simple current/total display */}
                <div className="sm:hidden px-4 py-2 text-sm text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </div>

                {/* Next Button */}
                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => { 
                    const p = String(currentPage + 1); 
                    setPage(currentPage + 1); 
                    updateParams({ page: p }); 
                  }} 
                  className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                    currentPage >= totalPages 
                      ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>

              {/* Page info text */}
              <div className="text-center mt-4 text-sm text-gray-500">
                Showing page {currentPage} of {totalPages} ({filteredProducts.length} total products)
              </div>
            </div>
          </>
        )}
          </section>
        </div>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        open={quickViewOpen}
        product={quickViewProduct}
        onClose={()=>setQuickViewOpen(false)}
        onViewDetails={(id)=> navigate(`/product/${id}`)}
      />

      {/* Sort By Modal */}
      <AnimatePresence>
        {sortModalOpen && (
          <motion.div className="fixed inset-0 z-40 flex items-center justify-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setSortModalOpen(false)} />
            <motion.div className="relative bg-white rounded-2xl shadow-elevated w-[90vw] max-w-sm p-4" initial={{y:30, opacity:0}} animate={{y:0, opacity:1}} exit={{y:10, opacity:0}}>
              <div className="text-lg font-semibold mb-3">Sort By</div>
              <div className="rounded-lg border p-2 divide-y">
                {[
                  {key:'bestseller', label:'Best Sellers'},
                  {key:'new', label:'New Arrivals'},
                  {key:'popularity', label:'Popularity'},
                  {key:'price-asc', label:'Price : Low To High'},
                  {key:'price-desc', label:'Price : High To Low'},
                ].map(opt => (
                  <button key={opt.key} onClick={()=>{ setSortBy(opt.key); updateParams({ sort: opt.key }); setSortModalOpen(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${sortBy===opt.key ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{opt.label}</button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-30 p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
            title="Scroll to top"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Filter Drawer using MegaMenuFilter */}
      <AnimatePresence>
        {filterDrawerOpen && (
          <motion.div className="fixed inset-0 z-40" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setFilterDrawerOpen(false)} />
            <motion.div className="absolute right-0 top-0 h-full w-[92vw] max-w-md bg-white shadow-2xl flex flex-col" initial={{x:400}} animate={{x:0}} exit={{x:400}} transition={{type:'spring', stiffness:260, damping:24}}>
              <div className="p-4 border-b flex items-center justify-between flex-none">
                <div className="text-lg font-semibold">Filters</div>
                <button onClick={()=>setFilterDrawerOpen(false)} className="text-gray-600 hover:text-gray-800">Close</button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                <MegaMenuFilter onApplied={()=>setFilterDrawerOpen(false)} presetMetal={selectedMetals[0] || (category==='gold' ? 'gold' : null)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
