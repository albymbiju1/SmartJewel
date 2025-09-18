import React from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { GoldPriceDisplay } from '../../components/GoldPriceDisplay';
import { PriceUpdateManager } from '../../components/PriceUpdateManager';
import { GoldPriceCalculator } from '../../components/GoldPriceCalculator';

export const PricesPage: React.FC = () => {
  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Metal Prices</h1>
              <p className="text-gray-600 mt-1">Monitor and update current metal rates and pricing</p>
            </div>
            <div className="text-emerald-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Gold Prices */}
        <GoldPriceDisplay />

        {/* Price Update Manager */}
        <PriceUpdateManager />

        {/* Gold Price Calculator */}
        <GoldPriceCalculator />

        {/* Additional Price Management Tools - Coming Soon */}
        <div className="bg-white rounded-lg shadow-sm p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Additional Price Management Tools</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Advanced pricing strategies, bulk rate updates, and historical price tracking will be available here.
            </p>
          </div>
        </div>
      </div>
    </RoleBasedNavigation>
  );
};