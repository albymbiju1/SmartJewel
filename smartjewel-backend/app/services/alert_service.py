from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from flask import current_app


class AlertService:
    """Service to manage user alerts for price drops, stock changes, and gold rates."""
    
    @staticmethod
    def create_alert(user_id: str, alert_type: str, params: Dict[str, Any]) -> Optional[str]:
        """
        Create a new alert for a user.
        
        Args:
            user_id: User ID string
            alert_type: 'price_drop', 'back_in_stock', or 'gold_rate'
            params: Alert-specific parameters
                For price_drop: {'product_id': str, 'target_price': float (optional)}
                For back_in_stock: {'product_id': str}
                For gold_rate: {'gold_purity': str, 'threshold_drop': float}
                
        Returns:
            Alert ID if created successfully, None otherwise
        """
        db = current_app.extensions.get('mongo_db')
        if not db:
            return None
            
        try:
            alert = {
                'user_id': ObjectId(user_id),
                'alert_type': alert_type,
                'notification_methods': params.get('notification_methods', ['email', 'app']),
                'is_active': True,
                'created_at': datetime.utcnow(),
                'triggered_at': None,
                'last_checked_at': None
            }
            
            # Add type-specific fields
            if alert_type == 'price_drop':
                alert['product_id'] = ObjectId(params['product_id'])
                alert['target_price'] = params.get('target_price')
                
            elif alert_type == 'back_in_stock':
                alert['product_id'] = ObjectId(params['product_id'])
                
            elif alert_type == 'gold_rate':
                alert['gold_purity'] = params['gold_purity']  # '24K', '22K', etc.
                alert['threshold_drop'] = params.get('threshold_drop', 50)  # ₹50/gram default
                
            result = db.alerts.insert_one(alert)
            print(f"[AlertService] Created {alert_type} alert {result.inserted_id} for user {user_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"[AlertService] Failed to create alert: {e}")
            return None
    
    @staticmethod
    def get_user_alerts(user_id: str, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all alerts for a user."""
        db = current_app.extensions.get('mongo_db')
        if not db:
            return []
            
        try:
            query = {'user_id': ObjectId(user_id)}
            if active_only:
                query['is_active'] = True
                
            alerts = list(db.alerts.find(query).sort('created_at', -1))
            
            # Enrich with product info for product alerts
            for alert in alerts:
                if alert.get('product_id'):
                    product = db.products.find_one({'_id': alert['product_id']})
                    if product:
                        alert['product'] = {
                            '_id': str(product['_id']),
                            'name': product.get('name'),
                            'price': product.get('price'),
                            'image': product.get('image'),
                            'sku': product.get('sku')
                        }
                # Convert ObjectIds to strings for JSON
                alert['_id'] = str(alert['_id'])
                alert['user_id'] = str(alert['user_id'])
                if alert.get('product_id'):
                    alert['product_id'] = str(alert['product_id'])
                    
            return alerts
            
        except Exception as e:
            print(f"[AlertService] Failed to get user alerts: {e}")
            return []
    
    @staticmethod
    def deactivate_alert(alert_id: str) -> bool:
        """Deactivate an alert (e.g., after it's triggered or user unsubscribes)."""
        db = current_app.extensions.get('mongo_db')
        if not db:
            return False
            
        try:
            result = db.alerts.update_one(
                {'_id': ObjectId(alert_id)},
                {'$set': {'is_active': False}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"[AlertService] Failed to deactivate alert: {e}")
            return False
    
    @staticmethod
    def delete_alert(alert_id: str, user_id: str) -> bool:
        """Delete an alert (only if it belongs to the user)."""
        db = current_app.extensions.get('mongo_db')
        if not db:
            return False
            
        try:
            result = db.alerts.delete_one({
                '_id': ObjectId(alert_id),
                'user_id': ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception as e:
            print(f"[AlertService] Failed to delete alert: {e}")
            return False
    
    @staticmethod
    def check_price_drops() -> int:
        """
        Check for price drops and trigger alerts.
        Called by scheduled job every 6 hours.
        
        Returns:
            Number of alerts triggered
        """
        db = current_app.extensions.get('mongo_db')
        if not db:
            return 0
            
        triggered_count = 0
        
        try:
            # Get all active price drop alerts
            alerts = list(db.alerts.find({
                'alert_type': 'price_drop',
                'is_active': True
            }))
            
            print(f"[AlertService] Checking {len(alerts)} price drop alerts")
            
            for alert in alerts:
                try:
                    product_id = alert['product_id']
                    product = db.products.find_one({'_id': product_id})
                    
                    if not product:
                        continue
                    
                    current_price = product.get('price')
                    if not current_price:
                        continue
                    
                    # Check if we have price history
                    last_price = db.price_history.find_one(
                        {'product_id': product_id},
                        sort=[('recorded_at', -1)]
                    )
                    
                    should_notify = False
                    
                    # If target price is set, check if current price is below it
                    if alert.get('target_price'):
                        if current_price <= alert['target_price']:
                            should_notify = True
                    # Otherwise, check for significant drop from last recorded price
                    elif last_price:
                        old_price = last_price.get('price')
                        if old_price:
                            drop_amount = old_price - current_price
                            drop_percentage = (drop_amount / old_price) * 100
                            
                            # Notify if price dropped >5% OR >₹1000
                            if drop_percentage >= 5 or drop_amount >= 1000:
                                should_notify = True
                    
                    if should_notify:
                        AlertService._trigger_price_drop_alert(alert, product, last_price)
                        triggered_count += 1
                        
                except Exception as e:
                    print(f"[AlertService] Error processing alert {alert.get('_id')}: {e}")
            
            # Record current prices
            AlertService._record_price_history()
            
            print(f"[AlertService] Triggered {triggered_count} price drop alerts")
            return triggered_count
            
        except Exception as e:
            print(f"[AlertService] Failed to check price drops: {e}")
            return 0
    
    @staticmethod
    def check_stock_changes() -> int:
        """
        Check for stock changes and trigger back-in-stock alerts.
        Called by scheduled job every 30 minutes.
        
        Returns:
            Number of alerts triggered
        """
        db = current_app.extensions.get('mongo_db')
        if not db:
            return 0
            
        triggered_count = 0
        
        try:
            # Get all active back-in-stock alerts
            alerts = list(db.alerts.find({
                'alert_type': 'back_in_stock',
                'is_active': True
            }))
            
            print(f"[AlertService] Checking {len(alerts)} stock alerts")
            
            for alert in alerts:
                try:
                    product_id = alert['product_id']
                    product = db.products.find_one({'_id': product_id})
                    
                    if not product:
                        continue
                    
                    quantity = product.get('quantity', 0)
                    
                    # If product is now in stock, trigger alert
                    if quantity > 0:
                        AlertService._trigger_stock_alert(alert, product)
                        triggered_count += 1
                        
                except Exception as e:
                    print(f"[AlertService] Error processing stock alert {alert.get('_id')}: {e}")
            
            print(f"[AlertService] Triggered {triggered_count} stock alerts")
            return triggered_count
            
        except Exception as e:
            print(f"[AlertService] Failed to check stock changes: {e}")
            return 0
    
    @staticmethod
    def _record_price_history():
        """Record current prices for all products."""
        db = current_app.extensions.get('mongo_db')
        if not db:
            return
            
        try:
            products = db.products.find({'price': {'$exists': True, '$ne': None}})
            
            for product in products:
                db.price_history.insert_one({
                    'product_id': product['_id'],
                    'price': product['price'],
                    'recorded_at': datetime.utcnow()
                })
            
            print(f"[AlertService] Recorded price history")
            
        except Exception as e:
            print(f"[AlertService] Failed to record price history: {e}")
    
    @staticmethod
    def _trigger_price_drop_alert(alert: Dict, product: Dict, last_price: Optional[Dict]):
        """Send price drop notification and mark alert as triggered."""
        from app.services.notification_service import send_order_status_notification
        from app.utils.email_templates import price_drop_email
        from app.utils.mailer import send_email
        
        db = current_app.extensions.get('mongo_db')
        if not db:
            return
            
        try:
            user = db.users.find_one({'_id': alert['user_id']})
            if not user:
                return
            
            old_price = last_price.get('price') if last_price else None
            new_price = product.get('price')
            savings = old_price - new_price if old_price else 0
            percentage = (savings / old_price * 100) if old_price and old_price > 0 else 0
            
            # Create in-app notification
            db.notifications.insert_one({
                'user_id': alert['user_id'],
                'title': f"Price Drop: {product.get('name')}",
                'message': f"Great news! {product.get('name')} is now ₹{new_price:,.0f}" + 
                          (f" (₹{savings:,.0f} off)" if savings > 0 else ""),
                'type': 'price_drop',
                'data': {
                    'product_id': str(product['_id']),
                    'old_price': old_price,
                    'new_price': new_price,
                    'savings': savings
                },
                'is_read': False,
                'created_at': datetime.utcnow(),
                'related_entity_id': str(product['_id']),
                'related_entity_type': 'product'
            })
            
            # Send email if enabled
            if 'email' in alert.get('notification_methods', []) and user.get('email'):
                try:
                    subject, text, html = price_drop_email(
                        user.get('name', user.get('email')),
                        product.get('name'),
                        product.get('image'),
                        old_price,
                        new_price,
                        savings,
                        percentage,
                        f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/product/{product['_id']}",
                        f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/alerts/unsubscribe/{alert['_id']}"
                    )
                    send_email(user['email'], subject, text, html)
                    print(f"[AlertService] Sent price drop email to {user['email']}")
                except Exception as e:
                    print(f"[AlertService] Failed to send price drop email: {e}")
            
            # Mark alert as triggered and deactivate (one-time alert)
            db.alerts.update_one(
                {'_id': alert['_id']},
                {
                    '$set': {
                        'is_active': False,
                        'triggered_at': datetime.utcnow()
                    }
                }
            )
            
            print(f"[AlertService] Triggered price drop alert for user {alert['user_id']}, product {product.get('name')}")
            
        except Exception as e:
            print(f"[AlertService] Failed to trigger price drop alert: {e}")
    
    @staticmethod
    def _trigger_stock_alert(alert: Dict, product: Dict):
        """Send back-in-stock notification and mark alert as triggered."""
        from app.utils.email_templates import stock_available_email
        from app.utils.mailer import send_email
        
        db = current_app.extensions.get('mongo_db')
        if not db:
            return
            
        try:
            user = db.users.find_one({'_id': alert['user_id']})
            if not user:
                return
            
            # Create in-app notification
            db.notifications.insert_one({
                'user_id': alert['user_id'],
                'title': f"Back in Stock: {product.get('name')}",
                'message': f"{product.get('name')} is back in stock! Order now before it's gone.",
                'type': 'back_in_stock',
                'data': {
                    'product_id': str(product['_id']),
                    'quantity': product.get('quantity')
                },
                'is_read': False,
                'created_at': datetime.utcnow(),
                'related_entity_id': str(product['_id']),
                'related_entity_type': 'product'
            })
            
            # Send email if enabled
            if 'email' in alert.get('notification_methods', []) and user.get('email'):
                try:
                    subject, text, html = stock_available_email(
                        user.get('name', user.get('email')),
                        product.get('name'),
                        product.get('image'),
                        product.get('price'),
                        f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/product/{product['_id']}"
                    )
                    send_email(user['email'], subject, text, html)
                    print(f"[AlertService] Sent stock alert email to {user['email']}")
                except Exception as e:
                    print(f"[AlertService] Failed to send stock alert email: {e}")
            
            # Mark alert as triggered and deactivate
            db.alerts.update_one(
                {'_id': alert['_id']},
                {
                    '$set': {
                        'is_active': False,
                        'triggered_at': datetime.utcnow()
                    }
                }
            )
            
            print(f"[AlertService] Triggered stock alert for user {alert['user_id']}, product {product.get('name')}")
            
        except Exception as e:
            print(f"[AlertService] Failed to trigger stock alert: {e}")
