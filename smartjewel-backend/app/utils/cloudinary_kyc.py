"""
Cloudinary utilities for secure document upload

Handles KYC document uploads to Cloudinary with security and organization.
"""

import cloudinary
import cloudinary.uploader
from typing import Dict, Optional
from werkzeug.datastructures import FileStorage


def upload_kyc_document(
    file: FileStorage,
    customer_id: str,
    doc_type: str,
    side: str = 'front'
) -> Dict[str, str]:
    """
    Upload KYC document to Cloudinary in secure folder.
    
    Args:
        file: The uploaded file
        customer_id: Customer's MongoDB ID
        doc_type: Type of document (aadhar, pan, etc.)
        side: 'front' or 'back'
    
    Returns:
        Dict with 'url' and 'public_id'
    """
    try:
        # Create secure folder path
        folder = f"kyc_documents/{customer_id}/{doc_type}"
        
        # Generate unique filename
        filename = f"{doc_type}_{side}_{customer_id}"
        
        # Upload with security settings
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            public_id=filename,
            resource_type='image',
            type='private',  # Make it private, require signed URLs
            invalidate=True,  # Invalidate CDN cache
            overwrite=True,  # Replace if exists
            format='jpg',  # Convert to JPG for consistency
            quality='auto:good',  # Optimize quality
            tags=['kyc', doc_type, customer_id],  # Add tags for searching
        )
        
        return {
            'url': result.get('secure_url'),
            'public_id': result.get('public_id'),
            'format': result.get('format'),
            'bytes': result.get('bytes'),
            'created_at': result.get('created_at')
        }
    
    except Exception as e:
        raise Exception(f"Failed to upload KYC document: {str(e)}")


def generate_signed_url(public_id: str, expiration: int = 3600) -> str:
    """
    Generate a signed URL for secure document access.
    
    Args:
        public_id: Cloudinary public ID of the document
        expiration: URL expiration in seconds (default 1 hour)
    
    Returns:
        Signed URL string
    """
    try:
        url = cloudinary.utils.private_download_url(
            public_id,
            format='jpg',
            expiration=expiration,
            attachment=False
        )
        return url
    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")


def delete_kyc_document(public_id: str) -> bool:
    """
    Delete KYC document from Cloudinary.
    
    Args:
        public_id: Cloudinary public ID of the document
    
    Returns:
        True if deleted successfully
    """
    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type='image',
            type='private',
            invalidate=True
        )
        return result.get('result') == 'ok'
    except Exception as e:
        raise Exception(f"Failed to delete KYC document: {str(e)}")


def upload_deposit_receipt(
    file: FileStorage,
    booking_id: str,
    customer_id: str
) -> Dict[str, str]:
    """
    Upload security deposit receipt to Cloudinary.
    
    Args:
        file: The uploaded receipt image
        booking_id: Rental booking ID
        customer_id: Customer's MongoDB ID
    
    Returns:
        Dict with 'url' and 'public_id'
    """
    try:
        # Create folder path
        folder = f"deposit_receipts/{customer_id}"
        
        # Generate filename
        filename = f"receipt_{booking_id}"
        
        # Upload
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            public_id=filename,
            resource_type='image',
            type='upload',  # Regular upload (not private)
            invalidate=True,
            overwrite=True,
            format='jpg',
            quality='auto:good',
            tags=['deposit_receipt', booking_id, customer_id],
        )
        
        return {
            'url': result.get('secure_url'),
            'public_id': result.get('public_id'),
            'format': result.get('format'),
            'bytes': result.get('bytes'),
            'created_at': result.get('created_at')
        }
    
    except Exception as e:
        raise Exception(f"Failed to upload deposit receipt: {str(e)}")
