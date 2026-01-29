"""
Admin KYC Verification Blueprint

Handles admin/staff verification of customer KYC documents.
"""

from flask import Blueprint

bp = Blueprint('admin_kyc', __name__, url_prefix='/admin/kyc')

# Routes will be imported here
from . import routes
