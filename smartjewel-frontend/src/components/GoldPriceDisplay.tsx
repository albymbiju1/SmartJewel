import React, { useState, useEffect } from 'react';
import { goldPriceService, GoldPriceData } from '../services/goldPriceService';
import { priceUpdateService } from '../services/priceUpdateService';

interface GoldPriceDisplayProps {
  className?: string;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export const GoldPriceDisplay: React.FC<GoldPriceDisplayProps> = ({ 
  className = '', 
  showRefreshButton = true,
  compact = false 
}) => {
  const [goldData, setGoldData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<any>(null);

  const loadGoldRates = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const data = await goldPriceService.getGoldRates(forceRefresh);
      setGoldData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gold prices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const data = await priceUpdateService.refreshGoldRatesAndUpdatePrices();
      setGoldData({
        rates: data.rates,
        updated_at: data.updated_at
      });
      
      // Show price update notification
      if (data.price_update.success) {
        console.log(`Gold rates refreshed and ${data.price_update.updated_count} products updated`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh gold prices');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadGoldRates();
    // Load last price update info
    priceUpdateService.getLastPriceUpdate().then(setLastPriceUpdate);
  }, []);

  if (loading && !goldData) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 rounded h-16"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !goldData) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Gold Prices</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadGoldRates(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!goldData) return null;

  const isStale = goldData.updated_at ? goldPriceService.isDataStale(goldData.updated_at) : false;
  const timeSinceUpdate = goldData.updated_at ? goldPriceService.getTimeSinceUpdate(goldData.updated_at) : 'Unknown';

  const purityCards = [
    { key: '24k' as const, label: '24K Gold', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-900', valueColor: 'text-yellow-600' },
    { key: '22k' as const, label: '22K Gold', color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-900', valueColor: 'text-amber-600' },
    { key: '18k' as const, label: '18K Gold', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', valueColor: 'text-orange-600' },
    { key: '14k' as const, label: '14K Gold', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', valueColor: 'text-red-600' },
  ];

  if (compact) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Gold Prices</h3>
          {showRefreshButton && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              title="Refresh gold prices"
            >
              <svg 
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {purityCards.map(({ key, label, color, textColor, valueColor }) => (
            <div key={key} className={`${color} border rounded-lg p-3`}>
              <div className={`text-sm font-medium ${textColor}`}>{label}</div>
              <div className={`text-lg font-bold ${valueColor} mt-1`}>
                {goldPriceService.formatPrice(goldData.rates[key])}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
          <span>Updated {timeSinceUpdate}</span>
          {isStale && (
            <span className="text-orange-600 flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Data may be stale
            </span>
          )}
        </div>
        
        {goldData.fetch_error && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            {goldData.fetch_error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Live Gold Prices</h3>
          <p className="text-sm text-gray-600 mt-1">
            Current market rates per gram • Updated {timeSinceUpdate}
          </p>
        </div>
        
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {purityCards.map(({ key, label, color, textColor, valueColor }) => (
          <div key={key} className={`${color} border rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`text-sm font-medium ${textColor}`}>{label}</div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            </div>
            <div className={`text-2xl font-bold ${valueColor}`}>
              {goldPriceService.formatPrice(goldData.rates[key])}
            </div>
            <div className={`text-xs ${textColor} opacity-75 mt-1`}>per gram</div>
          </div>
        ))}
      </div>

      {/* Status indicators */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          {isStale && (
            <div className="flex items-center text-orange-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Data may be stale
            </div>
          )}
          
          <div className="flex items-center text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-refreshes twice daily
          </div>
        </div>
        
        <div className="text-gray-500">
          Source: GoldAPI.io
        </div>
      </div>

      {goldData.fetch_error && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-sm font-medium text-yellow-800">Notice</div>
              <div className="text-sm text-yellow-700 mt-1">{goldData.fetch_error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
