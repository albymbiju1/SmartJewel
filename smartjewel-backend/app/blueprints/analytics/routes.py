from flask import jsonify, request, current_app
from datetime import datetime, timedelta
from bson import ObjectId
from app.utils.authz import require_roles
from . import bp


def _get_date_range():
    """Parse date range from query parameters or use default (last 30 days)."""
    from_date_str = request.args.get('from_date')
    to_date_str = request.args.get('to_date')
    
    if to_date_str:
        to_date = datetime.fromisoformat(to_date_str.replace('Z', '+00:00'))
    else:
        to_date = datetime.utcnow()
    
    if from_date_str:
        from_date = datetime.fromisoformat(from_date_str.replace('Z', '+00:00'))
    else:
        from_date = to_date - timedelta(days=30)
    
    return from_date, to_date


@bp.route('/rentals', methods=['GET'])
@require_roles('Admin')
def get_rental_analytics():
    """Get rental analytics including revenue, popular items, and trends."""
    db = current_app.extensions['mongo_db']
    from_date, to_date = _get_date_range()
    
    try:
        # Total rental revenue
        revenue_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': from_date, '$lte': to_date}
                    # Include all payment statuses to show all bookings
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_revenue': {'$sum': '$total_amount'},
                    'total_bookings': {'$sum': 1}
                }
            }
        ]
        revenue_result = list(db.rental_bookings.aggregate(revenue_pipeline))
        total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
        total_bookings = revenue_result[0]['total_bookings'] if revenue_result else 0
        
        # Active vs completed rentals
        active_rentals = db.rental_bookings.count_documents({
            'booking_status': {'$in': ['confirmed', 'active']},
            'created_at': {'$gte': from_date, '$lte': to_date}
        })
        
        completed_rentals = db.rental_bookings.count_documents({
            'booking_status': 'completed',
            'created_at': {'$gte': from_date, '$lte': to_date}
        })
        
        # Most popular rental items (top 10)
        popular_items_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': from_date, '$lte': to_date}
                }
            },
            {
                '$group': {
                    '_id': '$rental_item_id',
                    'booking_count': {'$sum': 1},
                    'total_revenue': {'$sum': '$total_amount'}
                }
            },
            {
                '$sort': {'booking_count': -1}
            },
            {
                '$limit': 10
            },
            {
                '$lookup': {
                    'from': 'rental_items',
                    'localField': '_id',
                    'foreignField': '_id',
                    'as': 'item_info'
                }
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': 'item_info.product_id',
                    'foreignField': '_id',
                    'as': 'product_info'
                }
            }
        ]
        popular_items = list(db.rental_bookings.aggregate(popular_items_pipeline))
        
        # Format popular items
        formatted_popular_items = []
        for item in popular_items:
            product = item['product_info'][0] if item.get('product_info') else {}
            formatted_popular_items.append({
                'rental_item_id': str(item['_id']),
                'product_name': product.get('name', 'Unknown'),
                'booking_count': item['booking_count'],
                'total_revenue': float(item['total_revenue'])
            })
        
        # Average rental duration
        duration_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': from_date, '$lte': to_date},
                    'duration_days': {'$exists': True}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'avg_duration': {'$avg': '$duration_days'}
                }
            }
        ]
        duration_result = list(db.rental_bookings.aggregate(duration_pipeline))
        avg_duration = duration_result[0]['avg_duration'] if duration_result else 0
        
        # Monthly rental revenue trend (last 12 months)
        twelve_months_ago = to_date - timedelta(days=365)
        monthly_trend_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': twelve_months_ago, '$lte': to_date}
                    # Include all bookings for trend analysis
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$created_at'},
                        'month': {'$month': '$created_at'}
                    },
                    'revenue': {'$sum': '$total_amount'},
                    'bookings': {'$sum': 1}
                }
            },
            {
                '$sort': {'_id.year': 1, '_id.month': 1}
            }
        ]
        monthly_trend = list(db.rental_bookings.aggregate(monthly_trend_pipeline))
        
        # Format monthly trend
        formatted_monthly_trend = []
        for month_data in monthly_trend:
            formatted_monthly_trend.append({
                'year': month_data['_id']['year'],
                'month': month_data['_id']['month'],
                'revenue': float(month_data['revenue']),
                'bookings': month_data['bookings']
            })
        
        return jsonify({
            'total_revenue': float(total_revenue),
            'total_bookings': total_bookings,
            'active_rentals': active_rentals,
            'completed_rentals': completed_rentals,
            'popular_items': formatted_popular_items,
            'average_duration_days': round(float(avg_duration), 1),
            'monthly_trend': formatted_monthly_trend
        }), 200
        
    except Exception as e:
        print(f"Error in rental analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch rental analytics'}), 500


@bp.route('/revenue', methods=['GET'])
@require_roles('Admin')
def get_revenue_analytics():
    """Get comprehensive revenue analytics from both sales and rentals."""
    db = current_app.extensions['mongo_db']
    from_date, to_date = _get_date_range()
    
    try:
        # Sales revenue
        sales_pipeline = [
            # Temporarily remove date filter to test
            # {
            #     '$match': {
            #         'createdAt': {'$gte': from_date, '$lte': to_date}
            #     }
            # },
            {
                '$group': {
                    '_id': None,
                    # Use totalAmount if it exists, otherwise fallback to amount
                    'total_sales': {'$sum': {'$ifNull': ['$totalAmount', '$amount']}}
                }
            }
        ]
        sales_result = list(db.orders.aggregate(sales_pipeline))
        
        # Debug logging
        print(f"[ANALYTICS DEBUG] Total orders in DB: {db.orders.count_documents({})}")
        print(f"[ANALYTICS DEBUG] Sales aggregation result: {sales_result}")
        
        sales_revenue = sales_result[0]['total_sales'] if sales_result else 0
        
        # Rental revenue (without date filter for now)
        rentals_pipeline = [
            # Temporarily remove filters to get all rental revenue
            # {
            #     '$match': {
            #         'created_at': {'$gte': from_date, '$lte': to_date}
            #     }
            # },
            {
                '$group': {
                    '_id': None,
                    'total_rentals': {'$sum': '$total_amount'}
                }
            }
        ]
        rentals_result = list(db.rental_bookings.aggregate(rentals_pipeline))
        rental_revenue = rentals_result[0]['total_rentals'] if rentals_result else 0
        
        # Total revenue
        total_revenue = sales_revenue + rental_revenue
        
        # Monthly revenue trend - temporarily disabled date filtering for orders
        twelve_months_ago = to_date - timedelta(days=365)
        
        # Sales by month - no date filter for now, so just get total
        monthly_sales_pipeline = [
            {
                '$group': {
                    '_id': None,
                    'amount': {'$sum': {'$ifNull': ['$totalAmount', '$amount']}}
                }
            }
        ]
        monthly_sales = list(db.orders.aggregate(monthly_sales_pipeline))
        
        # Rentals by month - using created_at field
        monthly_rentals_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': twelve_months_ago, '$lte': to_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$createdAt'},
                        'month': {'$month': '$createdAt'}
                    },
                    'amount': {'$sum': '$total_amount'}
                }
            },
            {
                '$sort': {'_id.year': 1, '_id.month': 1}
            }
        ]
        monthly_rentals = list(db.rental_bookings.aggregate(monthly_rentals_pipeline))
        
        # Combine and format monthly trends
        # Skip if we don't have date grouping (when _id is None)
        monthly_trend = {}
        for month_data in monthly_sales:
            if month_data.get('_id') is None:
                # No date grouping, skip monthly trend
                continue
            key = f"{month_data['_id']['year']}-{month_data['_id']['month']}"
            monthly_trend[key] = {
                'year': month_data['_id']['year'],
                'month': month_data['_id']['month'],
                'sales': float(month_data['amount']),
                'rentals': 0
            }
        
        for month_data in monthly_rentals:
            if month_data.get('_id') is None:
                # No date grouping, skip
                continue
            key = f"{month_data['_id']['year']}-{month_data['_id']['month']}"
            if key in monthly_trend:
                monthly_trend[key]['rentals'] = float(month_data['amount'])
            else:
                monthly_trend[key] = {
                    'year': month_data['_id']['year'],
                    'month': month_data['_id']['month'],
                    'sales': 0,
                    'rentals': float(month_data['amount'])
                }
        
        # Convert to list and sort
        formatted_monthly_trend = sorted(
            monthly_trend.values(),
            key=lambda x: (x['year'], x['month'])
        )
        
        # Add total for each month
        for month in formatted_monthly_trend:
            month['total'] = month['sales'] + month['rentals']
        
        # Revenue by category (from orders) - no date filter for now
        category_pipeline = [
            # {
            #     '$match': {
            #         'updatedAt': {'$gte': from_date, '$lte': to_date}
            #     }
            # },
            {
                '$unwind': '$items'
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': 'items.item_id',
                    'foreignField': '_id',
                    'as': 'product'
                }
            },
            {
                '$unwind': '$product'
            },
            {
                '$group': {
                    '_id': '$product.category',
                    'revenue': {'$sum': '$items.price'}
                }
            },
            {
                '$sort': {'revenue': -1}
            }
        ]
        category_revenue = list(db.orders.aggregate(category_pipeline))
        
        formatted_category_revenue = [
            {
                'category': item['_id'] if item['_id'] else 'Uncategorized',
                'revenue': float(item['revenue'])
            }
            for item in category_revenue
        ]
        
        return jsonify({
            'total_revenue': float(total_revenue),
            'sales_revenue': float(sales_revenue),
            'rental_revenue': float(rental_revenue),
            'revenue_breakdown': {
                'sales': float(sales_revenue),
                'rentals': float(rental_revenue)
            },
            'monthly_trend': formatted_monthly_trend,
            'category_revenue': formatted_category_revenue
        }), 200
        
    except Exception as e:
        print(f"Error in revenue analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch revenue analytics'}), 500


@bp.route('/products', methods=['GET'])
@require_roles('Admin')
def get_product_analytics():
    """Get product performance analytics."""
    db = current_app.extensions['mongo_db']
    from_date, to_date = _get_date_range()
    
    try:
        # Top selling products (by order count) - no date filter for now
        top_selling_pipeline = [
            # {
            #     '$match': {
            #         'updatedAt': {'$gte': from_date, '$lte': to_date}
            #     }
            # },
            {
                '$unwind': '$items'
            },
            {
                '$addFields': {
                    'items.item_oid': {'$toObjectId': '$items.id'}  # Convert string ID to ObjectId
                }
            },
            {
                '$group': {
                    '_id': '$items.item_oid',  # Group by ObjectId instead
                    'order_count': {'$sum': 1},
                    'total_revenue': {'$sum': '$items.price'}
                }
            },
            {
                '$sort': {'order_count': -1}
            },
            {
                '$limit': 10
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': '_id',  # Now _id is ObjectId
                    'foreignField': '_id',
                    'as': 'product'
                }
            },
            {
                '$unwind': '$product'
            }
        ]
        top_selling = list(db.orders.aggregate(top_selling_pipeline))
        
        formatted_top_selling = [
            {
                'product_id': str(item['_id']),
                'product_name': item['product'].get('name', 'Unknown'),
                'sku': item['product'].get('sku', 'N/A'),
                'category': item['product'].get('category', 'Uncategorized'),
                'order_count': item['order_count'],
                'revenue': float(item['total_revenue'])
            }
            for item in top_selling
        ]
        
        # Most rented products - using created_at field
        most_rented_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': from_date, '$lte': to_date}
                }
            },
            {
                '$group': {
                    '_id': '$rental_item_id',
                    'rental_count': {'$sum': 1},
                    'total_revenue': {'$sum': '$total_amount'}
                }
            },
            {
                '$sort': {'rental_count': -1}
            },
            {
                '$limit': 10
            },
            {
                '$lookup': {
                    'from': 'rental_items',
                    'localField': '_id',
                    'foreignField': '_id',
                    'as': 'rental_item'
                }
            },
            {
                '$unwind': '$rental_item'
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': 'rental_item.product_id',
                    'foreignField': '_id',
                    'as': 'product'
                }
            },
            {
                '$unwind': '$product'
            }
        ]
        most_rented = list(db.rental_bookings.aggregate(most_rented_pipeline))
        
        formatted_most_rented = [
            {
                'rental_item_id': str(item['_id']),
                'product_name': item['product'].get('name', 'Unknown'),
                'sku': item['product'].get('sku', 'N/A'),
                'category': item['product'].get('category', 'Uncategorized'),
                'rental_count': item['rental_count'],
                'revenue': float(item['total_revenue'])
            }
            for item in most_rented
        ]
        
        # Category performance (combining sales and rentals)
        # Sales by category - no date filter for now
        sales_category_pipeline = [
            # {
            #     '$match': {
            #         'updatedAt': {'$gte': from_date, '$lte': to_date}
            #     }
            # },
            {
                '$unwind': '$items'
            },
            {
                '$addFields': {
                    'items.item_oid': {'$toObjectId': '$items.id'}  # Convert string ID to ObjectId
                }
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': 'items.item_oid',  # Use ObjectId for lookup
                    'foreignField': '_id',
                    'as': 'product'
                }
            },
            {
                '$unwind': '$product'
            },
            {
                '$group': {
                    '_id': '$product.category',
                    'sales_count': {'$sum': 1},
                    'sales_revenue': {'$sum': '$items.price'}
                }
            }
        ]
        sales_by_category = list(db.orders.aggregate(sales_category_pipeline))
        
        # Rentals by category - using created_at field
        rentals_category_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': from_date, '$lte': to_date}
                }
            },
            {
                '$lookup': {
                    'from': 'rental_items',
                    'localField': 'rental_item_id',
                    'foreignField': '_id',
                    'as': 'rental_item'
                }
            },
            {
                '$unwind': '$rental_item'
            },
            {
                '$lookup': {
                    'from': 'items',
                    'localField': 'rental_item.product_id',
                    'foreignField': '_id',
                    'as': 'product'
                }
            },
            {
                '$unwind': '$product'
            },
            {
                '$group': {
                    '_id': '$product.category',
                    'rental_count': {'$sum': 1},
                    'rental_revenue': {'$sum': '$total_amount'}
                }
            }
        ]
        rentals_by_category = list(db.rental_bookings.aggregate(rentals_category_pipeline))
        
        # Combine category data
        category_performance = {}
        for item in sales_by_category:
            category = item['_id'] if item['_id'] else 'Uncategorized'
            category_performance[category] = {
                'category': category,
                'sales_count': item['sales_count'],
                'sales_revenue': float(item['sales_revenue']),
                'rental_count': 0,
                'rental_revenue': 0
            }
        
        for item in rentals_by_category:
            category = item['_id'] if item['_id'] else 'Uncategorized'
            if category in category_performance:
                category_performance[category]['rental_count'] = item['rental_count']
                category_performance[category]['rental_revenue'] = float(item['rental_revenue'])
            else:
                category_performance[category] = {
                    'category': category,
                    'sales_count': 0,
                    'sales_revenue': 0,
                    'rental_count': item['rental_count'],
                    'rental_revenue': float(item['rental_revenue'])
                }
        
        # Add totals
        for category in category_performance.values():
            category['total_count'] = category['sales_count'] + category['rental_count']
            category['total_revenue'] = category['sales_revenue'] + category['rental_revenue']
        
        formatted_category_performance = sorted(
            category_performance.values(),
            key=lambda x: x['total_revenue'],
            reverse=True
        )
        
        return jsonify({
            'top_selling_products': formatted_top_selling,
            'most_rented_products': formatted_most_rented,
            'category_performance': formatted_category_performance
        }), 200
        
    except Exception as e:
        print(f"Error in product analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch product analytics'}), 500


@bp.route('/customers', methods=['GET'])
@require_roles('Admin')
def get_customer_analytics():
    """Get customer insights and analytics."""
    db = current_app.extensions['mongo_db']
    from_date, to_date = _get_date_range()
    
    try:
        # Total customers
        total_customers = db.users.count_documents({
            'role.role_name': 'Customer',
            'status': 'active'
        })
        
        # New customers in date range
        new_customers = db.users.count_documents({
            'role.role_name': 'Customer',
            'status': 'active',
            'created_at': {'$gte': from_date, '$lte': to_date}
        })
        
        # Monthly customer growth (last 12 months)
        twelve_months_ago = to_date - timedelta(days=365)
        monthly_growth_pipeline = [
            {
                '$match': {
                    'role.role_name': 'Customer',
                    'created_at': {'$gte': twelve_months_ago, '$lte': to_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$created_at'},
                        'month': {'$month': '$created_at'}
                    },
                    'new_customers': {'$sum': 1}
                }
            },
            {
                '$sort': {'_id.year': 1, '_id.month': 1}
            }
        ]
        monthly_growth = list(db.users.aggregate(monthly_growth_pipeline))
        
        formatted_monthly_growth = [
            {
                'year': item['_id']['year'],
                'month': item['_id']['month'],
                'new_customers': item['new_customers']
            }
            for item in monthly_growth
        ]
        
        # Top customers by lifetime value (orders + rentals)
        # Get customer spending from orders
        orders_spending_pipeline = [
            {
                '$group': {
                    '_id': '$customer.email',
                    'order_spending': {'$sum': '$amount'},
                    'order_count': {'$sum': 1},
                    'customer_name': {'$first': '$customer.name'}
                }
            }
        ]
        orders_spending = list(db.orders.aggregate(orders_spending_pipeline))
        
        # Get customer spending from rentals
        rentals_spending_pipeline = [
            {
                '$match': {
                    'payment_status': 'completed'
                }
            },
            {
                '$group': {
                    '_id': '$customer_email',
                    'rental_spending': {'$sum': '$total_amount'},
                    'rental_count': {'$sum': 1}
                }
            }
        ]
        rentals_spending = list(db.rental_bookings.aggregate(rentals_spending_pipeline))
        
        # Combine customer spending
        customer_value = {}
        for item in orders_spending:
            email = item['_id']
            customer_value[email] = {
                'email': email,
                'name': item.get('customer_name', 'Unknown'),
                'order_spending': float(item['order_spending']),
                'order_count': item['order_count'],
                'rental_spending': 0,
                'rental_count': 0
            }
        
        for item in rentals_spending:
            email = item['_id']
            if email in customer_value:
                customer_value[email]['rental_spending'] = float(item['rental_spending'])
                customer_value[email]['rental_count'] = item['rental_count']
            else:
                customer_value[email] = {
                    'email': email,
                    'name': 'Unknown',
                    'order_spending': 0,
                    'order_count': 0,
                    'rental_spending': float(item['rental_spending']),
                    'rental_count': item['rental_count']
                }
        
        # Calculate lifetime value and sort
        for customer in customer_value.values():
            customer['lifetime_value'] = customer['order_spending'] + customer['rental_spending']
            customer['total_transactions'] = customer['order_count'] + customer['rental_count']
        
        top_customers = sorted(
            customer_value.values(),
            key=lambda x: x['lifetime_value'],
            reverse=True
        )[:10]
        
        # Average customer value
        total_value = sum(c['lifetime_value'] for c in customer_value.values())
        avg_customer_value = total_value / len(customer_value) if customer_value else 0
        
        return jsonify({
            'total_customers': total_customers,
            'new_customers': new_customers,
            'monthly_growth': formatted_monthly_growth,
            'top_customers': top_customers,
            'average_customer_value': round(float(avg_customer_value), 2)
        }), 200
        
    except Exception as e:
        print(f"Error in customer analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch customer analytics'}), 500
