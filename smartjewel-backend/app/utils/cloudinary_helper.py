"""
Cloudinary image upload helper for SmartJewel.
Handles image uploads to Cloudinary cloud storage for production environments.
"""
import os
import cloudinary
import cloudinary.uploader
from werkzeug.datastructures import FileStorage
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


def init_cloudinary():
    """
    Initialize Cloudinary configuration from environment variables.
    Should be called during app initialization.
    """
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    api_key = os.getenv('CLOUDINARY_API_KEY')
    api_secret = os.getenv('CLOUDINARY_API_SECRET')
    
    if cloud_name and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        logger.info(f"Cloudinary initialized successfully for cloud: {cloud_name}")
        return True
    else:
        logger.warning("Cloudinary credentials not found in environment variables")
        return False


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is properly configured."""
    return bool(
        os.getenv('CLOUDINARY_CLOUD_NAME') and
        os.getenv('CLOUDINARY_API_KEY') and
        os.getenv('CLOUDINARY_API_SECRET')
    )


def upload_image(
    file: FileStorage,
    folder: str = "smartjewel/products",
    public_id: Optional[str] = None,
    transformation: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Upload an image file to Cloudinary.
    
    Args:
        file: The uploaded file object (Werkzeug FileStorage)
        folder: Cloudinary folder path (default: "smartjewel/products")
        public_id: Optional custom public ID for the image
        transformation: Optional transformation parameters
        
    Returns:
        Dictionary with upload results:
        {
            'url': 'https://res.cloudinary.com/...',
            'secure_url': 'https://res.cloudinary.com/...',
            'public_id': 'smartjewel/products/abc123',
            'format': 'jpg',
            'width': 1024,
            'height': 768
        }
        
    Raises:
        Exception: If upload fails
    """
    try:
        if not is_cloudinary_configured():
            raise Exception("Cloudinary is not configured. Please set environment variables.")
        
        # Prepare upload options
        upload_options = {
            'folder': folder,
            'resource_type': 'image',
            'overwrite': True,
            'invalidate': True,  # Invalidate CDN cache
        }
        
        if public_id:
            upload_options['public_id'] = public_id
        
        # Add default transformation for optimization
        if transformation is None:
            transformation = {
                'quality': 'auto:good',  # Automatic quality optimization
                'fetch_format': 'auto',  # Automatic format selection (WebP, etc.)
            }
        
        if transformation:
            upload_options['transformation'] = transformation
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(file, **upload_options)
        
        logger.info(f"Image uploaded successfully: {result.get('public_id')}")
        
        return {
            'url': result.get('url'),
            'secure_url': result.get('secure_url'),
            'public_id': result.get('public_id'),
            'format': result.get('format'),
            'width': result.get('width'),
            'height': result.get('height'),
            'bytes': result.get('bytes'),
        }
        
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {str(e)}")
        raise Exception(f"Failed to upload image to Cloudinary: {str(e)}")


def delete_image(public_id: str) -> bool:
    """
    Delete an image from Cloudinary.
    
    Args:
        public_id: The Cloudinary public ID of the image
        
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        if not is_cloudinary_configured():
            logger.warning("Cloudinary not configured, skipping deletion")
            return False
        
        result = cloudinary.uploader.destroy(public_id)
        
        if result.get('result') == 'ok':
            logger.info(f"Image deleted successfully: {public_id}")
            return True
        else:
            logger.warning(f"Image deletion failed: {public_id} - {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error deleting image from Cloudinary: {str(e)}")
        return False


def get_optimized_url(
    public_id: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    crop: str = "fill",
    quality: str = "auto:good"
) -> str:
    """
    Get an optimized URL for a Cloudinary image with transformations.
    
    Args:
        public_id: The Cloudinary public ID
        width: Optional width for resizing
        height: Optional height for resizing
        crop: Crop mode (fill, fit, scale, etc.)
        quality: Quality setting (auto, auto:good, auto:best, etc.)
        
    Returns:
        Optimized image URL
    """
    try:
        transformation = {
            'quality': quality,
            'fetch_format': 'auto',
        }
        
        if width:
            transformation['width'] = width
        if height:
            transformation['height'] = height
        if width or height:
            transformation['crop'] = crop
        
        url = cloudinary.CloudinaryImage(public_id).build_url(**transformation)
        return url
        
    except Exception as e:
        logger.error(f"Error building optimized URL: {str(e)}")
        return ""
