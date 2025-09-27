import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../contexts/WishlistContext';
import { useCart } from '../../contexts/CartContext';
import { API_BASE_URL } from '../../api';
import { useToast } from '../../components/Toast';
import { flyToCart } from '../../utils/flyToCart';

export const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, remove, clear, count } = useWishlist();
  const { addToCart } = useCart();
  const toast = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allSelected = useMemo(() => items.length > 0 && selectedIds.length === items.length, [items, selectedIds]);
  const anySelected = selectedIds.length > 0;
  const toAbsoluteImage = (img?: string) => {
    if (!img) return '/jewel1.png';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    // Ensure leading slash once
    const path = img.startsWith('/') ? img : `/${img}`;
    return `${API_BASE_URL}${path}`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(items.map(x => x.productId));
  };

  const handleAddToBag = (productId: string) => {
    const it = items.find(x => x.productId === productId);
    if (!it) return;
    addToCart({
      productId: it.productId,
      name: it.name,
      price: it.currentPrice || it.price,
      image: it.image,
      metal: it.metal,
      purity: it.purity,
    }, 1);
    toast.success('Added to Bag', { description: it.name });
    // Fly image to cart for delightful feedback (progressive enhancement)
    const imgEl = document.querySelector(`img[data-wish-img="${productId}"]`);
    flyToCart({ source: imgEl as Element | null });
    // Dispatch an event to let the header bounce the cart icon
    window.dispatchEvent(new CustomEvent('sj:cart:bounce'));
  };

  const handleAddSelectedToBag = () => {
    const toAdd = items.filter(it => selectedIds.includes(it.productId));
    if (toAdd.length === 0) return;
    toAdd.forEach((it, idx) => {
      addToCart({
        productId: it.productId,
        name: it.name,
        price: it.currentPrice || it.price,
        image: it.image,
        metal: it.metal,
        purity: it.purity,
      }, 1);
      // Stagger the fly-to-cart a bit so multiple images don't fully overlap
      const imgEl = document.querySelector(`img[data-wish-img="${it.productId}"]`);
      window.setTimeout(() => flyToCart({ source: imgEl as Element | null }), Math.min(120, idx * 60));
    });
    toast.success('Added selected to Bag', { description: `${toAdd.length} item(s)` });
    window.dispatchEvent(new CustomEvent('sj:cart:bounce'));
    setSelectedIds([]);
  };

  const handleRemoveSelected = () => {
    selectedIds.forEach(id => remove(id));
    setSelectedIds([]);
  };

  

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button>
          <span>/</span>
          <span className="text-gray-900">Wishlist</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 to-amber-50 py-10">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Your Wishlist</h1>
          <p className="text-gray-600">Saved items for later • {count} item{count !== 1 ? 's' : ''}</p>
          {/* Price refresh and update buttons removed as requested */}
        </div>
      </div>
      <div className="container mx-auto px-6 py-8">
        {/* Bulk actions */}
        {items.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="accent-rose-600 w-4 h-4" checked={allSelected} onChange={toggleSelectAll} />
                <span>Select all</span>
              </label>
              {anySelected && (
                <span className="text-sm text-gray-500">{selectedIds.length} selected</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium shadow ${anySelected ? 'bg-gray-900 text-white hover:opacity-90' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                onClick={handleAddSelectedToBag}
                disabled={!anySelected}
              >
                Add selected to Bag
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${anySelected ? 'text-rose-700 border-rose-200 hover:bg-rose-50' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
                onClick={handleRemoveSelected}
                disabled={!anySelected}
              >
                Remove selected
              </button>
              {items.length > 0 && (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                  onClick={clear}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 text-rose-600 mb-4">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
            <p className="text-gray-600 mb-6">Browse our collections and save your favorite designs.</p>
            <button onClick={() => navigate('/products/all')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:opacity-90">
              Explore Jewellery
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((it) => (
              <div key={it.productId} className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="relative">
                  <img
                    src={toAbsoluteImage(it.image)}
                    alt={it.name}
                    className="w-full h-56 object-cover bg-gray-100"
                    data-wish-img={it.productId}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/jewel1.png'; }}
                  />
                  <div className="absolute top-2 left-2">
                    <input
                      type="checkbox"
                      className="accent-rose-600 w-4 h-4 bg-white/90 rounded"
                      checked={selectedIds.includes(it.productId)}
                      onChange={() => toggleSelect(it.productId)}
                      aria-label={`Select ${it.name}`}
                    />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-gray-900 font-medium leading-snug line-clamp-2" title={it.name}>{it.name}</h3>
                    <div className="text-right">
                      <div className="text-gray-900 font-semibold">
                        {it.currentPrice ? `₹${it.currentPrice.toLocaleString('en-IN')}` : 
                         it.price ? `₹${it.price.toLocaleString('en-IN')}` : 'Price on request'}
                      </div>
                      {(it.metal || it.purity) && (
                        <div className="text-xs text-gray-500">{[it.metal, it.purity].filter(Boolean).join(' • ')}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      className="col-span-2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90"
                      onClick={() => handleAddToBag(it.productId)}
                    >
                      Add to Bag
                    </button>
                    <button
                      className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => remove(it.productId)}
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:text-blue-600"
                    onClick={() => navigate(`/product/${it.productId}`)}
                  >
                    View Details
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};