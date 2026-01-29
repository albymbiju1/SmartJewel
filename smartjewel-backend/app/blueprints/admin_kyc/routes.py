"""
Admin KYC Verification Routes

Endpoints for admin/staff to verify customer KYC documents.
"""

from flask import jsonify, request, current_app
from bson import ObjectId
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.authz import require_roles, require_any_role
from app.utils.cloudinary_kyc import generate_signed_url
from . import bp


@bp.route('/pending', methods=['GET'])
@require_any_role('Admin', 'Staff_L1', 'Staff_L2')
def get_pending_kyc():
    """
    Get list of customers with KYC submissions.
    
    Query params:
        status: Filter by status ('pending', 'verified', 'rejected', or 'all' for all submissions)
        limit: Number of results (default 50)
        skip: Pagination offset
    
    Returns:
        200: List of KYC submissions
    """
    try:
        db = current_app.extensions['mongo_db']
        
        status_filter = request.args.get('status', 'pending').lower()
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        
        # Build query based on status filter
        query = {}
        if status_filter == 'pending':
            query['kyc_verification.status'] = 'pending'
        elif status_filter == 'verified':
            query['kyc_verification.status'] = 'verified'
        elif status_filter == 'rejected':
            query['kyc_verification.status'] = 'rejected'
        elif status_filter == 'all':
            query['kyc_verification'] = {'$exists': True}
        else:
            # Default to pending
            query['kyc_verification.status'] = 'pending'
        
        # Find users with KYC (users collection)
        customers = db.users.find(
            query,
            {
                'name': 1,
                'email': 1,
                'phone': 1,
                'kyc_verification': 1,
                'createdAt': 1
            }
        ).skip(skip).limit(limit)
        
        result = []
        for customer in customers:
            kyc = customer.get('kyc_verification', {})
            documents = kyc.get('documents', [])
            
            # Get all documents (not just pending ones for display)
            formatted_docs = []
            for doc in documents:
                formatted_docs.append({
                    'type': doc.get('type'),
                    'number': doc.get('number', ''),  # Full number (hashed in DB)
                    'masked_number': doc.get('masked_number'),
                    'front_image_url': doc.get('front_image_url', ''),
                    'back_image_url': doc.get('back_image_url'),
                    'uploaded_at': doc.get('uploaded_at').isoformat() if doc.get('uploaded_at') else None,
                    'verified': doc.get('verified', False)
                })
            
            if formatted_docs:  # Only include if has documents
                result.append({
                    'customer_id': str(customer['_id']),
                    'customer_name': customer.get('name', '') or customer.get('full_name', '') or customer.get('email', '').split('@')[0],
                    'customer_email': customer.get('email'),
                    'documents': formatted_docs,
                    'submitted_at': kyc.get('last_updated').isoformat() if kyc.get('last_updated') else None
                })
        
        return jsonify({
            'pending_count': len(result),
            'submissions': result  # Changed from 'customers' to 'submissions'
        }), 200
    
    except Exception as e:
        print(f"Error fetching pending KYC: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch pending KYC'}), 500


@bp.route('/<customer_id>', methods=['GET'])
@require_any_role('Admin', 'Staff_L1', 'Staff_L2')
def get_customer_kyc_details(customer_id):
    """
    Get detailed KYC information for a specific customer.
    Includes signed URLs for viewing documents.
    
    Args:
        customer_id: Customer's MongoDB ID
    
    Returns:
        200: Customer KYC details with document URLs
        404: Customer not found
    """
    try:
        db = current_app.extensions['mongo_db']
        
        customer = db.users.find_one(
            {'_id': ObjectId(customer_id)},
            {
                'name': 1,
                'email': 1,
                'phone': 1,
                'kyc_verification': 1
            }
        )
        
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        kyc = customer.get('kyc_verification', {})
        documents = kyc.get('documents', [])
        
        # Generate signed URLs for documents
        formatted_docs = []
        for idx, doc in enumerate(documents):
            doc_data = {
                'index': idx,
                'type': doc.get('type'),
                'masked_number': doc.get('masked_number'),
                'uploaded_at': doc.get('uploaded_at').isoformat() if doc.get('uploaded_at') else None,
                'verified': doc.get('verified', False),
                'verification_notes': doc.get('verification_notes'),
                'has_back_image': 'back_image_public_id' in doc
            }
            
            # Generate signed URLs (valid for 1 hour)
            if doc.get('front_image_public_id'):
                try:
                    doc_data['front_image_url'] = generate_signed_url(
                        doc['front_image_public_id'],
                        expiration=3600
                    )
                except Exception as e:
                    print(f"Error generating signed URL: {e}")
                    doc_data['front_image_url'] = None
            
            if doc.get('back_image_public_id'):
                try:
                    doc_data['back_image_url'] = generate_signed_url(
                        doc['back_image_public_id'],
                        expiration=3600
                    )
                except Exception as e:
                    print(f"Error generating signed URL: {e}")
                    doc_data['back_image_url'] = None
            
            formatted_docs.append(doc_data)
        
        return jsonify({
            'customer_id': str(customer['_id']),
            'customer_name': customer.get('name'),
            'email': customer.get('email'),
            'phone': customer.get('phone'),
            'kyc_status': kyc.get('status', 'not_submitted'),
            'verified_at': kyc.get('verified_at').isoformat() if kyc.get('verified_at') else None,
            'verified_by': str(kyc.get('verified_by')) if kyc.get('verified_by') else None,
            'rejection_reason': kyc.get('rejection_reason'),
            'documents': formatted_docs,
            'last_updated': kyc.get('last_updated').isoformat() if kyc.get('last_updated') else None
        }), 200
    
    except Exception as e:
        print(f"Error fetching customer KYC: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch customer KYC'}), 500


@bp.route('/<customer_id>/verify', methods=['POST'])
@require_any_role('Admin', 'Staff_L1')  # Staff_L2 can view but not verify
def verify_kyc(customer_id):
    """
    Approve or reject customer's KYC documents.
    
    Args:
        customer_id: Customer's MongoDB ID
    
    Request Body:
        document_index: Index of document in documents array
        action: 'approve' or 'reject'
        notes: Verification notes (optional)
        rejection_reason: Reason if rejected (required for reject)
    
    Returns:
        200: KYC verified successfully
        400: Invalid request
        404: Customer not found
    """
    try:
        db = current_app.extensions['mongo_db']    
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        document_index = data.get('document_index')
        action = data.get('action', '').lower()
        notes = data.get('notes', '')
        rejection_reason = data.get('rejection_reason', '')
        
        if action not in ['approve', 'reject']:
            return jsonify({'error': 'Action must be "approve" or "reject"'}), 400
        
        if action == 'reject' and not rejection_reason:
            return jsonify({'error': 'Rejection reason is required'}), 400
        
        # Get customer
        customer = db.users.find_one({'_id': ObjectId(customer_id)})
        if not customer:
            return jsonify({'error': 'User not found'}), 404
        
        documents = customer.get('kyc_verification', {}).get('documents', [])
        
        if document_index is None or document_index < 0 or document_index >= len(documents):
            return jsonify({'error': 'Invalid document index'}), 400
        
        # Update document verification status
        document_field = f'kyc_verification.documents.{document_index}.verified'
        notes_field = f'kyc_verification.documents.{document_index}.verification_notes'
        
        update_data = {
            document_field: action == 'approve',
            notes_field: notes,
            'kyc_verification.last_updated': datetime.utcnow()
        }
        
        if action == 'approve':
            update_data['kyc_verification.status'] = 'verified'
            update_data['kyc_verification.verified_at'] = datetime.utcnow()
            update_data['kyc_verification.verified_by'] = ObjectId(user_id)  # Fixed: use user_id from get_jwt_identity
            update_data['kyc_verification.rejection_reason'] = None
        else:
            update_data['kyc_verification.status'] = 'rejected'
            update_data['kyc_verification.rejection_reason'] = rejection_reason
        
        db.users.update_one(
            {'_id': ObjectId(customer_id)},
            {'$set': update_data}
        )
        
        # Send notification to customer
        notification_data = {
            'user_id': customer_id,
            'timestamp': datetime.utcnow(),
            'read': False
        }
        
        if action == 'approve':
            notification_data.update({
                'type': 'kyc_verified',
                'title': 'KYC Verified ✓',
                'message': 'Your KYC verification has been approved! You can now rent jewelry items.',
                'icon': 'check_circle',
                'color': 'green',
                'action_url': '/rentals'
            })
        else:
            notification_data.update({
                'type': 'kyc_rejected',
                'title': 'KYC Verification Required',
                'message': f'Your KYC was rejected: {rejection_reason}. Please upload new documents.',
                'icon': 'warning',
                'color': 'red',
                'action_url': '/profile/kyc'
            })
        
        db.notifications.insert_one(notification_data)
        
        return jsonify({
            'message': f'KYC {action}d successfully',
            'customer_id': customer_id,
            'action': action,
            'status': 'verified' if action == 'approve' else 'rejected'
        }), 200
    
    except Exception as e:
        print(f"Error verifying KYC: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to verify KYC'}), 500


@bp.route('/audit-log', methods=['GET'])
@require_roles('Admin')
def get_kyc_audit_log():
    """
    Get audit log of all KYC verifications.
    
    Query params:
        limit: Number of results (default 100)
        skip: Pagination offset
    
    Returns:
        200: List of verification activities
    """
    try:
        db = current_app.extensions['mongo_db']
        
        limit = int(request.args.get('limit', 100))
        skip = int(request.args.get('skip', 0))
        
        # Find all users with KYC verification activity
        customers = db.users.find(
            {'kyc_verification.verified_at': {'$exists': True}},
            {
                'name': 1,
                'email': 1,
                'kyc_verification.status': 1,
                'kyc_verification.verified_at': 1,
                'kyc_verification.verified_by': 1,
                'kyc_verification.documents': 1
            }
        ).sort('kyc_verification.verified_at', -1).skip(skip).limit(limit)
        
        result = []
        for customer in customers:
            kyc = customer.get('kyc_verification', {})
            
            # Get staff name
            verified_by_name = 'Unknown'
            if kyc.get('verified_by'):
                staff = db.staff.find_one(
                    {'_id': kyc['verified_by']},
                    {'name': 1}
                )
                if staff:
                    verified_by_name = staff.get('name', 'Unknown')
            
            result.append({
                'customer_id': str(customer['_id']),
                'customer_name': customer.get('name'),
                'customer_email': customer.get('email'),
                'status': kyc.get('status'),
                'verified_at': kyc.get('verified_at').isoformat() if kyc.get('verified_at') else None,
                'verified_by': verified_by_name,
                'document_count': len(kyc.get('documents', []))
            })
        
        return jsonify({
            'total': len(result),
            'activities': result
        }), 200
    
    except Exception as e:
        print(f"Error fetching audit log: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch audit log'}), 500
