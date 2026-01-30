from .routes import bp  # re-export blueprint for app.register_blueprint

# Virtual try-on feature requires heavy ML dependencies (PIL, torch, rembg)
# These are too large for Vercel's serverless environment, so we import conditionally
try:
    from .virtual_tryon import virtual_tryon_bp
    VIRTUAL_TRYON_AVAILABLE = True
except ImportError as e:
    # Log the import error but don't crash the app
    import structlog
    logger = structlog.get_logger()
    logger.warning("virtual_tryon_unavailable", error=str(e), 
                   message="Virtual try-on feature disabled - ML dependencies not available")
    virtual_tryon_bp = None
    VIRTUAL_TRYON_AVAILABLE = False
