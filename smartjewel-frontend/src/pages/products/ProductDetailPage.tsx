import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { stockService, ProductWithStock } from '../../services/stockService';

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
  created_at?: string;
  quantity?: number;
}

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [productWithStock, setProductWithStock] = useState<ProductWithStock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedStyle, setSelectedStyle] = useState<string | undefined>(undefined);
  const [rating, setRating] = useState<number>(0);
  const [reviews, setReviews] = useState<{ user: string; rating: number; comment: string; date: string }[]>([]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        // Use the public products endpoint to get all products and find by ID
        const response = await api.get('/inventory/products');
        const products = response.data.products || [];
        const foundProduct = products.find((item: Product) => item._id === id);
        setProduct(foundProduct || null);
        
        if (foundProduct) {
          // Load stock data for this product
          await loadStockData(foundProduct);
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const loadStockData = async (product: Product) => {
      try {
        setStockLoading(true);
        
        // Use the quantity directly from the product since it's now included in the API response
        const quantity = product.quantity || 0;
        const productWithStockData: ProductWithStock = {
          ...product,
          quantity: quantity,
          stockStatus: stockService.getStockStatus(quantity),
          stockDisplayText: stockService.getStockDisplayText(quantity)
        };
        
        setProductWithStock(productWithStockData);
      } catch (error) {
        console.error('Failed to load stock data:', error);
        // Fallback to product without stock data
        const fallbackProduct: ProductWithStock = {
          ...product,
          quantity: product.quantity || 0,
          stockStatus: stockService.getStockStatus(product.quantity || 0),
          stockDisplayText: stockService.getStockDisplayText(product.quantity || 0)
        };
        setProductWithStock(fallbackProduct);
      } finally {
        setStockLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  if (isLoading || stockLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">
              {isLoading ? 'Loading product details...' : 'Checking stock availability...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!product || !productWithStock) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
            <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => navigate('/products/all')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to All Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <button onClick={() => navigate('/products/all')} className="hover:text-blue-600">
              Products
            </button>
            <span>/</span>
            <button onClick={() => navigate(`/products/${product.category.toLowerCase()}`)} className="hover:text-blue-600">
              {product.category}
            </button>
            <span>/</span>
            <span className="text-gray-900">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Gallery with Zoom */}
            <div className="p-6">
              <div className="aspect-square relative overflow-hidden rounded-lg border">
                <img
                  src={(activeImage || (product.image || '')).startsWith('http') ? (activeImage || (product.image || '')) : `http://127.0.0.1:5000${(activeImage || (product.image || ''))}`}
                  alt={product.name}
                  className={`w-full h-full object-cover ${zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'} transition-transform duration-300`}
                  onClick={() => setZoomed(z => !z)}
                  onMouseLeave={() => setZoomed(false)}
                />
                <button
                  className="absolute top-3 right-3 bg-white/90 rounded-full p-2 shadow"
                  title="Add to Wishlist"
                  onClick={()=>{
                    const ev = new CustomEvent('sj:toggleWishlist', { detail: { productId: product._id, name: product.name, price: product.price, image: product.image, metal: product.metal, purity: product.purity } });
                    window.dispatchEvent(ev);
                  }}
                >
                  <svg className="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 3 13.352 3 10.75 3 8.264 4.988 6.5 7.2 6.5c1.278 0 2.516.492 3.445 1.378A4.87 4.87 0 0114.1 6.5c2.212 0 4.1 1.764 4.1 4.25 0 2.602-1.688 4.61-3.99 6.757a25.178 25.178 0 01-4.244 3.17 15.247 15.247 0 01-.383.218l-.022.012-.007.003-.003.002a.75.75 0 01-.66 0l-.003-.002z"/></svg>
                </button>
              </div>
              {/* Thumbnails (if backend adds more images later, wire here) */}
              {product.image && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[product.image].map((img, i) => (
                    <button key={i} onClick={()=>{ setActiveImage(img); setZoomed(false); }} className={`aspect-square rounded overflow-hidden border ${activeImage===img ? 'ring-2 ring-amber-400' : ''}`}>
                      <img src={img.startsWith('http') ? img : `http://127.0.0.1:5000${img}`} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="p-8 flex flex-col">
              <div className="flex-1">
                {/* Category Badge */}
                <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full mb-4">
                  {product.category}
                </span>

                {/* Product Name */}
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

                {/* SKU */}
                <p className="text-gray-600 mb-4">SKU: {product.sku}</p>

                {/* Price */}
                {product.price && (
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      ₹{product.price.toLocaleString()}
                    </span>
                    <span className="text-gray-600 ml-2">(inclusive of all taxes)</span>
                    
                    {/* Stock Status Display */}
                    <div className="mt-3">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        productWithStock.stockStatus === 'available' 
                          ? 'bg-green-100 text-green-800' 
                          : productWithStock.stockStatus === 'limited' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {productWithStock.stockDisplayText}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* Details & Specifications */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="text-sm font-medium text-gray-500">Metal</span>
                      <p className="text-gray-900 font-semibold">{product.metal}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="text-sm font-medium text-gray-500">Purity</span>
                      <p className="text-gray-900 font-semibold">{product.purity}</p>
                    </div>
                    {product.weight && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <span className="text-sm font-medium text-gray-500">Weight</span>
                        <p className="text-gray-900 font-semibold">{product.weight} {product.weight_unit}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="text-sm font-medium text-gray-500">Certification</span>
                      <p className="text-gray-900 font-semibold">IGI / BIS Hallmark</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <span className="text-sm font-medium text-gray-500">Status</span>
                      <p
                        className={`font-semibold ${
                          productWithStock.stockStatus === 'out_of_stock'
                            ? 'text-red-600'
                            : productWithStock.stockStatus === 'limited'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }`}
                      >
                        {productWithStock.stockStatus === 'out_of_stock'
                          ? 'Out of Stock'
                          : productWithStock.stockStatus === 'limited'
                            ? 'Limited Stock'
                            : 'Available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Size & Style selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <select value={selectedSize} onChange={(e)=>setSelectedSize(e.target.value)} className="w-full border rounded-md px-3 py-2">
                      <option value="">Select size</option>
                      {['S','M','L','XL'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                    <select value={selectedStyle} onChange={(e)=>setSelectedStyle(e.target.value)} className="w-full border rounded-md px-3 py-2">
                      <option value="">Select style</option>
                      {['Classic','Modern','Antique'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quantity and Actions */}
                {product.status === 'active' && (
                  <div className="border-t pt-6">
                    <div className="flex items-center space-x-4 mb-6">
                      <label className="text-sm font-medium text-gray-700">Quantity:</label>
                      <div className="flex items-center border rounded-md">
                        <button 
                          onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                          disabled={productWithStock.stockStatus === 'out_of_stock'}
                          className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </button>
                        <span className="px-4 py-2 border-x">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(Math.min(quantity + 1, productWithStock.quantity || 0))} 
                          disabled={productWithStock.stockStatus === 'out_of_stock' || quantity >= (productWithStock.quantity || 0)}
                          className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        className={`flex-1 py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                          productWithStock.stockStatus === 'out_of_stock'
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        disabled={productWithStock.stockStatus === 'out_of_stock'}
                        onClick={()=>{
                          if (productWithStock.stockStatus === 'out_of_stock') return;
                          const ev = new CustomEvent('sj:addToCart', { detail: {
                            productId: product._id,
                            sku: product.sku,
                            name: product.name,
                            price: product.price,
                            image: product.image,
                            metal: product.metal,
                            purity: product.purity,
                            size: selectedSize,
                            style: selectedStyle,
                            quantity
                          }});
                          window.dispatchEvent(ev);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 3H3m4 10v6a1 1 0 001 1h1m-4-3h12a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v10z" /></svg>
                        <span>{productWithStock.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}</span>
                      </button>
                      <button 
                        className={`flex-1 py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                          productWithStock.stockStatus === 'out_of_stock'
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                        disabled={productWithStock.stockStatus === 'out_of_stock'}
                        onClick={()=>{
                          if (productWithStock.stockStatus === 'out_of_stock') return;
                          const ev = new CustomEvent('sj:buyNow', { detail: {
                            productId: product._id,
                            sku: product.sku,
                            name: product.name,
                            price: product.price,
                            image: product.image,
                            metal: product.metal,
                            purity: product.purity,
                            size: selectedSize,
                            style: selectedStyle,
                            quantity
                          }});
                          window.dispatchEvent(ev);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>{productWithStock.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'Buy Now'}</span>
                      </button>
                    </div>

                    <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                        <span>Certified Quality</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                        <span>Free Shipping</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        <span>Lifetime Support</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Products</span>
          </button>
        </div>
      </div>
    </div>
  );
};
