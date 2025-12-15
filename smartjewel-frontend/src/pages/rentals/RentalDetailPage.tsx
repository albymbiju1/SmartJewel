import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

interface RentalDetail {
    _id: string;
    product_id: string;
    rental_price_per_day: number;
    security_deposit: number;
    status: string;
    product: {
        _id: string;
        name: string;
        category: string;
        image: string;
        description?: string;
        metal?: string;
        purity?: string;
        weight?: number;
        weight_unit?: string;
    };
}

export const RentalDetailPage: React.FC = () => {
    const { rentalItemId } = useParams<{ rentalItemId: string }>();
    const navigate = useNavigate();
    const [rental, setRental] = useState<RentalDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Check authentication status
        const token = localStorage.getItem('access_token');
        setIsAuthenticated(!!token);

        if (rentalItemId) {
            fetchRentalDetail();
        }
    }, [rentalItemId]);

    const fetchRentalDetail = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rentals/${rentalItemId}`
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Rental item not found');
                }
                throw new Error('Failed to fetch rental details');
            }

            const data = await response.json();
            setRental(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToRent = () => {
        if (!isAuthenticated) {
            // Store the current path to redirect back after login
            localStorage.setItem('redirectAfterLogin', window.location.pathname);
            navigate('/login');
        } else {
            // TODO: Implement rental booking flow
            alert('Rental booking functionality will be implemented soon!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                </div>
            </div>
        );
    }

    if (error || !rental) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error || 'Rental item not found'}
                    </div>
                    <button
                        onClick={() => navigate('/rentals')}
                        className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to Rentals
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6 text-sm">
                    <button
                        onClick={() => navigate('/rentals')}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to Rentals
                    </button>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Image Gallery */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="aspect-square bg-gray-100 relative">
                            {rental.product.image ? (
                                <img
                                    src={rental.product.image}
                                    alt={rental.product.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full font-medium text-sm">
                                For Rent
                            </div>
                            {rental.status === 'available' && (
                                <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full font-medium text-sm">
                                    Available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{rental.product.name}</h1>
                            <p className="text-lg text-gray-600 capitalize">{rental.product.category}</p>
                        </div>

                        {/* Rental Pricing */}
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rental Information</h2>

                            <div className="flex justify-between items-center py-3 border-b border-gray-200">
                                <span className="text-gray-700">Rental Price (per day)</span>
                                <span className="text-2xl font-bold text-amber-600">₹{rental.rental_price_per_day.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center py-3 border-b border-gray-200">
                                <span className="text-gray-700">Security Deposit</span>
                                <span className="text-xl font-semibold text-gray-900">₹{rental.security_deposit.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center py-3">
                                <span className="text-gray-700">Status</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${rental.status === 'available'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
                                </span>
                            </div>
                        </div>

                        {/* Product Specifications */}
                        {(rental.product.metal || rental.product.purity || rental.product.weight) && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Specifications</h2>
                                <div className="space-y-3">
                                    {rental.product.metal && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Metal</span>
                                            <span className="font-medium text-gray-900 capitalize">{rental.product.metal}</span>
                                        </div>
                                    )}
                                    {rental.product.purity && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Purity</span>
                                            <span className="font-medium text-gray-900">{rental.product.purity}</span>
                                        </div>
                                    )}
                                    {rental.product.weight && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Weight</span>
                                            <span className="font-medium text-gray-900">
                                                {rental.product.weight} {rental.product.weight_unit || 'g'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {rental.product.description && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
                                <p className="text-gray-700 leading-relaxed">{rental.product.description}</p>
                            </div>
                        )}

                        {/* Availability Calendar Placeholder */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">Availability Calendar</h2>
                            <div className="bg-gray-50 rounded-lg p-8 text-center">
                                <div className="text-gray-400 mb-2">
                                    <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-600">Availability calendar coming soon</p>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="sticky bottom-0 bg-white rounded-lg shadow-sm p-6">
                            <button
                                onClick={handleProceedToRent}
                                disabled={rental.status !== 'available'}
                                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors duration-200 ${rental.status === 'available'
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {rental.status === 'available'
                                    ? (isAuthenticated ? 'Proceed to Rent' : 'Login to Rent')
                                    : 'Currently Unavailable'}
                            </button>
                            {!isAuthenticated && rental.status === 'available' && (
                                <p className="text-sm text-gray-600 text-center mt-2">
                                    You need to login to proceed with rental
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RentalDetailPage;
