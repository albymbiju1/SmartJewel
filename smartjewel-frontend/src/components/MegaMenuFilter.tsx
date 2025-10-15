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
  'Under 25k', '25k – 50k', '50k – 100k', '100k & above'
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
  const initialPurity = params.get('purity') || '';
  // colour removed
  const hasPriceInUrl = useMemo(() => params.has('price'), [params]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [selectedMetal, setSelectedMetal] = useState<string>(initialMetal || (presetMetal || ''));
  const [selectedPrice, setSelectedPrice] = useState<string>(''); // do not default select price
  const [selectedPurities, setSelectedPurities] = useState<string[]>(initialPurity ? initialPurity.split(',') : []);

  // Keep state in sync if URL changes while menu is open
  useEffect(() => {
    setSelectedCategories(initialCategories);
    // Metal: prefer URL, otherwise preset if provided
    setSelectedMetal(initialMetal || (presetMetal || ''));
    // Price: only set from URL; otherwise keep empty (no default selection)
    setSelectedPrice(hasPriceInUrl ? initialPrice : '');
    setSelectedPurities(initialPurity ? initialPurity.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategories.join(','), initialMetal, initialPrice, initialPurity, hasPriceInUrl, presetMetal]);

  const toggleCategory = (label: string) => {
    const slug = normalizeCategory(label);
    setSelectedCategories(prev => prev.includes(slug) ? prev.filter(c => c !== slug) : [...prev, slug]);
  };

  const applyFilters = () => {
    const search = new URLSearchParams();
    if (selectedCategories.length) search.set('categories', selectedCategories.join(','));
    if (selectedMetal) search.set('metal', selectedMetal.toLowerCase());
    if (selectedPrice) search.set('price', selectedPrice);
    if (selectedPurities.length) search.set('purity', selectedPurities.map(p => p.toLowerCase()).join(','));
    navigate(`/products?${search.toString()}`);
    onApplied?.();
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedMetal('');
    setSelectedPrice('');
    setSelectedPurities([]);
  };

  return (
    <div className="p-6 pb-24 bg-white border border-gray-200 rounded-xl shadow-2xl items-start md:grid md:[grid-template-columns:11rem_1fr] md:gap-6">
      {/* Left: Shop by Category (fixed width) */}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Category</div>
        <div className="grid grid-cols-1 gap-1 pr-1">
          {categoryOptions.map((cat) => {
            const slug = normalizeCategory(cat);
            const checked = selectedCategories.includes(slug);
            return (
              <label key={slug} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer border w-full ${checked ? 'bg-amber-50 border-amber-300 text-amber-900' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                <input
                  type="checkbox"
                  className="accent-amber-600 shrink-0"
                  checked={checked}
                  onChange={() => toggleCategory(cat)}
                />
                <span className="text-sm leading-snug whitespace-nowrap overflow-hidden text-ellipsis flex-1" title={cat}>{cat}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Right: Purity -> Price -> Metal (flexible) */}
      <div className="min-w-0 flex flex-col gap-6">
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Purity</div>
          <div className="flex flex-wrap gap-2">
            {['22K','18K','14K'].map(p => {
              const checked = selectedPurities.includes(p);
              return (
                <label key={p} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${checked? 'bg-gray-100 border-gray-300 text-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                  <input type="checkbox" className="hidden" checked={checked} onChange={() => {
                    const next = checked ? selectedPurities.filter(x=>x!==p) : [...selectedPurities, p];
                    setSelectedPurities(next);
                  }} />
                  {p}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900 mb-3">Shop by Price</div>
          <div className="flex flex-col gap-2">
            {priceOptions.map((p) => {
              const slug = priceLabelToSlug(p);
              const checked = selectedPrice === slug;
              return (
                <label key={p} className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer border w-full ${checked ? 'bg-green-50 border-green-300 text-green-900' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                  <input
                    type="radio"
                    name="price"
                    className="accent-green-600 shrink-0"
                    checked={checked}
                    onChange={() => setSelectedPrice(slug)}
                  />
                  <span className="text-sm leading-snug whitespace-nowrap overflow-hidden text-ellipsis flex-1" title={p}>{p}</span>
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
      </div>

      

      {/* Actions (sticky footer) */}
      <div className="sticky bottom-0 z-10 bg-white pt-3 mt-2 border-t border-gray-200 flex items-center justify-end gap-3 md:col-span-2">
        <button onClick={clearFilters} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50">Clear</button>
        <button onClick={applyFilters} className="px-4 py-2 rounded-md bg-brand-burgundy text-white hover:opacity-90">Apply Filters</button>
      </div>
    </div>
  );
};

export default MegaMenuFilter;