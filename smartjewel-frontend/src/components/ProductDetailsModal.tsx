import React, { useMemo } from 'react';
import { API_BASE_URL } from '../api';

interface Item {
  _id: string;
  sku: string;
  name: string;
  category: string;
  sub_category?: string;
  metal: string;
  purity: string;
  weight_unit: string;
  weight?: number;
  price?: number;
  description?: string;
  image?: string;
  gemstones?: string[];
  color?: string;
  style?: string;
  tags?: string[];
  brand?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface ProductDetailsModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  item,
  isOpen,
  onClose
}) => {
  // Version timestamp for cache busting
  const imageVersion = useMemo(() => Date.now(), []);
  
  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return '';
    const baseUrl = imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}${imagePath}`;
    if (!imagePath.startsWith('http')) {
      return `${baseUrl}?v=${imageVersion}`;
    }
    return baseUrl;
  };
  
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Product Details</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Image */}
              <div>
                {item.image ? (
                  <img 
                    src={getImageUrl(item.image)} 
                    alt={item.name} 
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Product Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">SKU</label>
                  <p className="text-sm text-gray-900">{item.sku}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="text-sm text-gray-900">{item.name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <p className="text-sm text-gray-900">{item.category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sub Category</label>
                    <p className="text-sm text-gray-900">{item.sub_category || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Metal</label>
                    <p className="text-sm text-gray-900">{item.metal}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Purity</label>
                    <p className="text-sm text-gray-900">{item.purity}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <p className="text-sm text-gray-900">{item.color || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Style</label>
                    <p className="text-sm text-gray-900">{item.style || 'N/A'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Brand</label>
                  <p className="text-sm text-gray-900">{item.brand || 'Smart Jewel'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight</label>
                    <p className="text-sm text-gray-900">{item.weight} {item.weight_unit}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price</label>
                    <p className="text-sm text-gray-900">₹{item.price?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
                
                {item.gemstones && item.gemstones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gemstones</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.gemstones.map((gemstone, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          {gemstone}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {item.tags && item.tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.tags.map((tag, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {item.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="text-sm text-gray-900">{item.description}</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
