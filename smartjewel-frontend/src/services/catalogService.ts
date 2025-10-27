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
  category?: string; // single category
  categories?: string[]; // multiple categories, comma-joined in request
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'weight_asc' | 'weight_desc' | 'newest';
  page?: number;
  per_page?: number;
  client_id?: string; // for anonymous recent searches
  // Additional filter parameters
  color?: string[]; // comma-joined in request
  style?: string[]; // comma-joined in request
  earringType?: string[]; // comma-joined in request
  occasion?: string[]; // comma-joined in request
  for?: string[]; // comma-joined in request
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
  if (params.purity?.length) {
    console.log('Purity params being sent:', params.purity);
    q.set('purity', params.purity.join(','));
  }
  if (params.min_weight != null) q.set('min_weight', String(params.min_weight));
  if (params.max_weight != null) q.set('max_weight', String(params.max_weight));
  // Handle both single category and multiple categories
  if (params.category) q.set('category', params.category);
  if (params.categories?.length) q.set('categories', params.categories.join(','));
  if (params.sort) q.set('sort', params.sort);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', String(params.per_page));
  if (params.client_id) q.set('client_id', params.client_id);
  // Additional filter parameters
  if (params.color?.length) q.set('color', params.color.join(','));
  if (params.style?.length) q.set('style', params.style.join(','));
  if (params.earringType?.length) q.set('earringType', params.earringType.join(','));
  if (params.occasion?.length) q.set('occasion', params.occasion.join(','));
  if (params.for?.length) q.set('for', params.for.join(','));
  return q;
}

export const catalogService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const qs = toQuery(params).toString();
    console.log('Catalog search request:', `/catalog/search${qs ? `?${qs}` : ''}`);
    const { data } = await api.get(`/catalog/search${qs ? `?${qs}` : ''}`);
    console.log('Catalog search response:', data);
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
