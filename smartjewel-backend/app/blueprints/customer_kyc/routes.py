"""
Customer KYC Routes

Endpoints for customers to upload and manage their KYC documents.
"""

from flask import jsonify, request, current_app
from bson import ObjectId
from datetime import datetime
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.kyc_validation import (
    validate_document_by_type,
    mask_document_number,
    hash_document_number,
    format_document_number
)
from app.utils.cloudinary_kyc import upload_kyc_document, generate_signed_url
from . import bp


ALLOWED_DOCUMENT_TYPES = ['aadhar', 'pan', 'driving_license', 'passport']
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_kyc_document_route():
    """
    Upload KYC document (Aadhar, PAN, DL, Passport).
    
    Form Data:
        document_type: 'aadhar'|'pan'|'driving_license'|'passport'
        document_number: Document number
        front_image: File (required)
        back_image: File (optional, for documents with back side)
    
    Returns:
        201: Document uploaded successfully
        400: Validation error
        413: File too large
    """
    try:
        db = current_app.extensions['mongo_db']
        customer_id = get_jwt_identity()
        
        # Validate form data
        document_type = request.form.get('document_type', '').lower()
        document_number = request.form.get('document_number', '').strip()
        
        if document_type not in ALLOWED_DOCUMENT_TYPES:
            return jsonify({
                'error': f'Invalid document type. Allowed: {", ".join(ALLOWED_DOCUMENT_TYPES)}'
            }), 400
        
        if not document_number:
            return jsonify({'error': 'Document number is required'}), 400
        
        # Validate document number format
        is_valid, error_msg = validate_document_by_type(document_type, document_number)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Check for files
        if 'front_image' not in request.files:
            return jsonify({'error': 'Front image is required'}), 400
        
        front_file = request.files['front_image']
        back_file = request.files.get('back_image')
        
        if front_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(front_file.filename):
            return jsonify({
                'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Check file size (Flask should handle this, but double check)
        front_file.seek(0, 2)  # Seek to end
        file_size = front_file.tell()
        front_file.seek(0)  # Reset to beginning
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size exceeds 5MB limit'}), 413
        
        # Upload front image to Cloudinary
        front_upload = upload_kyc_document(
            front_file,
            str(customer_id),
            document_type,
            'front'
        )
        
        # Upload back image if provided
        back_upload = None
        if back_file and back_file.filename != '':
            if not allowed_file(back_file.filename):
                return jsonify({'error': 'Invalid back image file type'}), 400
            
            back_upload = upload_kyc_document(
                back_file,
                str(customer_id),
                document_type,
                'back'
            )
        
        # Prepare document data
        formatted_number = format_document_number(document_type, document_number)
        masked_number = mask_document_number(document_type, formatted_number)
        hashed_number = hash_document_number(formatted_number)
        
        document_data = {
            'type': document_type,
            'masked_number': masked_number,
            'full_number_hash': hashed_number,
            'front_image_url': front_upload['url'],
            'front_image_public_id': front_upload['public_id'],
            'uploaded_at': datetime.utcnow(),
            'verified': False,
            'verification_notes': None
        }
        
        if back_upload:
            document_data['back_image_url'] = back_upload['url']
            document_data['back_image_public_id'] = back_upload['public_id']
        
        # Update user record (users collection, not customers)
        result = db.users.update_one(
            {'_id': ObjectId(customer_id)},
            {
                '$set': {
                    'kyc_verification.status': 'pending',
                    'kyc_verification.last_updated': datetime.utcnow()
                },
                '$push': {
                    'kyc_verification.documents': document_data
                }
            },
            upsert=False
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'message': 'KYC document uploaded successfully',
            'document': {
                'type': document_type,
                'masked_number': masked_number,
                'uploaded_at': document_data['uploaded_at'].isoformat(),
                'status': 'pending'
            }
        }), 201
    
    except Exception as e:
        print(f"Error uploading KYC document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to upload KYC document'}), 500


@bp.route('', methods=['GET'])
@jwt_required()
def get_kyc_status():
    """
    Get customer's KYC verification status and documents.
    
    Returns:
        200: KYC status and documents
    """
    try:
        db = current_app.extensions['mongo_db']
        customer_id = get_jwt_identity()
        
        customer = db.users.find_one(
            {'_id': ObjectId(customer_id)},
            {'kyc_verification': 1, 'name': 1, 'email': 1, 'full_name': 1}
        )
        
        if not customer:
            return jsonify({'error': 'User not found'}), 404
        
        kyc_data = customer.get('kyc_verification', {})
        status = kyc_data.get('status', 'not_submitted')
        documents = kyc_data.get('documents', [])
        
        # Format documents for response (hide sensitive data)
        formatted_docs = []
        for doc in documents:
            formatted_docs.append({
                'type': doc['type'],
                'masked_number': doc['masked_number'],
                'uploaded_at': doc['uploaded_at'].isoformat() if doc.get('uploaded_at') else None,
                'verified': doc.get('verified', False),
                'has_back_image': 'back_image_url' in doc
            })
        
        # Determine if customer can rent
        can_rent = status == 'verified' and any(doc.get('verified') for doc in documents)
        
        return jsonify({
            'status': status,
            'verified_at': kyc_data.get('verified_at').isoformat() if kyc_data.get('verified_at') else None,
            'rejection_reason': kyc_data.get('rejection_reason'),
            'documents': formatted_docs,
            'can_rent': can_rent,
            'last_updated': kyc_data.get('last_updated').isoformat() if kyc_data.get('last_updated') else None
        }), 200
    
    except Exception as e:
        print(f"Error fetching KYC status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch KYC status'}), 500


@bp.route('/documents/<int:doc_index>', methods=['DELETE'])
@jwt_required()
def delete_kyc_document_route(doc_index):
    """
    Request deletion of a KYC document.
    Only unverified documents can be deleted.
    
    Args:
        doc_index: Index of document in the documents array
    
    Returns:
        200: Document deleted
        403: Cannot delete verified document
    """
    try:
        db = current_app.extensions['mongo_db']
        customer_id = get_jwt_identity()
        
        customer = db.users.find_one({'_id': ObjectId(customer_id)})
        if not customer:
            return jsonify({'error': 'User not found'}), 404
        
        documents = customer.get('kyc_verification', {}).get('documents', [])
        
        if doc_index < 0 or doc_index >= len(documents):
            return jsonify({'error': 'Invalid document index'}), 400
        
        doc_to_delete = documents[doc_index]
        
        # Check if document is verified
        if doc_to_delete.get('verified', False):
            return jsonify({
                'error': 'Cannot delete verified documents. Please contact support.'
            }), 403
        
        # Remove document from array
        db.users.update_one(
            {'_id': ObjectId(customer_id)},
            {
                '$pull': {
                    'kyc_verification.documents': doc_to_delete
                },
                '$set': {
                    'kyc_verification.last_updated': datetime.utcnow()
                }
            }
        )
        
        # Note: We intentionally don't delete from Cloudinary for audit purposes
        
        return jsonify({'message': 'Document deleted successfully'}), 200
    
    except Exception as e:
        print(f"Error deleting KYC document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to delete KYC document'}), 500
