import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

interface RentalItem {
    _id: string;
    product_id: string;
    rental_price_per_day: number;
    security_deposit: number;
    status: string;
    product: {
        name: string;
        category: string;
        image: string;
        metal?: string;
        purity?: string;
    };
}

interface Pagination {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}

export const RentalsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rentals, setRentals] = useState<RentalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 0,
    });

    useEffect(() => {
        fetchRentals();
    }, [pagination.page]);

    const fetchRentals = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rentals?page=${pagination.page}&per_page=${pagination.per_page}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch rental items');
            }

            const data = await response.json();
            setRentals(data.results || []);
            setPagination(data.pagination);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (rentalId: string) => {
        navigate(`/rentals/${rentalId}`);
    };

    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Rent Jewellery</h1>
                    <p className="text-gray-600">Discover our exquisite collection available for rental</p>
                </div>

                {/* Tab Navigation (only for authenticated users) */}
                {user && (
                    <div className="mb-6 border-b border-gray-200">
                        <nav className="flex gap-8">
                            <button
                                onClick={() => navigate('/rentals')}
                                className="pb-4 px-1 border-b-2 border-amber-600 text-amber-600 font-medium transition-colors"
                            >
                                Browse Rentals
                            </button>
                            <button
                                onClick={() => navigate('/my-rentals')}
                                className="pb-4 px-1 border-b-2 border-transparent text-gray-600 hover:text-amber-600 hover:border-amber-300 font-medium transition-colors"
                            >
                                My Bookings
                            </button>
                        </nav>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && rentals.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-gray-400 mb-4">
                            <svg className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No rental items available</h3>
                        <p className="text-gray-600">Check back soon for new rental jewellery</p>
                    </div>
                )}

                {/* Rentals Grid */}
                {!loading && !error && rentals.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                            {rentals.map((rental) => (
                                <div
                                    key={rental._id}
                                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer"
                                    onClick={() => handleViewDetails(rental._id)}
                                >
                                    {/* Image */}
                                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                        {rental.product.image ? (
                                            <img
                                                src={rental.product.image}
                                                alt={rental.product.name}
                                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                                            For Rent
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 mb-1 truncate">{rental.product.name}</h3>
                                        <p className="text-sm text-gray-600 mb-3 capitalize">{rental.product.category}</p>

                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Rental/Day:</span>
                                                <span className="font-semibold text-amber-600">₹{rental.rental_price_per_day.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Deposit:</span>
                                                <span className="font-medium text-gray-900">₹{rental.security_deposit.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewDetails(rental._id);
                                            }}
                                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination.total_pages > 1 && (
                            <div className="flex justify-center items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>

                                <div className="flex gap-1">
                                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`px-4 py-2 rounded-lg ${page === pagination.page
                                                ? 'bg-amber-600 text-white'
                                                : 'border border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.total_pages}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default RentalsPage;
