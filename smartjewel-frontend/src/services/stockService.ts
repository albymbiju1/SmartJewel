import { api } from '../api';

export interface StockInfo {
  sku: string;
  quantity: number;
  status: 'available' | 'limited' | 'out_of_stock';
  displayText: string;
}

export interface ProductWithStock {
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
  quantity: number;
  stockStatus: 'available' | 'limited' | 'out_of_stock';
  stockDisplayText: string;
}

class StockService {
  private stockCache: Map<string, StockInfo> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get stock information for a product by SKU
   */
  async getStockInfo(sku: string): Promise<StockInfo> {
    // Check cache first
    const cached = this.stockCache.get(sku);
    const cacheTime = this.cacheExpiry.get(sku);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
      return cached;
    }

    try {
      // Fetch fresh stock data from backend using the public products endpoint
      const response = await api.get('/inventory/products');
      const products = response.data.products || [];
      
      // Update cache with all products
      products.forEach((product: any) => {
        const stockInfo = this.calculateStockStatus(product.quantity || 0);
        this.stockCache.set(product.sku, stockInfo);
        this.cacheExpiry.set(product.sku, Date.now());
      });

      // Return the requested product's stock info
      const stockInfo = this.stockCache.get(sku);
      if (stockInfo) {
        return stockInfo;
      }

      // If product not found in stock data, assume out of stock
      return this.calculateStockStatus(0);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      // Return cached data if available, otherwise assume out of stock
      return cached || this.calculateStockStatus(0);
    }
  }

  /**
   * Get stock information for multiple products
   */
  async getBulkStockInfo(skus: string[]): Promise<Map<string, StockInfo>> {
    const result = new Map<string, StockInfo>();
    
    // Check cache for all SKUs first
    const uncachedSkus: string[] = [];
    skus.forEach(sku => {
      const cached = this.stockCache.get(sku);
      const cacheTime = this.cacheExpiry.get(sku);
      
      if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
        result.set(sku, cached);
      } else {
        uncachedSkus.push(sku);
      }
    });

    // Fetch fresh data if needed
    if (uncachedSkus.length > 0) {
      try {
        const response = await api.get('/inventory/products');
        const products = response.data.products || [];
        
        // Update cache and result
        products.forEach((product: any) => {
          const stockInfo = this.calculateStockStatus(product.quantity || 0);
          this.stockCache.set(product.sku, stockInfo);
          this.cacheExpiry.set(product.sku, Date.now());
          
          if (uncachedSkus.includes(product.sku)) {
            result.set(product.sku, stockInfo);
          }
        });
      } catch (error) {
        console.error('Failed to fetch bulk stock data:', error);
      }
    }

    return result;
  }

  /**
   * Calculate stock status based on quantity
   */
  calculateStockStatus(quantity: number): StockInfo {
    let status: 'available' | 'limited' | 'out_of_stock';
    let displayText: string;

    if (quantity <= 0) {
      status = 'out_of_stock';
      displayText = 'Out of Stock';
    } else if (quantity <= 5) {
      status = 'limited';
      displayText = `Limited Stock (${quantity} left)`;
    } else {
      status = 'available';
      displayText = `Available (${quantity} left)`;
    }

    return {
      sku: '',
      quantity,
      status,
      displayText
    };
  }

  /**
   * Check if a product is available for purchase
   */
  isAvailableForPurchase(quantity: number): boolean {
    return quantity > 0;
  }

  /**
   * Get stock status for display
   */
  getStockStatus(quantity: number): 'available' | 'limited' | 'out_of_stock' {
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= 5) return 'limited';
    return 'available';
  }

  /**
   * Get stock display text
   */
  getStockDisplayText(quantity: number): string {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity <= 5) return `Limited Stock (${quantity} left)`;
    return `Available (${quantity} left)`;
  }

  /**
   * Clear cache (useful for testing or when stock is updated)
   */
  clearCache(): void {
    this.stockCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Clear cache for specific SKU
   */
  clearCacheForSku(sku: string): void {
    this.stockCache.delete(sku);
    this.cacheExpiry.delete(sku);
  }
}

export const stockService = new StockService();
