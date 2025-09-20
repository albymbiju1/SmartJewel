import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface QuickViewProduct {
  _id: string;
  name: string;
  category: string;
  metal: string;
  purity: string;
  price?: number;
  description?: string;
  image?: string;
}

interface QuickViewModalProps {
  open: boolean;
  product: QuickViewProduct | null;
  onClose: () => void;
  onViewDetails?: (id: string) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ open, product, onClose, onViewDetails }) => {
  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div
            className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-3xl overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-gray-50 aspect-square">
                {product.image ? (
                  <img
                    src={product.image.startsWith('http') ? product.image : `http://127.0.0.1:5000${product.image}`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs inline-flex px-2 py-1 rounded-full bg-blue-50 text-blue-700 mb-2">{product.category}</div>
                    <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                  </div>
                  <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="mt-3 text-sm text-gray-600">
                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-gray-100 text-gray-700">
                    <span>{product.metal}</span>
                    <span>•</span>
                    <span>{product.purity}</span>
                  </div>
                </div>

                {product.price && (
                  <div className="mt-4 text-2xl font-bold text-gray-900">₹{product.price.toLocaleString()}</div>
                )}

                {product.description && (
                  <p className="mt-3 text-gray-700 line-clamp-4">{product.description}</p>
                )}

                <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => onViewDetails?.(product._id)}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700"
                  >
                    View Details
                  </button>
                  <button
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={(e)=>{
                      e.stopPropagation();
                      // fire a simple custom event; ProductDisplay owns the product data and can handle
                      const ev = new CustomEvent('sj:toggleWishlist', { detail: { productId: product._id, name: product.name, price: product.price, image: product.image, metal: product.metal, purity: product.purity } });
                      window.dispatchEvent(ev);
                    }}
                  >
                    Add to Wishlist
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickViewModal;
