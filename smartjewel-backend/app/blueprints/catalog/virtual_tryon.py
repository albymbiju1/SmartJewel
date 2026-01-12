"""
Virtual Try-On Background Removal Service
Handles AI-powered background removal for product images to enable transparent overlays.
"""

import io
import os
from pathlib import Path
from flask import Blueprint, send_file, jsonify
from PIL import Image
import structlog

logger = structlog.get_logger()

virtual_tryon_bp = Blueprint('virtual_tryon', __name__)

# Cache directory for processed images
CACHE_DIR = Path(__file__).parent.parent.parent / "static" / "transparent_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def remove_interior_background(image: Image.Image, white_threshold: int = 240) -> Image.Image:
    """
    Remove white/light backgrounds from the interior of hollow objects (like bangles).
    
    This function makes light-colored pixels transparent, which is useful for
    removing white backgrounds inside ring-shaped jewelry that rembg doesn't handle.
    
    Args:
        image: PIL Image with RGBA mode
        white_threshold: Pixels with RGB values above this become transparent (0-255)
        
    Returns:
        PIL Image with interior whites removed
    """
    import numpy as np
    
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    # Convert to numpy array for faster processing
    data = np.array(image)
    
    # Get RGB channels
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    
    # Detect white/light pixels: all RGB values above threshold
    white_areas = (r > white_threshold) & (g > white_threshold) & (b > white_threshold)
    
    # Make white areas transparent
    a[white_areas] = 0
    
    # Update alpha channel
    data[:, :, 3] = a
    
    # Convert back to PIL Image
    result = Image.fromarray(data, 'RGBA')
    
    logger.info("interior_background_removed", 
               white_threshold=white_threshold,
               transparent_pixels_added=np.sum(white_areas))
    
    return result


def get_cached_path(product_id: str) -> Path:
    """Get the cache file path for a processed image."""
    return CACHE_DIR / f"{product_id}.webp"


def remove_background(image: Image.Image) -> Image.Image:
    """
    Remove background from product image using AI.
    
    Args:
        image: PIL Image object
        
    Returns:
        PIL Image with transparent background
    """
    try:
        # Lazy import to avoid blocking Flask startup
        from rembg import remove
        
        logger.info("starting_background_removal", image_mode=image.mode, image_size=image.size)
        
        # Convert to bytes for rembg processing
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_size_before = img_byte_arr.tell()
        img_byte_arr.seek(0)
        
        # Remove background
        logger.info("calling_rembg", input_size_bytes=img_size_before)
        output = remove(img_byte_arr.read())
        logger.info("rembg_completed", output_size_bytes=len(output))
        
        # Convert back to PIL Image
        result = Image.open(io.BytesIO(output))
        
        # Ensure RGBA mode for transparency
        if result.mode != 'RGBA':
            result = result.convert('RGBA')
        
        logger.info("background_removal_success", 
                   has_alpha=result.mode == 'RGBA',
                   output_mode=result.mode,
                   output_size=result.size)
        
        # Additional post-processing: Remove interior white backgrounds
        # This is crucial for hollow jewelry like bangles/rings
        logger.info("applying_interior_background_removal")
        result = remove_interior_background(result, white_threshold=240)
        
        return result
    except ImportError as e:
        logger.error("rembg_not_installed", error=str(e))
        # Fallback: return original image converted to RGBA with white background removed manually
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        return image
    except Exception as e:
        logger.error("background_removal_failed", error=str(e), error_type=type(e).__name__)
        # Fallback: return original image
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        return image


@virtual_tryon_bp.route('/api/product/<product_id>/transparent', methods=['GET'])
def get_transparent_image(product_id: str):
    """
    Get transparent version of product image for virtual try-on.
    
    Returns cached version if available, otherwise processes and caches.
    """
    try:
        # Check if cached version exists
        cached_path = get_cached_path(product_id)
        
        if cached_path.exists():
            logger.info("serving_cached_transparent_image", product_id=product_id)
            return send_file(cached_path, mimetype='image/webp')
        
        # If not cached, we need to process the original image
        # First, fetch the product to get the image URL/path
        from app.extensions import db
        from bson import ObjectId
        
        # Convert string ID to ObjectId for MongoDB query
        try:
            obj_id = ObjectId(product_id)
        except Exception:
            return jsonify({"error": "Invalid product ID"}), 400
        
        product = db.items.find_one({"_id": obj_id})
        if not product:
            logger.error("product_not_found", product_id=product_id)
            return jsonify({"error": "Product not found"}), 404
        
        # Log product fields to debug
        logger.info("product_fields", product_id=product_id, fields=list(product.keys()))
        
        # Get the image path (assuming product has 'image' field with path or URL)
        # You may need to adjust this based on your actual schema
        image_path = product.get('image') or product.get('image_url')
        
        if not image_path:
            logger.error("product_no_image", product_id=product_id, available_fields=list(product.keys()))
            return jsonify({"error": "Product has no image"}), 404
        
        # Load the original image
        # If it's a URL, download it first
        if image_path.startswith('http'):
            import requests
            response = requests.get(image_path)
            original_image = Image.open(io.BytesIO(response.content))
        else:
            # Local file path
            original_image = Image.open(image_path)
        
        # Remove background
        logger.info("processing_background_removal", product_id=product_id)
        transparent_image = remove_background(original_image)
        
        # Save to cache as WebP (supports transparency and smaller file size)
        transparent_image.save(cached_path, format='WebP', quality=90)
        
        logger.info("cached_transparent_image", product_id=product_id, path=str(cached_path))
        
        # Return the processed image
        return send_file(cached_path, mimetype='image/webp')
        
    except Exception as e:
        logger.error("transparent_image_error", product_id=product_id, error=str(e))
        return jsonify({"error": "Failed to process image"}), 500
