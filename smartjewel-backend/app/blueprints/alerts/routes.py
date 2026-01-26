"""Blueprint for alert management API endpoints."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.alert_service import AlertService

bp = Blueprint('alerts', __name__, url_prefix='/api/alerts')


@bp.route('/create', methods=['POST'])
@jwt_required()
def create_alert():
    """Create a new alert for the authenticated user."""
    data = request.get_json()
    user_id = get_jwt_identity()  # Get user ID from JWT token
    
    alert_type = data.get('alert_type')
    if not alert_type or alert_type not in ['price_drop', 'back_in_stock', 'gold_rate']:
        return jsonify({'error': 'Invalid alert_type'}), 400
    
    # Validate required params based on type
    params = {}
    
    if alert_type == 'price_drop':
        if not data.get('product_id'):
            return jsonify({'error': 'product_id required for price_drop alerts'}), 400
        params['product_id'] = data['product_id']
        params['target_price'] = data.get('target_price')  # Optional
        
    elif alert_type == 'back_in_stock':
        if not data.get('product_id'):
            return jsonify({'error': 'product_id required for back_in_stock alerts'}), 400
        params['product_id'] = data['product_id']
        
    elif alert_type == 'gold_rate':
        if not data.get('gold_purity'):
            return jsonify({'error': 'gold_purity required for gold_rate alerts'}), 400
        params['gold_purity'] = data['gold_purity']
        params['threshold_drop'] = data.get('threshold_drop', 50)
    
    params['notification_methods'] = data.get('notification_methods', ['email', 'app'])
    
    alert_id = AlertService.create_alert(user_id, alert_type, params)
    
    if alert_id:
        return jsonify({
            'success': True,
            'alert_id': alert_id,
            'message': 'Alert created successfully'
        }), 201
    else:
        return jsonify({'error': 'Failed to create alert'}), 500


@bp.route('/my-alerts', methods=['GET'])
@jwt_required()
def get_my_alerts():
    """Get all alerts for the authenticated user."""
    user_id = get_jwt_identity()
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    alerts = AlertService.get_user_alerts(user_id, active_only=active_only)
    
    return jsonify({
        'success': True,
        'alerts': alerts,
        'count': len(alerts)
    }), 200


@bp.route('/<alert_id>', methods=['DELETE'])
@jwt_required()
def delete_alert(alert_id):
    """Delete an alert (only if it belongs to the authenticated user)."""
    user_id = get_jwt_identity()
    
    success = AlertService.delete_alert(alert_id, user_id)
    
    if success:
        return jsonify({
            'success': True,
            'message': 'Alert deleted successfully'
        }), 200
    else:
        return jsonify({'error': 'Failed to delete alert or alert not found'}), 404


@bp.route('/unsubscribe/<alert_id>', methods=['GET'])
def unsubscribe_alert(alert_id):
    """Public endpoint for unsubscribing from email alerts (no auth required)."""
    success = AlertService.deactivate_alert(alert_id)
    
    if success:
        # Return a simple HTML page confirming unsubscription
        return '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Unsubscribed - SmartJewel</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 400px;
                }
                h1 { color: #333; margin-bottom: 10px; }
                p { color: #666; line-height: 1.6; }
                a { color: #667eea; text-decoration: none; font-weight: 600; }
                a:hover { text-decoration: underline; }
                .icon { font-size: 48px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✓</div>
                <h1>Unsubscribed Successfully</h1>
                <p>You've been unsubscribed from this price alert.</p>
                <p>You can manage your other alerts in your <a href="/my-alerts">account settings</a>.</p>
            </div>
        </body>
        </html>
        ''', 200
    else:
        return jsonify({'error': 'Alert not found or already inactive'}), 404
