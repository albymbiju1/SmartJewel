"""
KYC (Know Your Customer) Blueprint

Handles customer KYC document upload and verification.
"""

from flask import Blueprint

bp = Blueprint('customer_kyc', __name__, url_prefix='/customers/me/kyc')

# Routes will be imported here
from . import routes
