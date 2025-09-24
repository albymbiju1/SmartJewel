import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// Note: Cart is now cleared on successful payment in CheckoutPage

export const OrderConfirmationPage: React.FC = () => {
  const { state } = useLocation() as { state?: { orderId?: string; amount?: number; details?: any } };

  const orderId = state?.orderId || 'DEMO-ORDER';
  const amount = state?.amount || 0;

  // Debug logging
  console.log('OrderConfirmationPage - state:', state);
  console.log('OrderConfirmationPage - orderId:', orderId);
  console.log('OrderConfirmationPage - amount:', amount);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <a href="/" className="hover:text-blue-600">Home</a>
          <span>/</span>
          <span className="text-gray-900">Order Confirmation</span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful</h1>
          <p className="text-gray-600">Thank you! Your product has been purchased and your order has been placed.</p>

          <div className="mt-6 text-left bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-600">Order ID</span>
              <span className="font-semibold">{orderId}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-semibold">₹{amount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <a 
              href="/my-orders"
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              View My Orders
            </a>
            <a 
              href="/products/all"
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Continue Shopping
            </a>
            <a 
              href="/"
              className="px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:opacity-90"
            >
              Go to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;