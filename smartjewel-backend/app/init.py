import time
from flask import Flask, jsonify, request
from app.config import Config
from app.extensions import init_extensions, log
from app.blueprints.core.routes import bp as core_bp
from app.blueprints.auth.routes import bp as auth_bp
from app.blueprints.staff import bp as staff_bp
from app.blueprints.customers.routes import bp as customers_bp

def create_app():
    import os
    app = Flask(__name__, static_folder='static')
    app.config.from_object(Config)
    
    # Ensure static/uploads directory exists
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    init_extensions(app)


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

    @app.route("/")
    def index():
        # List all routes for debugging
        output = []
        for rule in app.url_map.iter_rules():
            methods = ','.join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
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
        request._start = time.time()

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