import { api } from '../api';

export interface PriceUpdateResult {
  success: boolean;
  updated_count: number;
  error_count: number;
  skipped_count: number;
  errors: string[];
  start_time: string;
  end_time: string;
  gold_rates: Record<string, number>;
  updated_products?: Array<{
    product_id: string;
    sku: string;
    name: string;
    old_price: number;
    new_price: number;
    price_change: number;
    purity: string;
    weight: number;
    weight_unit: string;
  }>;
  dry_run: boolean;
}

export interface PriceUpdateHistory {
  _id: string;
  operation: string;
  timestamp: string;
  success: boolean;
  updated_count: number;
  error_count: number;
  skipped_count: number;
  gold_rates: Record<string, number>;
  errors: string[];
  updated_products: any[];
}

class PriceUpdateService {
  /**
   * Manually trigger product price updates
   */
  async updateProductPrices(dryRun: boolean = false): Promise<PriceUpdateResult> {
    try {
      const response = await api.post('/market/update-product-prices', {
        dry_run: dryRun
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update product prices:', error);
      throw new Error('Failed to update product prices. Please try again.');
    }
  }

  /**
   * Get price update history
   */
  async getPriceUpdateHistory(): Promise<PriceUpdateHistory[]> {
    try {
      const response = await api.get('/market/price-update-history');
      return response.data.history;
    } catch (error) {
      console.error('Failed to fetch price update history:', error);
      throw new Error('Failed to fetch price update history.');
    }
  }

  /**
   * Get last successful price update
   */
  async getLastPriceUpdate(): Promise<PriceUpdateHistory | null> {
    try {
      const response = await api.get('/market/last-price-update');
      return response.data.last_update;
    } catch (error) {
      console.error('Failed to fetch last price update:', error);
      return null;
    }
  }

  /**
   * Refresh gold rates and automatically update prices
   */
  async refreshGoldRatesAndUpdatePrices(): Promise<{
    rates: Record<string, number>;
    updated_at: string;
    price_update: {
      success: boolean;
      updated_count: number;
      error_count: number;
      skipped_count: number;
      errors?: string[];
    };
  }> {
    try {
      const response = await api.post('/market/refresh-gold-rate');
      return response.data;
    } catch (error) {
      console.error('Failed to refresh gold rates and update prices:', error);
      throw new Error('Failed to refresh gold rates and update prices.');
    }
  }

  /**
   * Format price change for display
   */
  formatPriceChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}₹${change.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }

  /**
   * Get time since last update in human readable format
   */
  getTimeSinceUpdate(timestamp: string): string {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now.getTime() - updated.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Check if price update is needed (data is stale)
   */
  isUpdateNeeded(lastUpdate: string | null): boolean {
    if (!lastUpdate) return true;
    
    const now = new Date();
    const updated = new Date(lastUpdate);
    const diffMs = now.getTime() - updated.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Consider update needed if more than 12 hours old
    return diffHours > 12;
  }
}

// Export singleton instance
export const priceUpdateService = new PriceUpdateService();

