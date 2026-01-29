import time
import logging
import json
from bson import ObjectId
from flask import Flask, jsonify, request, send_from_directory
from app.config import Config
from flask.json.provider import DefaultJSONProvider
from app.extensions import init_extensions, log
from app.blueprints.core.routes import bp as core_bp
from app.blueprints.auth.routes import bp as auth_bp
from app.blueprints.staff import bp as staff_bp
from app.blueprints.customers.routes import bp as customers_bp
from app.blueprints.inventory.routes import bp as inventory_bp
from app.blueprints.payments import bp as payments_bp
from app.blueprints.market import bp as market_bp
from app.blueprints.catalog.routes import bp as catalog_bp
from app.blueprints.orders.routes import bp as orders_bp
from app.blueprints.admin_orders.routes import bp as admin_orders_bp
from app.blueprints.webhooks.razorpay_webhook import bp as webhooks_bp
from app.blueprints.store import bp as store_bp
from app.blueprints.store_manager.routes import bp as store_manager_bp
from app.blueprints.rentals.routes import bp as rentals_bp

# ---- GLOBAL ObjectId JSON PATCH ----
def default_json(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
json._default_encoder = json.JSONEncoder(default=default_json)

class MongoJSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        kwargs.setdefault('default', default_json)
        return json.dumps(obj, **kwargs)
    def loads(self, s, **kwargs):
        return json.loads(s, **kwargs)

def create_app():
    import os
    from flask import jsonify as flask_jsonify
    import flask
    app = Flask(__name__, static_folder='static')
    app.json_provider_class = MongoJSONProvider
    # Still set legacy encoder for very old extensions, if any
    try:
        app.json_encoder = MongoJSONProvider
    except Exception:
        pass
    app.config.from_object(Config)
    # Ensure INFO-level logs (so scheduler startup and job registration are visible)
    try:
        app.logger.setLevel(logging.INFO)
        logging.getLogger('werkzeug').setLevel(logging.INFO)
    except Exception:
        pass
    
    # Ensure static/uploads directory exists (for local development)
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    # Initialize Cloudinary for image uploads
    try:
        from app.utils.cloudinary_helper import init_cloudinary
        if init_cloudinary():
            app.logger.info("Cloudinary initialized for cloud image storage")
        else:
            app.logger.info("Cloudinary not configured - using local file storage")
    except Exception as e:
        app.logger.warning(f"Cloudinary initialization failed: {e}")
    
    init_extensions(app)

    # Optionally start background scheduler for gold rate refresh (reloader-safe)
    try:
        from app.scheduler import setup_scheduler
        from app.config import Config as _Cfg
        import os
        should_start = True
        # In debug with reloader, only start in the main process
        if app.debug:
            should_start = os.environ.get("WERKZEUG_RUN_MAIN") == "true"
        if getattr(_Cfg, "SCHEDULER_ENABLED", True) and should_start:
            scheduler = setup_scheduler(app)
            app.extensions['scheduler'] = scheduler
            app.logger.info("Scheduler initialized and attached to app.extensions")
        else:
            app.logger.info("Scheduler not started (disabled or reloader child process)")
    except Exception as _e:
        app.logger.error(f"Failed to start scheduler: {_e}")

    app.register_blueprint(core_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(customers_bp)

    # Inventory blueprint
    from app.blueprints.inventory.routes import bp as inventory_bp
    app.register_blueprint(inventory_bp)

    # Payments blueprint (demo/test)
    from app.blueprints.payments import bp as payments_bp
    app.register_blueprint(payments_bp)

    # Market data (gold rate) blueprint
    from app.blueprints.market import bp as market_bp
    app.register_blueprint(market_bp)

    # Catalog (advanced search & suggestions) blueprint
    from app.blueprints.catalog.routes import bp as catalog_bp
    app.register_blueprint(catalog_bp)
    
    # Virtual Try-On blueprint
    from app.blueprints.catalog.virtual_tryon import virtual_tryon_bp
    app.register_blueprint(virtual_tryon_bp)

    # Orders API (customer-facing)
    from app.blueprints.orders.routes import bp as orders_bp
    app.register_blueprint(orders_bp)

    # Admin Orders API
    from app.blueprints.admin_orders.routes import bp as admin_orders_bp
    app.register_blueprint(admin_orders_bp)

    # Webhooks (Razorpay, etc.)
    from app.blueprints.webhooks.razorpay_webhook import bp as webhooks_bp
    app.register_blueprint(webhooks_bp)

    # Store blueprint
    from app.blueprints.store import bp as store_bp
    app.register_blueprint(store_bp)

    # Store Manager blueprint
    from app.blueprints.store_manager.routes import bp as store_manager_bp
    app.register_blueprint(store_manager_bp)

    # Notifications blueprint
    from app.blueprints.notifications.routes import bp as notifications_bp
    app.register_blueprint(notifications_bp)

    # Alerts blueprint
    from app.blueprints.alerts.routes import bp as alerts_bp
    app.register_blueprint(alerts_bp)

    # Rentals blueprint
    from app.blueprints.rentals.routes import bp as rentals_bp
    app.register_blueprint(rentals_bp)
    
    # Rental Bookings blueprint
    from app.blueprints.rentals.booking_routes import bp_bookings as rental_bookings_bp
    app.register_blueprint(rental_bookings_bp)
    
    # Analytics blueprint
    from app.blueprints.analytics import bp as analytics_bp
    app.register_blueprint(analytics_bp)
    
    # Customer KYC blueprint
    from app.blueprints.customer_kyc import bp as customer_kyc_bp
    app.register_blueprint(customer_kyc_bp)
    
    # Admin KYC blueprint  
    from app.blueprints.admin_kyc import bp as admin_kyc_bp
    app.register_blueprint(admin_kyc_bp)

    # Explicit static file serving route with CORS and cache control headers
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        import os
        from flask import make_response
        
        if app.static_folder is None:
            return jsonify({"error": "static_folder_not_configured"}), 500
            
        try:
            response = send_from_directory(app.static_folder, filename)
            # Add CORS headers
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            # Disable caching for now to ensure fresh images
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        except Exception as e:
            app.logger.error(f"Error serving static file {filename}: {str(e)}")
            return jsonify({"error": "file_not_found"}), 404

    @app.route("/")
    def index():
        # List all routes for debugging
        output = []
        for rule in app.url_map.iter_rules():
            methods = ','.join(sorted((rule.methods or set()).difference({"HEAD", "OPTIONS"})))
            output.append(f"{methods} {rule}")
        return {"routes": output}

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(429)
    def rate_limit(e):
        return jsonify({"error": "rate_limited"}), 429

    @app.before_request
    def _start_timer():
        request._start = time.time()  # type: ignore

    @app.after_request
    def _log_request(response):
        latency = round((time.time() - getattr(request, "_start", time.time())) * 1000, 2)
        log.info(
            "request",
            method=request.method,
            path=request.path,
            status=response.status_code,
            latency_ms=latency,
            ip=request.remote_addr,
        )
        return response

    return app