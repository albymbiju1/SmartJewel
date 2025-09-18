import { api } from '../api';

export interface GoldRates {
  '24k': number;
  '22k': number;
  '18k': number;
  '14k': number;
}

export interface GoldPriceData {
  rates: GoldRates;
  updated_at: string;
  last_fetch_attempt?: string;
  fetch_error?: string;
}

class GoldPriceService {
  private cache: GoldPriceData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private retryCount = 0;

  /**
   * Get gold rates with caching mechanism
   * Fetches from API only twice per day (morning and evening)
   */
  async getGoldRates(forceRefresh: boolean = false): Promise<GoldPriceData> {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;

    // Check if we should fetch new data
    const shouldFetch = forceRefresh || 
                       !this.cache || 
                       timeSinceLastFetch >= this.CACHE_DURATION ||
                       this.retryCount < this.MAX_RETRY_ATTEMPTS;

    if (shouldFetch) {
      try {
        const freshData = await this.fetchFromAPI();
        this.cache = freshData;
        this.lastFetchTime = now;
        this.retryCount = 0; // Reset retry count on successful fetch
        
        // Store in localStorage as backup
        this.storeInLocalStorage(freshData);
        
        return freshData;
      } catch (error) {
        this.retryCount++;
        console.warn(`Gold price fetch attempt ${this.retryCount} failed:`, error);
        
        // Return cached data if available, otherwise return error data
        if (this.cache) {
          return {
            ...this.cache,
            fetch_error: `API fetch failed (attempt ${this.retryCount}). Showing cached data.`
          };
        }
        
        // Try to get from localStorage as fallback
        const localStorageData = this.getFromLocalStorage();
        if (localStorageData) {
          return {
            ...localStorageData,
            fetch_error: `API unavailable. Showing last known data from ${new Date(localStorageData.updated_at).toLocaleString()}.`
          };
        }
        
        // Return error state
        return {
          rates: { '24k': 0, '22k': 0, '18k': 0, '14k': 0 },
          updated_at: new Date().toISOString(),
          fetch_error: 'Unable to fetch gold prices. Please check your connection and try again.'
        };
      }
    }

    // Return cached data
    return this.cache || this.getFromLocalStorage() || {
      rates: { '24k': 0, '22k': 0, '18k': 0, '14k': 0 },
      updated_at: new Date().toISOString(),
      fetch_error: 'No cached data available.'
    };
  }

  /**
   * Force refresh gold rates from API
   */
  async refreshGoldRates(): Promise<GoldPriceData> {
    try {
      const response = await api.post('/market/refresh-gold-rate');
      const freshData: GoldPriceData = {
        rates: response.data.rates,
        updated_at: response.data.updated_at
      };
      
      this.cache = freshData;
      this.lastFetchTime = Date.now();
      this.retryCount = 0;
      
      // Store in localStorage
      this.storeInLocalStorage(freshData);
      
      return freshData;
    } catch (error) {
      console.error('Failed to refresh gold rates:', error);
      throw new Error('Failed to refresh gold rates. Please try again later.');
    }
  }

  /**
   * Fetch gold rates from the API
   */
  private async fetchFromAPI(): Promise<GoldPriceData> {
    const response = await api.get('/market/gold-rate');
    return {
      rates: response.data.rates,
      updated_at: response.data.updated_at
    };
  }

  /**
   * Store data in localStorage as backup
   */
  private storeInLocalStorage(data: GoldPriceData): void {
    try {
      localStorage.setItem('smartjewel_gold_rates', JSON.stringify({
        ...data,
        stored_at: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to store gold rates in localStorage:', error);
    }
  }

  /**
   * Get data from localStorage
   */
  private getFromLocalStorage(): GoldPriceData | null {
    try {
      const stored = localStorage.getItem('smartjewel_gold_rates');
      if (stored) {
        const data = JSON.parse(stored);
        // Check if data is not too old (max 7 days)
        const storedAt = new Date(data.stored_at);
        const daysSinceStored = (Date.now() - storedAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceStored <= 7) {
          return {
            rates: data.rates,
            updated_at: data.updated_at
          };
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve gold rates from localStorage:', error);
    }
    return null;
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

  /**
   * Get time since last update in human readable format
   */
  getTimeSinceUpdate(updatedAt: string): string {
    const now = new Date();
    const updated = new Date(updatedAt);
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
   * Check if data is stale (older than 12 hours)
   */
  isDataStale(updatedAt: string): boolean {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    return diffMs >= this.CACHE_DURATION;
  }
}

// Export singleton instance
export const goldPriceService = new GoldPriceService();

