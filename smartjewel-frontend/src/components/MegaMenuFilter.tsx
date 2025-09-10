import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Utility to slugify labels for URL price mapping (robust to commas, currency, and dashes)
const priceLabelToSlug = (label: string) => {
  const t = label
    .toLowerCase()
    .replace(/[₹,\s]/g, '') // remove currency, commas, spaces
    .replace(/[–—-]/g, '-') // normalize all dashes
    ;
  if (t.includes('under') || t.includes('<') || t.includes('below') || t.includes('under25000') || t.includes('under25k')) return 'under-25k';
  if ((t.includes('25000') && t.includes('50000')) || t.includes('25k-50k')) return '25k-50k';
  if ((t.includes('50000') && t.includes('100000')) || t.includes('50k-100k')) return '50k-100k';
  if (t.includes('100000') || t.includes('above') || t.includes('100k')) return 'above-100k';
  return '';
};

const categoryOptions = [
  'Earrings', 'Pendants', 'Rings', 'Necklaces', 'Bangles', 'Bracelets', 'Mangalsutra', 'Nose Pin', 'Toe Rings', 'Anklets', 'Coins', 'Chains', 'Necklace Set'
];

const metalOptions = ['Gold', 'Diamond', 'Platinum', 'Silver'];

const priceOptions = [
  'Under ₹25,000', '₹25,000 – ₹50,000', '₹50,000 – ₹1,00,000', '₹1,00,000 & above'
];

interface MegaMenuFilterProps {
  onApplied?: () => void; // optional callback to close menu after navigation
  promo?: { image: string; title: string; cta: string; href: string } | null;
  // Optional preset for metal (e.g., for Gold/Diamond tabs). Ignored if URL has metal.
  presetMetal?: string | null;
}

const normalizeCategory = (c: string) => c.toLowerCase().replace(/\s+/g, '-');

export const MegaMenuFilter: React.FC<MegaMenuFilterProps> = ({ onApplied, promo, presetMetal = null }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-populate from current URL when opened on products page
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialCategories = useMemo(() => (params.get('categories') || '').split(',').filter(Boolean), [params]);
  const initialMetal = params.get('metal') || '';
  const initialPrice = params.get('price') || '';
  const hasPriceInUrl = useMemo(() => params.has('price'), [params]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [selectedMetal, setSelectedMetal] = useState<string>(initialMetal || (presetMetal || ''));
  const [selectedPrice, setSelectedPrice] = useState<string>(''); // do not default select price

  // Keep state in sync if URL changes while menu is open
  useEffect(() => {
    setSelectedCategories(initialCategories);
    // Metal: prefer URL, otherwise preset if provided
    setSelectedMetal(initialMetal || (presetMetal || ''));
    // Price: only set from URL; otherwise keep empty (no default selection)
    setSelectedPrice(hasPriceInUrl ? initialPrice : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategories.join(','), initialMetal, initialPrice, hasPriceInUrl, presetMetal]);

  const toggleCategory = (label: string) => {
    const slug = normalizeCategory(label);
    setSelectedCategories(prev => prev.includes(slug) ? prev.filter(c => c !== slug) : [...prev, slug]);
  };

  const applyFilters = () => {
    const search = new URLSearchParams();
    if (selectedCategories.length) search.set('categories', selectedCategories.join(','));
    if (selectedMetal) search.set('metal', selectedMetal.toLowerCase());
    if (selectedPrice) search.set('price', selectedPrice);
    navigate(`/products?${search.toString()}`);
    onApplied?.();
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedMetal('');
    setSelectedPrice('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-white border border-gray-200 rounded-xl shadow-2xl">
      {/* Filter groups */}
      <div>
        <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Category</div>
        <div className="grid grid-cols-2 gap-2">
          {categoryOptions.map((cat) => {
            const slug = normalizeCategory(cat);
            const checked = selectedCategories.includes(slug);
            return (
              <label key={slug} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${checked ? 'bg-amber-50 border-amber-300 text-amber-900' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                <input
                  type="checkbox"
                  className="accent-amber-600"
                  checked={checked}
                  onChange={() => toggleCategory(cat)}
                />
                <span className="text-sm">{cat}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Metal</div>
        <div className="flex flex-wrap gap-2">
          {metalOptions.map((m) => (
            <button
              key={m}
              type="button"
              className={`px-3 py-1.5 rounded-full border text-sm ${selectedMetal.toLowerCase()===m.toLowerCase() ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setSelectedMetal(prev => prev.toLowerCase()===m.toLowerCase() ? '' : m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Price</div>
        <div className="flex flex-col gap-2">
          {priceOptions.map((p) => {
            const slug = priceLabelToSlug(p);
            const checked = selectedPrice === slug;
            return (
              <label key={p} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${checked ? 'bg-green-50 border-green-300 text-green-900' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                <input
                  type="radio"
                  name="price"
                  className="accent-green-600"
                  checked={checked}
                  onChange={() => setSelectedPrice(slug)}
                />
                <span className="text-sm">{p}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Promo / Featured */}
      <div className="hidden md:flex flex-col gap-3">
        {promo ? (
          <>
            <img src={promo.image} alt={promo.title} className="w-full h-28 object-cover rounded-lg" />
            <div className="text-sm font-medium text-gray-900">{promo.title}</div>
            <a className="inline-flex items-center gap-1 text-brand-burgundy text-sm no-underline hover:underline" href={promo.href}>
              {promo.cta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </a>
          </>
        ) : (
          <>
            <img src="/Slide1.jpg" alt="Featured" className="w-full h-28 object-cover rounded-lg" />
            <div className="text-sm font-medium text-gray-900">New Arrivals</div>
            <a className="inline-flex items-center gap-1 text-brand-burgundy text-sm no-underline hover:underline" href="/products">
              Shop Now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </a>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="md:col-span-3 flex items-center justify-end gap-3">
        <button onClick={clearFilters} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50">Clear</button>
        <button onClick={applyFilters} className="px-4 py-2 rounded-md bg-brand-burgundy text-white hover:opacity-90">Apply Filters</button>
      </div>
    </div>
  );
};

export default MegaMenuFilter;