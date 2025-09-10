import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

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
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetal, setSelectedMetal] = useState<string>(searchParams.get('metal') || '');
  const [priceRange, setPriceRange] = useState<string>(searchParams.get('price') || '');
  const urlCategories = useMemo(() => (searchParams.get('categories') || '').split(',').filter(Boolean), [searchParams]);
  const navigate = useNavigate();

  useEffect(() => {
    // Keep local state synced if URL params change
    setSelectedMetal(searchParams.get('metal') || '');
    setPriceRange(searchParams.get('price') || '');
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

    const matchesMetal = !selectedMetal || product.metal.toLowerCase().includes(selectedMetal.toLowerCase());

    const matchesPrice = !priceRange ||
      (priceRange === 'under-25k' && (product.price || 0) < 25000) ||
      (priceRange === '25k-50k' && (product.price || 0) >= 25000 && (product.price || 0) <= 50000) ||
      (priceRange === '50k-100k' && (product.price || 0) > 50000 && (product.price || 0) <= 100000) ||
      (priceRange === 'above-100k' && (product.price || 0) > 100000);

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

    return matchesSearch && matchesMetal && matchesPrice && matchesCategories;
  });

  const uniqueMetals = [...new Set(products.map(p => p.metal))];

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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">{description}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Products</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search products..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Metal Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metal</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMetal}
                onChange={(e) => setSelectedMetal(e.target.value)}
              >
                <option value="">All Metals</option>
                {uniqueMetals.map(metal => (
                  <option key={metal} value={metal}>{metal}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
              >
                <option value="">All Prices</option>
                <option value="under-25k">Under ₹25,000</option>
                <option value="25k-50k">₹25,000 - ₹50,000</option>
                <option value="50k-100k">₹50,000 - ₹1,00,000</option>
                <option value="above-100k">Above ₹1,00,000</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedMetal('');
                  setPriceRange('');
                }}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

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
                Showing {filteredProducts.length} of {products.length} products
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product._id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/product/${product._id}`)}
                >
                  <div className="aspect-square overflow-hidden">
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
                  </div>

                  <div className="p-4">
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
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-gray-900">
                          ₹{product.price.toLocaleString()}
                        </span>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors">
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
