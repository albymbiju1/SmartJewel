import React, { useState } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

export const SalesDashboard: React.FC = () => {
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<7 | 30>(7);
  const [forecast, setForecast] = useState<{
    daily: { date: string; forecast: number }[];
    totals: { sum_7?: number; sum_30?: number };
  } | null>(null);

  const fetchForecast = async (selectedHorizon: 7 | 30) => {
    if (!sku) {
      setError('Enter an SKU to forecast');
      return;
    }
    setHorizon(selectedHorizon);
    setLoading(true);
    setError(null);
    setForecast(null);
    try {
      const res = await fetch('http://localhost:8085/ml/inventory/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, horizon_days: selectedHorizon, recent_history: [] }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setForecast({ daily: data.daily || [], totals: data.totals || {} });
    } catch (e: any) {
      setError(e.message || 'Failed to fetch forecast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sales Dashboard</h2>
          <p className="text-gray-600 mb-6">Welcome to your sales workspace. Manage customers and sales transactions.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Today's Sales</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">₹45,000</p>
              <p className="text-sm text-green-700 mt-1">8 transactions</p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-900">Pending Orders</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-2">3</p>
              <p className="text-sm text-yellow-700 mt-1">Requires follow-up</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Customer Visits</h3>
              <p className="text-2xl font-bold text-blue-600 mt-2">15</p>
              <p className="text-sm text-blue-700 mt-1">Today</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-green-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <span className="text-sm font-medium">New Sale</span>
            </button>

            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-blue-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Add Customer</span>
            </button>

            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-purple-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-sm font-medium">AI Assist</span>
            </button>

            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-orange-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 3H3m4 10v6a1 1 0 001 1h1m-4-3h12a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v10z" />
                </svg>
              </div>
              <span className="text-sm font-medium">View Cart</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Forecast</h3>
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-700 mb-1">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Enter SKU" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => fetchForecast(7)} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">7 days</button>
              <button onClick={() => fetchForecast(30)} disabled={loading} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">30 days</button>
            </div>
          </div>
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          {loading && <div className="text-sm text-gray-500">Loading forecast...</div>}
          {!loading && forecast && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded bg-blue-50">
                  <div className="text-sm text-blue-900">Total next 7 days</div>
                  <div className="text-2xl font-semibold text-blue-700">{forecast.totals.sum_7 ?? 0}</div>
                </div>
                <div className="p-4 rounded bg-indigo-50">
                  <div className="text-sm text-indigo-900">Total next 30 days</div>
                  <div className="text-2xl font-semibold text-indigo-700">{forecast.totals.sum_30 ?? 0}</div>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2">Forecast Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.daily.slice(0, horizon).map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="py-2 pr-4">{d.date}</td>
                        <td className="py-2">{d.forecast}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Gold Ring Set - Customer: Priya Nair</p>
                <p className="text-xs text-gray-500">Transaction ID: #TXN-2024-001</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">₹25,000</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Diamond Earrings - Customer: Anjali Menon</p>
                <p className="text-xs text-gray-500">Transaction ID: #TXN-2024-002</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">₹15,000</p>
                <p className="text-xs text-gray-500">4 hours ago</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Wedding Chain - Customer: Lakshmi Pillai</p>
                <p className="text-xs text-gray-500">Transaction ID: #TXN-2024-003</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">₹5,000</p>
                <p className="text-xs text-gray-500">6 hours ago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Customer Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900">Ravi Kumar</h4>
              <p className="text-sm text-gray-600 mt-1">Last visit: 15 days ago</p>
              <p className="text-sm text-blue-600 mt-2">Interested in: Gold Chains</p>
              <button className="mt-3 text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100">
                Follow Up
              </button>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900">Meera Nair</h4>
              <p className="text-sm text-gray-600 mt-1">Birthday: Tomorrow</p>
              <p className="text-sm text-purple-600 mt-2">Preferred: Diamond Jewelry</p>
              <button className="mt-3 text-sm bg-purple-50 text-purple-600 px-3 py-1 rounded-full hover:bg-purple-100">
                Send Wishes
              </button>
            </div>
          </div>
        </div>
      </div>
    </RoleBasedNavigation>
  );
};
