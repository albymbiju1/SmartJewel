import React, { useState } from 'react';
import { api } from '../api';

interface CalculationResult {
  final_price: number;
  breakdown: {
    gold_cost: number;
    making_charges: number;
    subtotal: number;
    gst_percent: number;
    gst_amount: number;
    purity_factor: number;
  };
  inputs: {
    price_24k_per_gram: number;
    weight_grams: number;
    karat: number;
    making_charge_type: string;
    making_charge_value: number;
    gst_percent: number;
  };
}

export const GoldPriceCalculator: React.FC = () => {
  const [inputs, setInputs] = useState({
    price_24k_per_gram: 6000,
    weight_grams: 5,
    karat: 22,
    making_charge_type: 'percent',
    making_charge_value: 12,
    gst_percent: 3
  });
  
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculatePrice = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/market/calculate-gold-price', inputs);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to calculate price');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Gold Price Calculator</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Input Parameters</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              24K Gold Rate per Gram (₹)
            </label>
            <input
              type="number"
              value={inputs.price_24k_per_gram}
              onChange={(e) => handleInputChange('price_24k_per_gram', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight (grams)
            </label>
            <input
              type="number"
              value={inputs.weight_grams}
              onChange={(e) => handleInputChange('weight_grams', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Karat
            </label>
            <select
              value={inputs.karat}
              onChange={(e) => handleInputChange('karat', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={24}>24K (100%)</option>
              <option value={22}>22K (91.6%)</option>
              <option value={18}>18K (75%)</option>
              <option value={14}>14K (58.5%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Making Charge Type
            </label>
            <select
              value={inputs.making_charge_type}
              onChange={(e) => handleInputChange('making_charge_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percent">Percentage of Gold Cost</option>
              <option value="per_gram">Fixed per Gram</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Making Charge Value
              {inputs.making_charge_type === 'percent' ? ' (%)' : ' (₹/gram)'}
            </label>
            <input
              type="number"
              value={inputs.making_charge_value}
              onChange={(e) => handleInputChange('making_charge_value', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Percentage (%)
            </label>
            <input
              type="number"
              value={inputs.gst_percent}
              onChange={(e) => handleInputChange('gst_percent', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
          </div>

          <button
            onClick={calculatePrice}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Calculate Price'}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Calculation Results</h4>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-700 mb-1">Final Price</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatPrice(result.final_price)}
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-medium text-gray-900">Price Breakdown:</h5>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gold Cost:</span>
                    <span className="font-medium">{formatPrice(result.breakdown.gold_cost)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Making Charges:</span>
                    <span className="font-medium">{formatPrice(result.breakdown.making_charges)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatPrice(result.breakdown.subtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>GST ({result.breakdown.gst_percent}%):</span>
                    <span className="font-medium">{formatPrice(result.breakdown.gst_amount)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
                    Purity Factor: {result.breakdown.purity_factor} 
                    ({result.inputs.karat}K = {Math.round(result.breakdown.purity_factor * 100)}%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {!result && !error && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
              Enter parameters and click "Calculate Price" to see results
            </div>
          )}
        </div>
      </div>

      {/* Formula Display */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="font-medium text-blue-900 mb-2">Calculation Formula</h5>
        <div className="text-sm text-blue-800 space-y-1">
          <div>1. <strong>Gold Cost</strong> = 24K Price × Purity Factor × Weight</div>
          <div>2. <strong>Making Charges</strong> = {inputs.making_charge_type === 'percent' ? 'Gold Cost × Percentage' : 'Charge per Gram × Weight'}</div>
          <div>3. <strong>Subtotal</strong> = Gold Cost + Making Charges</div>
          <div>4. <strong>Final Price</strong> = Subtotal × (1 + GST%)</div>
        </div>
      </div>
    </div>
  );
};
