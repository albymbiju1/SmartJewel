import { api } from '../api';

export interface RentalAnalytics {
    total_revenue: number;
    total_bookings: number;
    active_rentals: number;
    completed_rentals: number;
    popular_items: Array<{
        rental_item_id: string;
        product_name: string;
        booking_count: number;
        total_revenue: number;
    }>;
    average_duration_days: number;
    monthly_trend: Array<{
        year: number;
        month: number;
        revenue: number;
        bookings: number;
    }>;
}

export interface RevenueAnalytics {
    total_revenue: number;
    sales_revenue: number;
    rental_revenue: number;
    revenue_breakdown: {
        sales: number;
        rentals: number;
    };
    monthly_trend: Array<{
        year: number;
        month: number;
        sales: number;
        rentals: number;
        total: number;
    }>;
    category_revenue: Array<{
        category: string;
        revenue: number;
    }>;
}

export interface ProductAnalytics {
    top_selling_products: Array<{
        product_id: string;
        product_name: string;
        sku: string;
        category: string;
        order_count: number;
        revenue: number;
    }>;
    most_rented_products: Array<{
        rental_item_id: string;
        product_name: string;
        sku: string;
        category: string;
        rental_count: number;
        revenue: number;
    }>;
    category_performance: Array<{
        category: string;
        sales_count: number;
        sales_revenue: number;
        rental_count: number;
        rental_revenue: number;
        total_count: number;
        total_revenue: number;
    }>;
}

export interface CustomerAnalytics {
    total_customers: number;
    new_customers: number;
    monthly_growth: Array<{
        year: number;
        month: number;
        new_customers: number;
    }>;
    top_customers: Array<{
        email: string;
        name: string;
        order_spending: number;
        order_count: number;
        rental_spending: number;
        rental_count: number;
        lifetime_value: number;
        total_transactions: number;
    }>;
    average_customer_value: number;
}

export interface DateRange {
    from_date?: string;
    to_date?: string;
}

export const analyticsService = {
    async getRentalAnalytics(dateRange?: DateRange): Promise<RentalAnalytics> {
        const params = new URLSearchParams();
        if (dateRange?.from_date) params.append('from_date', dateRange.from_date);
        if (dateRange?.to_date) params.append('to_date', dateRange.to_date);

        const response = await api.get<RentalAnalytics>(
            `/analytics/rentals${params.toString() ? `?${params.toString()}` : ''}`
        );
        return response.data;
    },

    async getRevenueAnalytics(dateRange?: DateRange): Promise<RevenueAnalytics> {
        const params = new URLSearchParams();
        if (dateRange?.from_date) params.append('from_date', dateRange.from_date);
        if (dateRange?.to_date) params.append('to_date', dateRange.to_date);

        const response = await api.get<RevenueAnalytics>(
            `/analytics/revenue${params.toString() ? `?${params.toString()}` : ''}`
        );
        return response.data;
    },

    async getProductAnalytics(dateRange?: DateRange): Promise<ProductAnalytics> {
        const params = new URLSearchParams();
        if (dateRange?.from_date) params.append('from_date', dateRange.from_date);
        if (dateRange?.to_date) params.append('to_date', dateRange.to_date);

        const response = await api.get<ProductAnalytics>(
            `/analytics/products${params.toString() ? `?${params.toString()}` : ''}`
        );
        return response.data;
    },

    async getCustomerAnalytics(dateRange?: DateRange): Promise<CustomerAnalytics> {
        const params = new URLSearchParams();
        if (dateRange?.from_date) params.append('from_date', dateRange.from_date);
        if (dateRange?.to_date) params.append('to_date', dateRange.to_date);

        const response = await api.get<CustomerAnalytics>(
            `/analytics/customers${params.toString() ? `?${params.toString()}` : ''}`
        );
        return response.data;
    },
};
