import React, { useState, useEffect } from 'react';
import { priceUpdateService, PriceUpdateResult, PriceUpdateHistory } from '../services/priceUpdateService';

interface PriceUpdateManagerProps {
  className?: string;
}

export const PriceUpdateManager: React.FC<PriceUpdateManagerProps> = ({ className = '' }) => {
  const [lastUpdate, setLastUpdate] = useState<PriceUpdateHistory | null>(null);
  const [history, setHistory] = useState<PriceUpdateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<PriceUpdateResult | null>(null);
  const [showDryRun, setShowDryRun] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lastUpdateData, historyData] = await Promise.all([
        priceUpdateService.getLastPriceUpdate(),
        priceUpdateService.getPriceUpdateHistory()
      ]);
      setLastUpdate(lastUpdateData);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load price update data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdatePrices = async (dryRun: boolean = false) => {
    try {
      setUpdating(true);
      const result = await priceUpdateService.updateProductPrices(dryRun);
      
      if (dryRun) {
        setDryRunResult(result);
        setShowDryRun(true);
      } else {
        // Reload data after successful update
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update prices:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRefreshGoldRates = async () => {
    try {
      setUpdating(true);
      const result = await priceUpdateService.refreshGoldRatesAndUpdatePrices();
      
      // Reload data after successful update
      await loadData();
      
      // Show success message
      alert(`Gold rates refreshed and ${result.price_update.updated_count} products updated successfully!`);
    } catch (error) {
      console.error('Failed to refresh gold rates:', error);
      alert('Failed to refresh gold rates and update prices. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const isUpdateNeeded = lastUpdate ? priceUpdateService.isUpdateNeeded(lastUpdate.timestamp) : true;

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Price Update Manager</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automatically update product prices based on current gold rates
          </p>
        </div>
        
        {isUpdateNeeded && (
          <div className="flex items-center text-orange-600">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Update Recommended</span>
          </div>
        )}
      </div>

      {/* Last Update Status */}
      {lastUpdate && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Last Update</h4>
              <p className="text-sm text-gray-600">
                {priceUpdateService.getTimeSinceUpdate(lastUpdate.timestamp)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {lastUpdate.updated_count} products updated
              </div>
              <div className={`text-sm font-medium ${lastUpdate.success ? 'text-green-600' : 'text-red-600'}`}>
                {lastUpdate.success ? 'Success' : 'Failed'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => handleRefreshGoldRates()}
          disabled={updating}
          className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg 
            className={`w-5 h-5 mr-2 ${updating ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {updating ? 'Updating...' : 'Refresh Gold Rates & Update Prices'}
        </button>

        <button
          onClick={() => handleUpdatePrices(false)}
          disabled={updating}
          className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg 
            className={`w-5 h-5 mr-2 ${updating ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {updating ? 'Updating...' : 'Update Prices Now'}
        </button>

        <button
          onClick={() => handleUpdatePrices(true)}
          disabled={updating}
          className="flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Preview Changes
        </button>
      </div>

      {/* Dry Run Results */}
      {showDryRun && dryRunResult && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900">Preview Results</h4>
            <button
              onClick={() => setShowDryRun(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{dryRunResult.updated_count}</div>
              <div className="text-sm text-blue-700">Products to Update</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{dryRunResult.skipped_count}</div>
              <div className="text-sm text-gray-700">No Change Needed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{dryRunResult.error_count}</div>
              <div className="text-sm text-red-700">Errors</div>
            </div>
          </div>

          {dryRunResult.updated_products && dryRunResult.updated_products.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <h5 className="font-medium text-blue-900 mb-2">Sample Changes:</h5>
              <div className="space-y-2">
                {dryRunResult.updated_products.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-gray-600">{product.sku} • {product.purity} • {product.weight}{product.weight_unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        ₹{product.old_price.toLocaleString()} → ₹{product.new_price.toLocaleString()}
                      </div>
                      <div className={`text-xs font-medium ${product.price_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {priceUpdateService.formatPriceChange(product.price_change)}
                      </div>
                    </div>
                  </div>
                ))}
                {dryRunResult.updated_products.length > 5 && (
                  <div className="text-center text-sm text-gray-600">
                    ... and {dryRunResult.updated_products.length - 5} more products
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setShowDryRun(false);
                handleUpdatePrices(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply Changes
            </button>
          </div>
        </div>
      )}

      {/* Update History */}
      {history.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Updates</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.slice(0, 10).map((update, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${update.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">
                      {priceUpdateService.getTimeSinceUpdate(update.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 ml-4">
                    {update.updated_count} updated • {update.skipped_count} skipped
                    {update.error_count > 0 && ` • ${update.error_count} errors`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(update.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h5 className="text-sm font-medium text-blue-900">How it works</h5>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Prices are calculated based on current gold rates and product weight</li>
              <li>• Purity conversions: 24K (100%), 22K (91.6%), 18K (75%), 14K (58.5%)</li>
              <li>• Existing making charges, stone charges, and GST are preserved</li>
              <li>• Updates run automatically when gold rates are refreshed (twice daily)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

