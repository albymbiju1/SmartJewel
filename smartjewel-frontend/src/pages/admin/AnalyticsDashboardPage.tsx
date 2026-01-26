import React, { useState, useEffect } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { StatCard } from '../../components/analytics/StatCard';
import { SimpleBarChart } from '../../components/analytics/SimpleBarChart';
import { SimpleLineChart } from '../../components/analytics/SimpleLineChart';
import { SimplePieChart } from '../../components/analytics/SimplePieChart';
import {
    analyticsService,
    RentalAnalytics,
    RevenueAnalytics,
    ProductAnalytics,
    CustomerAnalytics,
} from '../../services/analyticsService';

type DateRangePreset = '7d' | '30d' | '90d' | '12m' | 'custom';

export const AnalyticsDashboardPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'revenue' | 'rentals' | 'products' | 'customers'>(
        'revenue'
    );
    const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30d');
    const [customFromDate, setCustomFromDate] = useState('');
    const [customToDate, setCustomToDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [rentalAnalytics, setRentalAnalytics] = useState<RentalAnalytics | null>(null);
    const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);
    const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
    const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);

    const getDateRange = () => {
        const to = new Date();
        let from = new Date();

        if (dateRangePreset === 'custom') {
            return {
                from_date: customFromDate ? new Date(customFromDate).toISOString() : undefined,
                to_date: customToDate ? new Date(customToDate).toISOString() : undefined,
            };
        }

        switch (dateRangePreset) {
            case '7d':
                from.setDate(to.getDate() - 7);
                break;
            case '30d':
                from.setDate(to.getDate() - 30);
                break;
            case '90d':
                from.setDate(to.getDate() - 90);
                break;
            case '12m':
                from.setFullYear(to.getFullYear() - 1);
                break;
        }

        return {
            from_date: from.toISOString(),
            to_date: to.toISOString(),
        };
    };

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            const dateRange = getDateRange();

            const [rental, revenue, product, customer] = await Promise.all([
                analyticsService.getRentalAnalytics(dateRange),
                analyticsService.getRevenueAnalytics(dateRange),
                analyticsService.getProductAnalytics(dateRange),
                analyticsService.getCustomerAnalytics(dateRange),
            ]);

            setRentalAnalytics(rental);
            setRevenueAnalytics(revenue);
            setProductAnalytics(product);
            setCustomerAnalytics(customer);
        } catch (err: any) {
            console.error('Failed to fetch analytics:', err);
            setError(err?.response?.data?.error || err?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [dateRangePreset, customFromDate, customToDate]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);

    const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);

    const getMonthLabel = (year: number, month: number) => {
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    };

    if (loading && !revenueAnalytics) {
        return (
            <RoleBasedNavigation>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin">
                        <div className="h-12 w-12 rounded-full border-4 border-amber-200 border-t-amber-600"></div>
                    </div>
                </div>
            </RoleBasedNavigation>
        );
    }

    return (
        <RoleBasedNavigation>
            <div className="space-y-6">
                {/* Header */}
                <div className="rounded-3xl border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50/20 p-8 shadow-lg">
                    <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
                        Admin Analytics
                    </p>
                    <h2 className="mt-1 text-4xl font-bold text-gray-900">Business Insights Dashboard</h2>
                    <p className="mt-2 text-gray-600">
                        Comprehensive analytics for revenue, rentals, products, and customers
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                            <svg
                                className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <div>
                                <h3 className="text-lg font-semibold text-red-900">Error Loading Analytics</h3>
                                <p className="mt-2 text-sm text-red-700">{error}</p>
                                <button
                                    onClick={fetchAnalytics}
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Date Range Selector */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
                    <div className="flex flex-wrap gap-3">
                        {(['7d', '30d', '90d', '12m', 'custom'] as DateRangePreset[]).map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setDateRangePreset(preset)}
                                className={`px-4 py-2 rounded-lg font-medium transition duration-200 ${dateRangePreset === preset
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {preset === '7d' && 'Last 7 Days'}
                                {preset === '30d' && 'Last 30 Days'}
                                {preset === '90d' && 'Last 90 Days'}
                                {preset === '12m' && 'Last 12 Months'}
                                {preset === 'custom' && 'Custom Range'}
                            </button>
                        ))}
                    </div>

                    {dateRangePreset === 'custom' && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={customFromDate}
                                    onChange={(e) => setCustomFromDate(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={customToDate}
                                    onChange={(e) => setCustomToDate(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {(['revenue', 'rentals', 'products', 'customers'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium capitalize transition ${activeTab === tab
                                        ? 'border-amber-500 text-amber-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Revenue Tab */}
                {activeTab === 'revenue' && revenueAnalytics && (
                    <div className="space-y-6">
                        {/* Revenue Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                title="Total Revenue"
                                value={formatCurrency(revenueAnalytics.total_revenue)}
                                color="green"
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                }
                            />
                            <StatCard
                                title="Sales Revenue"
                                value={formatCurrency(revenueAnalytics.sales_revenue)}
                                color="blue"
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                        />
                                    </svg>
                                }
                            />
                            <StatCard
                                title="Rental Revenue"
                                value={formatCurrency(revenueAnalytics.rental_revenue)}
                                color="purple"
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                        />
                                    </svg>
                                }
                            />
                        </div>

                        {/* Revenue Breakdown */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimplePieChart
                                title="Revenue by Source"
                                data={[
                                    { label: 'Sales', value: revenueAnalytics.sales_revenue, color: '#3b82f6' },
                                    { label: 'Rentals', value: revenueAnalytics.rental_revenue, color: '#8b5cf6' },
                                ]}
                                valueFormatter={formatCurrency}
                            />
                        </div>

                        {/* Monthly Revenue Trend */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimpleLineChart
                                title="Revenue Trend (Monthly)"
                                data={revenueAnalytics.monthly_trend.map((m) => ({
                                    label: getMonthLabel(m.year, m.month),
                                    value: m.total,
                                }))}
                                color="#10b981"
                                valueFormatter={formatCurrency}
                            />
                        </div>

                        {/* Revenue by Category */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimpleBarChart
                                title="Revenue by Category"
                                data={revenueAnalytics.category_revenue.map((c) => ({
                                    label: c.category,
                                    value: c.revenue,
                                }))}
                                color="#f59e0b"
                                valueFormatter={formatCurrency}
                            />
                        </div>
                    </div>
                )}

                {/* Rentals Tab */}
                {activeTab === 'rentals' && rentalAnalytics && (
                    <div className="space-y-6">
                        {/* Rental Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard
                                title="Total Rental Revenue"
                                value={formatCurrency(rentalAnalytics.total_revenue)}
                                color="purple"
                            />
                            <StatCard
                                title="Total Bookings"
                                value={formatNumber(rentalAnalytics.total_bookings)}
                                color="blue"
                            />
                            <StatCard
                                title="Active Rentals"
                                value={formatNumber(rentalAnalytics.active_rentals)}
                                color="amber"
                            />
                            <StatCard
                                title="Avg. Duration"
                                value={`${rentalAnalytics.average_duration_days} days`}
                                color="green"
                            />
                        </div>

                        {/* Rental Trend */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimpleLineChart
                                title="Rental Revenue Trend (Monthly)"
                                data={rentalAnalytics.monthly_trend.map((m) => ({
                                    label: getMonthLabel(m.year, m.month),
                                    value: m.revenue,
                                }))}
                                color="#8b5cf6"
                                valueFormatter={formatCurrency}
                            />
                        </div>

                        {/* Popular Items */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Rental Items</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Product
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Bookings
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Revenue
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {rentalAnalytics.popular_items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {item.product_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.booking_count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(item.total_revenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && productAnalytics && (
                    <div className="space-y-6">
                        {/* Top Selling Products */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Product
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                SKU
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Category
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Orders
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Revenue
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {productAnalytics.top_selling_products.map((product, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {product.product_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {product.sku}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                    {product.category}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {product.order_count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(product.revenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Most Rented Products */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Rented Products</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Product
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                SKU
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Category
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rentals
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Revenue
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {productAnalytics.most_rented_products.map((product, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {product.product_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {product.sku}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                    {product.category}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {product.rental_count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(product.revenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Category Performance */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimpleBarChart
                                title="Total Revenue by Category"
                                data={productAnalytics.category_performance.map((c) => ({
                                    label: c.category,
                                    value: c.total_revenue,
                                }))}
                                color="#3b82f6"
                                valueFormatter={formatCurrency}
                            />
                        </div>
                    </div>
                )}

                {/* Customers Tab */}
                {activeTab === 'customers' && customerAnalytics && (
                    <div className="space-y-6">
                        {/* Customer Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                title="Total Customers"
                                value={formatNumber(customerAnalytics.total_customers)}
                                color="purple"
                            />
                            <StatCard
                                title="New Customers"
                                value={formatNumber(customerAnalytics.new_customers)}
                                color="green"
                            />
                            <StatCard
                                title="Avg. Customer Value"
                                value={formatCurrency(customerAnalytics.average_customer_value)}
                                color="amber"
                            />
                        </div>

                        {/* Customer Growth */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <SimpleLineChart
                                title="Customer Growth (Monthly)"
                                data={customerAnalytics.monthly_growth.map((m) => ({
                                    label: getMonthLabel(m.year, m.month),
                                    value: m.new_customers,
                                }))}
                                color="#8b5cf6"
                            />
                        </div>

                        {/* Top Customers */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Top Customers by Lifetime Value
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Customer
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Orders
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rentals
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Lifetime Value
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {customerAnalytics.top_customers.map((customer, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {customer.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {customer.email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {customer.order_count} ({formatCurrency(customer.order_spending)})
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {customer.rental_count} ({formatCurrency(customer.rental_spending)})
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                    {formatCurrency(customer.lifetime_value)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleBasedNavigation>
    );
};
