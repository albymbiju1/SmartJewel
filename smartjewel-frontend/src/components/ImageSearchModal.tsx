import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { catalogService } from '../services/catalogService';

interface ImageSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResultsFound?: (results: any[]) => void;
}

interface SearchResult {
    _id: string;
    sku: string;
    name: string;
    category: string;
    metal?: string;
    purity?: string;
    price?: number;
    image?: string;
    similarity: number;
    similarity_percent: number;
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
    isOpen,
    onClose,
    onResultsFound
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [category, setCategory] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    const handleImageSelect = (file: File) => {
        setSelectedFile(file);
        setError(null);
        setResults([]);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleClear = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResults([]);
        setError(null);
    };

    const handleSearch = async () => {
        if (!selectedFile) {
            setError('Please select an image first');
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const searchResults = await catalogService.searchByImage(selectedFile, {
                category: category || undefined,
                minPrice: minPrice ? parseFloat(minPrice) : undefined,
                maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
                limit: 20
            });

            setResults(searchResults.results);

            if (onResultsFound) {
                onResultsFound(searchResults.results);
            }

            if (searchResults.results.length === 0) {
                setError('No similar products found. Try a different image or adjust filters.');
            }
        } catch (err: any) {
            console.error('Image search failed:', err);
            setError(err.response?.data?.message || 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleProductClick = (productId: string) => {
        window.location.href = `/product/${productId}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-screen items-center justify-center p-4">
                <div
                    className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Search by Image</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Upload a jewelry image to find similar products
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Upload & Filters */}
                            <div className="space-y-4">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Upload Image
                                    </label>
                                    <ImageUploader
                                        onImageSelect={handleImageSelect}
                                        previewImage={previewUrl}
                                        onClear={handleClear}
                                    />
                                </div>

                                {/* Filters */}
                                {selectedFile && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-700">
                                            Refine Search (Optional)
                                        </h3>

                                        {/* Category Filter */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Category
                                            </label>
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            >
                                                <option value="">All Categories</option>
                                                <option value="Rings">Rings</option>
                                                <option value="Earrings">Earrings</option>
                                                <option value="Necklaces">Necklaces</option>
                                                <option value="Bracelets">Bracelets</option>
                                                <option value="Bangles">Bangles</option>
                                                <option value="Pendants">Pendants</option>
                                                <option value="Chains">Chains</option>
                                            </select>
                                        </div>

                                        {/* Price Range */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Min Price (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={minPrice}
                                                    onChange={(e) => setMinPrice(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Max Price (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={maxPrice}
                                                    onChange={(e) => setMaxPrice(e.target.value)}
                                                    placeholder="∞"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Search Button */}
                                {selectedFile && (
                                    <button
                                        onClick={handleSearch}
                                        disabled={isSearching}
                                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                                    >
                                        {isSearching ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Searching... (may take 30-60s first time)</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <span>Find Similar Products</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Right: Results */}
                            <div className="bg-gray-50 rounded-lg p-4 min-h-[400px]">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                    Search Results
                                    {results.length > 0 && (
                                        <span className="text-gray-500 font-normal ml-2">
                                            ({results.length} found)
                                        </span>
                                    )}
                                </h3>

                                {/* Error Message */}
                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-red-600">{error}</p>
                                    </div>
                                )}

                                {/* Results Grid */}
                                {results.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                                        {results.map((product) => (
                                            <div
                                                key={product._id}
                                                onClick={() => handleProductClick(product._id)}
                                                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                                            >
                                                {/* Product Image */}
                                                <div className="relative aspect-square bg-gray-100">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* Similarity Badge */}
                                                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                                        {product.similarity_percent}% match
                                                    </div>
                                                </div>

                                                {/* Product Info */}
                                                <div className="p-3">
                                                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                                                        {product.name}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {product.category}
                                                    </p>
                                                    {product.price && (
                                                        <p className="text-sm font-bold text-amber-600 mt-1">
                                                            ₹{product.price.toLocaleString('en-IN')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <p className="text-sm">
                                            {selectedFile ? 'Click "Find Similar Products" to search' : 'Upload an image to get started'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageSearchModal;
