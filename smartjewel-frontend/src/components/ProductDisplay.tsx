import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickViewModal } from './QuickViewModal';
import { MegaMenuFilter } from './MegaMenuFilter';
import { useWishlist } from '../contexts/WishlistContext';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetals, setSelectedMetals] = useState<string[]>((searchParams.get('metal') || '').split(',').filter(Boolean));
  const [priceRanges, setPriceRanges] = useState<string[]>((searchParams.get('price') || '').split(',').filter(Boolean));
  const [selectedPurities, setSelectedPurities] = useState<string[]>((searchParams.get('purity') || '').split(',').filter(Boolean));
  const urlCategories = useMemo(() => (searchParams.get('categories') || '').split(',').filter(Boolean), [searchParams]);
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sort') || 'popularity');
  const [viewMode, setViewMode] = useState<'grid'|'list'>(searchParams.get('view') === 'list' ? 'list' : 'grid');
  const [page, setPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10));
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product|null>(null);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Keep local state synced if URL params change
    setSelectedMetals((searchParams.get('metal') || '').split(',').filter(Boolean));
    setPriceRanges((searchParams.get('price') || '').split(',').filter(Boolean));
    setSelectedPurities((searchParams.get('purity') || '').split(',').filter(Boolean));
    // colour removed
    setSortBy(searchParams.get('sort') || 'popularity');
    setViewMode(searchParams.get('view') === 'list' ? 'list' : 'grid');
    setPage(parseInt(searchParams.get('page') || '1', 10));
  }, [searchParams]);

  const normalizeCategory = (c: string) => c.toLowerCase().replace(/\s+/g, '-');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/inventory/products');
        let filteredProducts = response.data.products || [];

        // Optional single-category pre-filter for existing routes
        if (category && category !== 'all') {
          const categoryLower = category.toLowerCase();
          if (categoryLower === 'bangles') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'bangles' || item.name.toLowerCase().includes('bangle')
            );
          } else if (categoryLower === 'chains') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'chains' || item.name.toLowerCase().includes('chain')
            );
          } else if (categoryLower === 'pendants') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'pendants' || item.name.toLowerCase().includes('pendant')
            );
          } else if (categoryLower === 'mangalsutra') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'mangalsutra' || item.name.toLowerCase().includes('mangalsutra')
            );
          } else if (categoryLower === 'bracelets') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'bracelets' || item.name.toLowerCase().includes('bracelet')
            );
          } else if (categoryLower === 'rings') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'rings' || item.name.toLowerCase().includes('ring')
            );
          } else if (categoryLower === 'earrings') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'earrings' || item.name.toLowerCase().includes('earring')
            );
          } else if (categoryLower === 'necklaces') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase() === 'necklaces' || item.category.toLowerCase() === 'necklace' || item.name.toLowerCase().includes('necklace')
            );
          } else if (categoryLower === 'gold') {
            filteredProducts = filteredProducts.filter((item: Product) => item.metal.toLowerCase().includes('gold'));
          } else if (categoryLower === 'diamond') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.metal.toLowerCase().includes('diamond') || item.name.toLowerCase().includes('diamond') || item.description?.toLowerCase().includes('diamond')
            );
          } else if (categoryLower === 'wedding') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              item.category.toLowerCase().includes('mangalsutra') || item.category.toLowerCase().includes('necklace') || item.category.toLowerCase().includes('ring') || item.name.toLowerCase().includes('wedding') || item.name.toLowerCase().includes('bridal')
            );
          } else if (categoryLower === 'collections') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              (item.price && item.price > 50000) || item.name.toLowerCase().includes('collection') || item.description?.toLowerCase().includes('collection')
            );
          } else if (categoryLower === 'gifting') {
            filteredProducts = filteredProducts.filter((item: Product) => 
              ['Earrings', 'Pendants', 'Bracelets', 'Chains', 'Rings'].includes(item.category)
            );
          }
        }

        setProducts(filteredProducts);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [category]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMetal = !selectedMetals.length || selectedMetals.some(m => product.metal.toLowerCase().includes(m.toLowerCase()));

    const matchesPurity = !selectedPurities.length || selectedPurities.includes(product.purity);

    const matchesPrice = !priceRanges.length || priceRanges.some(range =>
      (range === 'under-25k' && (product.price || 0) < 25000) ||
      (range === '25k-50k' && (product.price || 0) >= 25000 && (product.price || 0) <= 50000) ||
      (range === '50k-100k' && (product.price || 0) > 50000 && (product.price || 0) <= 100000) ||
      (range === 'above-100k' && (product.price || 0) > 100000)
    );

    // Match multiple URL categories if provided
    const matchesCategories = !urlCategories.length || (() => {
      const pc = normalizeCategory(product.category);
      return urlCategories.some(uc => {
        const ucText = uc.replace('-', ' ');
        return pc === uc || pc.includes(uc) || uc.includes(pc) ||
          product.name.toLowerCase().includes(ucText) ||
          product.category.toLowerCase().includes(ucText);
      });
    })();

    return matchesSearch && matchesMetal && matchesPurity && matchesPrice && matchesCategories;
  });

  const uniqueMetals = [...new Set(products.map(p => p.metal))];
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
    return arr;
  }, [filteredProducts, sortBy]);
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = sortedProducts.slice((currentPage-1)*perPage, currentPage*perPage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading our beautiful collection...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/products')} className="hover:text-blue-600">Products</button>
          {category && category !== 'all' && (<><span>/</span><span className="capitalize text-gray-900">{category}</span></>)}
        </div>
      </div>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">{description}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Top section - title and controls */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold text-gray-900">
              {title} <span className="text-gray-500 text-base">({filteredProducts.length} results)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1" role="group">
                <button onClick={()=>{ setViewMode('grid'); updateParams({ view: 'grid' }); }} className={`px-2 py-1 rounded ${viewMode==='grid'?'bg-gray-900 text-white':'border border-gray-200 text-gray-700'}`}>Grid</button>
                <button onClick={()=>{ setViewMode('list'); updateParams({ view: 'list' }); }} className={`px-2 py-1 rounded ${viewMode==='list'?'bg-gray-900 text-white':'border border-gray-200 text-gray-700'}`}>List</button>
              </div>
              <button onClick={()=>setSortModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 text-gray-800 bg-white hover:shadow">
                <span className="text-sm">Sort By:</span>
                <span className="font-medium">{sortBy === 'price-asc' ? 'Price: Low to High' : sortBy === 'price-desc' ? 'Price: High to Low' : sortBy === 'new' ? 'New Arrivals' : sortBy === 'bestseller' ? 'Best Sellers' : 'Popularity'}</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
          </div>

          {/* Pill filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>setFilterDrawerOpen(true)} className="pill inline-flex items-center gap-2 px-4 py-2 hover:shadow">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M6 12h12M9 18h6"/></svg>
              <span className="text-sm font-medium">Filter</span>
            </button>
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
        </div>

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
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                Showing {(currentPage-1)*perPage + pageSlice.length} of {filteredProducts.length} products
              </p>
            </div>

            <div className={`${viewMode==='grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}`}>
              {pageSlice.map((product, idx) => (
                <motion.div
                  key={product._id}
                  className={`card overflow-hidden hover:shadow-elevated transition-shadow group ${viewMode==='list' ? 'flex' : ''}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <div className={`${viewMode==='list' ? 'w-48 flex-shrink-0' : ''} aspect-square overflow-hidden relative`}>
                    {product.image ? (
                      <img
                        src={product.image.startsWith('http') ? product.image : `http://127.0.0.1:5000${product.image}`}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          console.error('Image failed to load:', product.image);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                        <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Wishlist (always visible like reference) */}
                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                      <button
                        title="Toggle Wishlist"
                        className="p-2 rounded-full bg-white/90 shadow hover:bg-white"
                        onClick={(e)=>{
                          e.stopPropagation();
                          const ev = new CustomEvent('sj:toggleWishlist', { detail: { productId: product._id, name: product.name, price: product.price, image: product.image, metal: product.metal, purity: product.purity } });
                          window.dispatchEvent(ev);
                        }}
                      >
                        {/* Heart reflects wishlist state */}
                        <svg
                          className={`w-5 h-5 ${isWishlisted(product._id) ? 'text-rose-600' : 'text-gray-400'}`}
                          viewBox="0 0 24 24"
                          fill={isWishlisted(product._id) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 flex-1">
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-500">{product.category}</p>
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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-lg font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setQuickViewProduct(product); setQuickViewOpen(true); }} className="px-3 py-1 rounded-md border border-gray-200 text-sm hover:bg-gray-50">Quick View</button>
                            <button onClick={() => navigate(`/product/${product._id}`)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors">View Details</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="pill px-3 py-1 text-sm">Similar</button>
                          <button className="pill px-3 py-1 text-sm">Try it</button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <button disabled={currentPage<=1} onClick={()=>{ const p = String(currentPage-1); setPage(currentPage-1); updateParams({ page: p }); }} className={`px-3 py-1.5 rounded border ${currentPage<=1?'text-gray-300 border-gray-100':'text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Prev</button>
              {Array.from({length: totalPages}).slice(0,5).map((_,i)=>{
                const p = i+1;
                return <button key={p} onClick={()=>{ setPage(p); updateParams({ page: String(p) }); }} className={`px-3 py-1.5 rounded border ${p===currentPage?'bg-gray-900 text-white':'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{p}</button>;
              })}
              <button disabled={currentPage>=totalPages} onClick={()=>{ const p = String(currentPage+1); setPage(currentPage+1); updateParams({ page: p }); }} className={`px-3 py-1.5 rounded border ${currentPage>=totalPages?'text-gray-300 border-gray-100':'text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Next</button>
            </div>
          </>
        )}
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
