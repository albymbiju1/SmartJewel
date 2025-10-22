import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { catalogService, CatalogItem } from '../../services/catalogService';
import { SearchBar } from '../../components/SearchBar';
import { FiltersPanel, FiltersState } from '../../components/FiltersPanel';
import { API_BASE_URL } from '../../api';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export const AdvancedSearchPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();

  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<number>(Number(query.get('page') || 1));
  const [perPage, setPerPage] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);

  const q = (query.get('q') || '').trim();

  // Version timestamp for cache busting
  const imageVersion = useMemo(() => Date.now(), []);
  
  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return '';
    const baseUrl = imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}${imagePath}`;
    if (!imagePath.startsWith('http')) {
      return `${baseUrl}?v=${imageVersion}`;
    }
    return baseUrl;
  };

  const filters: FiltersState = useMemo(() => ({
    min_price: query.get('min_price') ? Number(query.get('min_price')) : undefined,
    max_price: query.get('max_price') ? Number(query.get('max_price')) : undefined,
    min_weight: query.get('min_weight') ? Number(query.get('min_weight')) : undefined,
    max_weight: query.get('max_weight') ? Number(query.get('max_weight')) : undefined,
    metal: query.get('metal') ? query.get('metal')!.split(',') : undefined,
    purity: query.get('purity') ? query.get('purity')!.split(',') : undefined,
  }), [query]);

  // Sync page from query
  useEffect(() => {
    setPage(Number(query.get('page') || 1));
  }, [query]);

  const applyFiltersToUrl = (next: Partial<FiltersState & { page?: number }>) => {
    const sp = new URLSearchParams(query.toString());
    const setOrDel = (k: string, v: any) => {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) sp.delete(k);
      else sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
    };
    if ('min_price' in next) setOrDel('min_price', next.min_price);
    if ('max_price' in next) setOrDel('max_price', next.max_price);
    if ('min_weight' in next) setOrDel('min_weight', next.min_weight);
    if ('max_weight' in next) setOrDel('max_weight', next.max_weight);
    if ('metal' in next) setOrDel('metal', next.metal);
    if ('purity' in next) setOrDel('purity', next.purity);
    setOrDel('page', next.page ?? 1);
    navigate(`/search?${sp.toString()}`);
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = {
          q: q || undefined,
          min_price: filters.min_price,
          max_price: filters.max_price,
          min_weight: filters.min_weight,
          max_weight: filters.max_weight,
          metal: filters.metal,
          purity: filters.purity,
          page,
          per_page: perPage,
        } as any;
        const res = await catalogService.search(params);
        setResults(res.results || []);
        setTotal(res.pagination?.total || 0);
      } catch (e) {
        console.error('search failed', e);
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [q, page, perPage, filters.min_price, filters.max_price, filters.min_weight, filters.max_weight, (filters.metal||[]).join(','), (filters.purity||[]).join(',')]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={()=>navigate('/')} className="text-gray-700 hover:text-blue-600">Home</button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 font-medium">Search</span>
          <div className="flex-1" />
          <div className="w-full max-w-xl"><SearchBar placeholder="Search jewellery…" /></div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters */}
        <aside className="lg:col-span-1">
          <div className="card p-4">
            <div className="text-lg font-semibold mb-3">Filters</div>
            <FiltersPanel
              value={filters}
              onChange={(next)=>{ applyFiltersToUrl({ ...next, page: 1 }); }}
            />
          </div>
        </aside>

        {/* Results */}
        <main className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-700 text-sm">{total} results</div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Per page</label>
              <select value={perPage} onChange={(e)=>setPerPage(Number(e.target.value))} className="border border-gray-200 rounded-md px-2 py-1 text-sm">
                {[12,20,40,60].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No products match your filters</h3>
              <p className="text-gray-500">Try broadening your search or clearing some filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((p) => (
                  <div key={p._id} className="card overflow-hidden hover:shadow-elevated transition-shadow">
                    <div className="aspect-square bg-gray-100">
                      {p.image ? (
                        <img src={getImageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-sm text-gray-500">{p.category}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{p.metal} - {p.purity}</span>
                        {p.weight ? <span className="text-xs text-gray-500">{p.weight}{p.weight_unit || 'g'}</span> : null}
                      </div>
                      {p.price != null && (
                        <div className="mt-2 text-lg font-bold text-gray-900">₹{Number(p.price).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-center gap-2">
                <button disabled={page<=1} onClick={()=>applyFiltersToUrl({ page: page-1 })} className={`px-3 py-1.5 rounded border ${page<=1?'text-gray-300 border-gray-100':'text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Prev</button>
                {Array.from({length: Math.min(5, totalPages)}).map((_,i)=>{
                  const pnum = i+1;
                  return <button key={pnum} onClick={()=>applyFiltersToUrl({ page: pnum })} className={`px-3 py-1.5 rounded border ${pnum===page?'bg-gray-900 text-white':'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{pnum}</button>;
                })}
                <button disabled={page>=totalPages} onClick={()=>applyFiltersToUrl({ page: page+1 })} className={`px-3 py-1.5 rounded border ${page>=totalPages?'text-gray-300 border-gray-100':'text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Next</button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdvancedSearchPage;
