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
        if db is None:
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
                
            # Deduplication: check for an existing active alert of the same type for the same user+product
            dedup_query: Dict[str, Any] = {
                'user_id': ObjectId(user_id),
                'alert_type': alert_type,
                'is_active': True,
            }
            if alert_type in ('price_drop', 'back_in_stock'):
                dedup_query['product_id'] = ObjectId(params['product_id'])

            existing = list(db.alerts.find(dedup_query).sort('created_at', 1))
            if existing:
                # Keep the first one, delete any extras silently
                keep_id = existing[0]['_id']
                extra_ids = [a['_id'] for a in existing[1:]]
                if extra_ids:
                    db.alerts.delete_many({'_id': {'$in': extra_ids}})
                    print(f"[AlertService] Removed {len(extra_ids)} duplicate alert(s) for user {user_id}")
                # Update target_price if a new one was supplied
                if alert_type == 'price_drop' and params.get('target_price') is not None:
                    db.alerts.update_one({'_id': keep_id}, {'$set': {'target_price': params.get('target_price')}})
                print(f"[AlertService] Returning existing {alert_type} alert {keep_id} for user {user_id}")
                return str(keep_id)

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
        if db is None:
            return []
            
        try:
            query = {'user_id': ObjectId(user_id)}
            if active_only:
                query['is_active'] = True
                
            alerts = list(db.alerts.find(query).sort('created_at', -1))
            
            # Enrich with product info for product alerts
            for alert in alerts:
                if alert.get('product_id'):
                    product = db.items.find_one({'_id': alert['product_id']})
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
        if db is None:
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
        if db is None:
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
    def trigger_stock_alerts_for_product(product_id: str) -> int:
        """
        Immediately fire all active back-in-stock alerts for a specific product.
        Called right after stock arrives (inward stock move or quantity update).

        Returns number of alerts triggered.
        """
        db = current_app.extensions.get('mongo_db')
        if db is None:
            return 0

        triggered_count = 0
        try:
            alerts = list(db.alerts.find({
                'alert_type': 'back_in_stock',
                'product_id': ObjectId(product_id),
                'is_active': True
            }))

            print(f"[AlertService] Spot stock check: {len(alerts)} back-in-stock alert(s) for product {product_id}")
            triggered_count = AlertService._evaluate_stock_alerts(alerts, db)

        except Exception as e:
            print(f"[AlertService] trigger_stock_alerts_for_product failed: {e}")

        return triggered_count

    @staticmethod
    def trigger_price_drop_alerts_for_product(product_id: str, new_price: float) -> int:
        """
        Immediately check and fire price drop alerts for a specific product
        when its price has just been manually updated by admin.

        Returns number of alerts triggered.
        """
        db = current_app.extensions.get('mongo_db')
        if db is None:
            return 0

        triggered_count = 0
        try:
            alerts = list(db.alerts.find({
                'alert_type': 'price_drop',
                'product_id': ObjectId(product_id),
                'is_active': True
            }))

            print(f"[AlertService] Spot price check: {len(alerts)} price-drop alert(s) for product {product_id} at new price \u20b9{new_price}")
            triggered_count = AlertService._evaluate_price_drop_alerts(alerts, db, price_override=new_price)

        except Exception as e:
            print(f"[AlertService] trigger_price_drop_alerts_for_product failed: {e}")

        return triggered_count

    @staticmethod
    def check_alert_immediately(alert_id: str) -> bool:
        """
        Right after alert creation: check if the condition is already met
        and fire the notification immediately if so.

        Returns True if the alert was triggered.
        """
        db = current_app.extensions.get('mongo_db')
        if db is None:
            return False

        try:
            alert = db.alerts.find_one({'_id': ObjectId(alert_id)})
            if not alert or not alert.get('is_active'):
                return False

            alert_type = alert.get('alert_type')

            # --- price_drop: trigger if current price is already <= target price ---
            if alert_type == 'price_drop' and alert.get('product_id'):
                triggered = AlertService._evaluate_price_drop_alerts([alert], db)
                if triggered > 0:
                    print(f"[AlertService] Immediate trigger for price_drop")
                    return True

            # --- back_in_stock: trigger if item is already in stock ---
            elif alert_type == 'back_in_stock' and alert.get('product_id'):
                triggered = AlertService._evaluate_stock_alerts([alert], db)
                if triggered > 0:
                    print(f"[AlertService] Immediate trigger for back_in_stock")
                    return True

        except Exception as e:
            print(f"[AlertService] Immediate check failed: {e}")

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
        if db is None:
            return 0
            
        triggered_count = 0
        
        try:
            # Get all active price drop alerts
            alerts = list(db.alerts.find({
                'alert_type': 'price_drop',
                'is_active': True
            }))
            
            print(f"[AlertService] Checking {len(alerts)} price drop alerts")
            triggered_count = AlertService._evaluate_price_drop_alerts(alerts, db)
            
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
        if db is None:
            return 0
            
        triggered_count = 0
        
        try:
            # Get all active back-in-stock alerts
            alerts = list(db.alerts.find({
                'alert_type': 'back_in_stock',
                'is_active': True
            }))
            
            print(f"[AlertService] Checking {len(alerts)} stock alerts")
            triggered_count = AlertService._evaluate_stock_alerts(alerts, db)
            
            print(f"[AlertService] Triggered {triggered_count} stock alerts")
            return triggered_count
            
        except Exception as e:
            print(f"[AlertService] Failed to check stock changes: {e}")
            return 0
    
    @staticmethod
    def _evaluate_price_drop_alerts(alerts: List[Dict[str, Any]], db, price_override: Optional[float] = None) -> int:
        """
        Evaluate a list of price drop alerts.
        Handles deduplication and condition checking.
        If price_override is provided, uses that price instead of fetching from db (useful for spot checks before commit).
        """
        triggered_count = 0
        seen_users: set = set()

        for alert in alerts:
            alert_id = alert['_id']
            uid = str(alert.get('user_id'))
            product_id = alert.get('product_id')

            if not product_id:
                continue

            # Deduplicate per user for the same product
            dedup_key = (uid, str(product_id))
            if dedup_key in seen_users:
                db.alerts.update_one({'_id': alert_id}, {'$set': {'is_active': False, 'triggered_at': datetime.utcnow()}})
                continue
            seen_users.add(dedup_key)

            try:
                product = db.items.find_one({'_id': product_id})
                if not product:
                    continue

                if price_override is not None:
                    product = dict(product)
                    product['price'] = price_override
                
                current_price = product.get('price')
                if not current_price:
                    continue

                should_notify = False
                target_price = alert.get('target_price')
                last_price = db.price_history.find_one(
                    {'product_id': product_id},
                    sort=[('recorded_at', -1)]
                )

                if target_price:
                    if current_price <= target_price:
                        should_notify = True
                elif last_price:
                    old_price = last_price.get('price', 0)
                    if old_price > 0:
                        drop = old_price - current_price
                        if drop >= 1000 or (drop / old_price * 100) >= 5:
                            should_notify = True

                if should_notify:
                    AlertService._trigger_price_drop_alert(alert, product, last_price)
                    triggered_count += 1
            except Exception as e:
                print(f"[AlertService] Error evaluating price drop alert {alert_id}: {e}")

        return triggered_count

    @staticmethod
    def _evaluate_stock_alerts(alerts: List[Dict[str, Any]], db) -> int:
        """
        Evaluate a list of back-in-stock alerts.
        Handles deduplication and condition checking.
        """
        triggered_count = 0
        seen_users: set = set()

        for alert in alerts:
            alert_id = alert['_id']
            uid = str(alert.get('user_id'))
            product_id = alert.get('product_id')

            if not product_id:
                continue

            # Deduplicate per user for the same product
            dedup_key = (uid, str(product_id))
            if dedup_key in seen_users:
                db.alerts.update_one({'_id': alert_id}, {'$set': {'is_active': False, 'triggered_at': datetime.utcnow()}})
                continue
            seen_users.add(dedup_key)

            try:
                product = db.items.find_one({'_id': product_id})
                if not product:
                    continue

                if product.get('quantity', 0) > 0:
                    AlertService._trigger_stock_alert(alert, product)
                    triggered_count += 1
            except Exception as e:
                print(f"[AlertService] Error evaluating stock alert {alert_id}: {e}")

        return triggered_count

    @staticmethod
    def _record_price_history():
        """Record current prices for all products."""
        db = current_app.extensions.get('mongo_db')
        if db is None:
            return
            
        try:
            products = db.items.find({'price': {'$exists': True, '$ne': None}})
            
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
        if db is None:
            return
            
        try:
            user = db.users.find_one({'_id': alert['user_id']})
            if not user:
                return
            
            old_price = last_price.get('price') if last_price else None
            new_price = product.get('price')
            savings = old_price - new_price if old_price else 0
            percentage = (savings / old_price * 100) if old_price and old_price > 0 else 0
            
            # Upsert: update existing unread notification rather than stacking duplicates
            notif_doc = {
                'user_id': alert['user_id'],
                'title': f"Price Drop: {product.get('name')}",
                'message': f"Great news! {product.get('name')} is now \u20b9{new_price:,.0f}" +
                          (f" (\u20b9{savings:,.0f} off)" if savings > 0 else ""),
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
            }
            db.notifications.update_one(
                {
                    'user_id': alert['user_id'],
                    'type': 'price_drop',
                    'related_entity_id': str(product['_id']),
                    'is_read': False
                },
                {'$set': notif_doc},
                upsert=True
            )


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
        if db is None:
            return
            
        try:
            user = db.users.find_one({'_id': alert['user_id']})
            if not user:
                return
            
            # Upsert notification: update existing unread one instead of inserting a duplicate
            notif_doc = {
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
            }
            db.notifications.update_one(
                {
                    'user_id': alert['user_id'],
                    'type': 'back_in_stock',
                    'related_entity_id': str(product['_id']),
                    'is_read': False
                },
                {'$set': notif_doc},
                upsert=True
            )
            
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
