import { api } from '../api';

export type MetalType = 'Gold' | 'Silver' | 'Platinum' | 'Diamond' | string;
export type PurityType = '24k' | '22k' | '18k' | '14k' | string;

export interface SearchParams {
  q?: string;
  min_price?: number;
  max_price?: number;
  metal?: string[]; // comma-joined in request
  purity?: string[]; // comma-joined in request
  min_weight?: number;
  max_weight?: number;
  category?: string;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'weight_asc' | 'weight_desc' | 'newest';
  page?: number;
  per_page?: number;
  client_id?: string; // for anonymous recent searches
}

export interface CatalogItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  metal: string;
  purity: string;
  weight?: number;
  weight_unit?: string;
  price?: number;
  image?: string;
  updated_at?: string;
  quantity?: number;
  score?: number;
}

export interface SearchResponse {
  results: CatalogItem[];
  pagination: { page: number; per_page: number; total: number; total_pages: number };
}

function toQuery(params: SearchParams): URLSearchParams {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.min_price != null) q.set('min_price', String(params.min_price));
  if (params.max_price != null) q.set('max_price', String(params.max_price));
  if (params.metal?.length) q.set('metal', params.metal.join(','));
  if (params.purity?.length) q.set('purity', params.purity.join(','));
  if (params.min_weight != null) q.set('min_weight', String(params.min_weight));
  if (params.max_weight != null) q.set('max_weight', String(params.max_weight));
  if (params.category) q.set('category', params.category);
  if (params.sort) q.set('sort', params.sort);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', String(params.per_page));
  if (params.client_id) q.set('client_id', params.client_id);
  return q;
}

export const catalogService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const qs = toQuery(params).toString();
    const { data } = await api.get(`/catalog/search${qs ? `?${qs}` : ''}`);
    return data as SearchResponse;
  },
  async suggestions(q: string, limit = 7): Promise<string[]> {
    const { data } = await api.get('/catalog/suggestions', { params: { q, limit } });
    return data?.suggestions || [];
  },
  async recent(client_id?: string): Promise<{ term: string; filters: Record<string, any>; ts: string }[]> {
    const { data } = await api.get('/catalog/recent-searches', { params: { client_id } });
    return data?.recent || [];
  },
  async saveRecent(term: string, filters?: Record<string, any>) {
    await api.post('/catalog/recent-searches', { term, filters });
  }
};
