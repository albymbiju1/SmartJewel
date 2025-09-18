import { api } from '../api';

export interface ProductPrice {
  productId: string;
  currentPrice: number;
  computedPrice?: number;
  lastUpdated?: string;
}

class ProductPriceService {
  private priceCache: Map<string, ProductPrice> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current price for a product
   */
  async getCurrentPrice(productId: string): Promise<number | null> {
    try {
      // Check cache first
      const cached = this.getCachedPrice(productId);
      if (cached) {
        return cached;
      }

      // Fetch fresh price from API
      const response = await api.get(`/inventory/items/${productId}`);
      const product = response.data.item;
      
      // Use computed_price if available, otherwise use price
      const currentPrice = product.computed_price || product.price || 0;
      
      // Cache the result
      this.cachePrice(productId, currentPrice);
      
      return currentPrice;
    } catch (error) {
      console.warn(`Failed to fetch price for product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get current prices for multiple products
   */
  async getCurrentPrices(productIds: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const uncachedIds: string[] = [];

    // Check cache for each product
    for (const productId of productIds) {
      const cached = this.getCachedPrice(productId);
      if (cached !== null) {
        prices.set(productId, cached);
      } else {
        uncachedIds.push(productId);
      }
    }

    // Fetch uncached prices in parallel
    if (uncachedIds.length > 0) {
      const pricePromises = uncachedIds.map(async (productId) => {
        try {
          const response = await api.get(`/inventory/items/${productId}`);
          const product = response.data.item;
          const currentPrice = product.computed_price || product.price || 0;
          
          this.cachePrice(productId, currentPrice);
          return { productId, price: currentPrice };
        } catch (error) {
          console.warn(`Failed to fetch price for product ${productId}:`, error);
          return { productId, price: 0 };
        }
      });

      const results = await Promise.all(pricePromises);
      results.forEach(({ productId, price }) => {
        prices.set(productId, price);
      });
    }

    return prices;
  }

  /**
   * Get cached price if still valid
   */
  private getCachedPrice(productId: string): number | null {
    const expiry = this.cacheExpiry.get(productId);
    if (expiry && Date.now() < expiry) {
      const cached = this.priceCache.get(productId);
      return cached ? cached.currentPrice : null;
    }
    return null;
  }

  /**
   * Cache a price with expiry
   */
  private cachePrice(productId: string, price: number): void {
    this.priceCache.set(productId, {
      productId,
      currentPrice: price,
      lastUpdated: new Date().toISOString()
    });
    this.cacheExpiry.set(productId, Date.now() + this.CACHE_DURATION);
  }

  /**
   * Clear cache for a specific product (useful when prices are updated)
   */
  clearProductCache(productId: string): void {
    this.priceCache.delete(productId);
    this.cacheExpiry.delete(productId);
  }

  /**
   * Clear all cached prices
   */
  clearAllCache(): void {
    this.priceCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }
}

// Export singleton instance
export const productPriceService = new ProductPriceService();

