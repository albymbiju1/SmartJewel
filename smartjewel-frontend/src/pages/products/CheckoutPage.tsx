import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartTotal, cartCount } = useCart();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/cart')} className="hover:text-blue-600">Bag</button>
          <span>/</span>
          <span className="text-gray-900">Checkout</span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-600 mb-6">This is a placeholder. Integrate payment and address steps here.</p>
          <div className="inline-flex items-center gap-4 px-5 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800">
            <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span className="font-semibold">Total: ₹{cartTotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => navigate('/cart')}>Back to Bag</button>
            <button className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;