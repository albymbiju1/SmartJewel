import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Filter, X } from 'lucide-react';

interface RentalItem {
    _id: string;
    product_id: string;
    rental_price_per_day: number;
    security_deposit: number;
    status: 'available' | 'rented' | 'maintenance';
    created_at?: string;
    product: {
        name: string;
        category: string;
        image?: string;
        metal?: string;
        purity?: string;
    };
}

interface Product {
    _id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
}

export const RentalManagementPage: React.FC = () => {
    const [rentals, setRentals] = useState<RentalItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRental, setSelectedRental] = useState<RentalItem | null>(null);

    // Form states for create/edit
    const [formData, setFormData] = useState({
        product_id: '',
        rental_price_per_day: '',
        security_deposit: '',
        status: 'available' as 'available' | 'rented' | 'maintenance',
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    useEffect(() => {
        fetchRentals();
        fetchProducts();
    }, [statusFilter, searchQuery]);

    const fetchRentals = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`${API_URL}/api/rentals/admin/all?${params}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch rentals');

            const data = await response.json();
            setRentals(data.results || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_URL}/inventory/items`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProducts(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    const handleCreateRental = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_URL}/api/rentals/admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    product_id: formData.product_id,
                    rental_price_per_day: parseFloat(formData.rental_price_per_day),
                    security_deposit: parseFloat(formData.security_deposit),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create rental');
            }

            setShowCreateModal(false);
            setFormData({
                product_id: '',
                rental_price_per_day: '',
                security_deposit: '',
                status: 'available',
            });
            setProductSearchQuery('');
            fetchRentals();
            alert('Rental item created successfully!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create rental');
        }
    };

    const handleUpdateRental = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRental) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_URL}/api/rentals/admin/${selectedRental._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    rental_price_per_day: formData.rental_price_per_day
                        ? parseFloat(formData.rental_price_per_day)
                        : undefined,
                    security_deposit: formData.security_deposit
                        ? parseFloat(formData.security_deposit)
                        : undefined,
                    status: formData.status,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update rental');
            }

            setShowEditModal(false);
            setSelectedRental(null);
            fetchRentals();
            alert('Rental item updated successfully!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update rental');
        }
    };

    const handleDeleteRental = async (rentalId: string) => {
        if (!confirm('Are you sure you want to delete this rental item?')) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_URL}/api/rentals/admin/${rentalId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to delete rental');

            fetchRentals();
            alert('Rental item deleted successfully!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete rental');
        }
    };

    const openEditModal = (rental: RentalItem) => {
        setSelectedRental(rental);
        setFormData({
            product_id: rental.product_id,
            rental_price_per_day: rental.rental_price_per_day.toString(),
            security_deposit: rental.security_deposit.toString(),
            status: rental.status,
        });
        setShowEditModal(true);
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            available: 'bg-green-100 text-green-800',
            rented: 'bg-yellow-100 text-yellow-800',
            maintenance: 'bg-red-100 text-red-800',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearchQuery.toLowerCase())
    );

    const selectedProduct = products.find(p => p._id === formData.product_id);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Rental Management</h1>
                    <p className="text-gray-600 mt-1">Manage rental jewellery inventory and pricing</p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 w-full md:w-auto">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by product name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        </div>

                        {/* Filter */}
                        <div className="flex gap-2 items-center w-full md:w-auto">
                            <Filter className="text-gray-400 w-5 h-5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                                <option value="">All Status</option>
                                <option value="available">Available</option>
                                <option value="rented">Rented</option>
                                <option value="maintenance">Maintenance</option>
                            </select>
                        </div>

                        {/* Create Button */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors w-full md:w-auto justify-center"
                        >
                            <Plus className="w-5 h-5" />
                            Create Rental Item
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                        </div>
                    ) : rentals.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-600">No rental items found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Product
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Category
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Price/Day
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Deposit
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {rentals.map((rental) => (
                                        <tr key={rental._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {rental.product.image && (
                                                        <img
                                                            src={rental.product.image}
                                                            alt={rental.product.name}
                                                            className="w-10 h-10 rounded-md object-cover mr-3"
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {rental.product.name}
                                                        </div>
                                                        {rental.product.metal && (
                                                            <div className="text-sm text-gray-500">
                                                                {rental.product.metal} {rental.product.purity}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 capitalize">{rental.product.category}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-amber-600">
                                                    ₹{rental.rental_price_per_day.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    ₹{rental.security_deposit.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(rental.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(rental)}
                                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4 inline" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRental(rental._id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 inline" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Enhanced Create Modal with Product Cards */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Create Rental Item</h2>
                                <p className="text-sm text-gray-600 mt-1">Select a product and set rental pricing</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setFormData({ product_id: '', rental_price_per_day: '', security_deposit: '', status: 'available' });
                                    setProductSearchQuery('');
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Selected Product Preview */}
                        {selectedProduct && (
                            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
                                <div className="flex items-center gap-4">
                                    {selectedProduct.image && (
                                        <img
                                            src={selectedProduct.image}
                                            alt={selectedProduct.name}
                                            className="w-20 h-20 object-cover rounded-lg shadow-md"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 text-lg">{selectedProduct.name}</div>
                                        <div className="text-sm text-gray-600 capitalize">{selectedProduct.category}</div>
                                        {selectedProduct.price && (
                                            <div className="text-sm text-amber-700 font-medium mt-1">
                                                Product Value: ₹{selectedProduct.price.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setFormData({ ...formData, product_id: '' })}
                                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        Change Product
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Product Selection Grid */}
                        {!selectedProduct && (
                            <div className="flex-1 overflow-hidden flex flex-col">
                                {/* Search Bar */}
                                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            placeholder="Search products by name or category..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                            value={productSearchQuery}
                                            onChange={(e) => setProductSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Product Grid */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {filteredProducts.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="text-gray-400 mb-2">
                                                <Search className="w-16 h-16 mx-auto" />
                                            </div>
                                            <p className="text-gray-600">No products found</p>
                                            <p className="text-sm text-gray-500 mt-1">Try adjusting your search</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {filteredProducts.map((product) => (
                                                <button
                                                    key={product._id}
                                                    onClick={() => setFormData({ ...formData, product_id: product._id })}
                                                    className="group text-left p-3 border-2 border-gray-200 rounded-xl hover:border-amber-500 hover:shadow-lg transition-all duration-200"
                                                >
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-full h-36 object-cover rounded-lg mb-3"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-36 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                                                            <span className="text-gray-400 text-sm">No image</span>
                                                        </div>
                                                    )}
                                                    <div className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-amber-600 min-h-[2.5rem]">
                                                        {product.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1.5 capitalize">
                                                        {product.category}
                                                    </div>
                                                    {product.price && (
                                                        <div className="text-sm text-amber-600 font-semibold mt-2">
                                                            ₹{product.price.toLocaleString()}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Pricing Form - Only show when product is selected */}
                        {selectedProduct && (
                            <form onSubmit={handleCreateRental} className="px-6 py-5 border-t border-gray-200 bg-gray-50">
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Rental Price (per day) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                                            <input
                                                type="number"
                                                value={formData.rental_price_per_day}
                                                onChange={(e) => setFormData({ ...formData, rental_price_per_day: e.target.value })}
                                                className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                placeholder="2500"
                                                required
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5">💡 Typically 3-5% of product value/day</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Security Deposit *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                                            <input
                                                type="number"
                                                value={formData.security_deposit}
                                                onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                                                className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                placeholder="50000"
                                                required
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5">💡 Usually 100-150% of product value</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setFormData({ product_id: '', rental_price_per_day: '', security_deposit: '', status: 'available' });
                                            setProductSearchQuery('');
                                        }}
                                        className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg font-medium"
                                    >
                                        Create Rental Item
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Instruction Footer */}
                        {!selectedProduct && (
                            <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
                                <p className="text-sm text-blue-800 text-center">
                                    <strong>👆 Select a product above</strong> to set rental pricing and create the rental item
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedRental && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">Edit Rental Item</h2>
                            <p className="text-sm text-gray-600 mt-1">{selectedRental.product.name}</p>
                        </div>
                        <form onSubmit={handleUpdateRental} className="px-6 py-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rental Price (per day)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.rental_price_per_day}
                                        onChange={(e) => setFormData({ ...formData, rental_price_per_day: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Security Deposit
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.security_deposit}
                                        onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                status: e.target.value as 'available' | 'rented' | 'maintenance',
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    >
                                        <option value="available">Available</option>
                                        <option value="rented">Rented</option>
                                        <option value="maintenance">Maintenance</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedRental(null);
                                    }}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RentalManagementPage;
