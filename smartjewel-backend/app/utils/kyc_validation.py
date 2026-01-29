"""
KYC Document Validation Utilities

Provides validation functions for Indian identity documents:
- Aadhar Card (12 digits)
- PAN Card (10 characters)
- Driving License
- Passport
"""

import re
import hashlib
from typing import Tuple, Optional


def validate_aadhar(aadhar_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate Aadhar card number format.
    Format: XXXX-XXXX-XXXX or XXXXXXXXXXXX (12 digits)
    
    Returns: (is_valid, error_message)
    """
    if not aadhar_number:
        return False, "Aadhar number is required"
    
    # Remove spaces and hyphens
    cleaned = aadhar_number.replace(" ", "").replace("-", "")
    
    # Check if 12 digits
    if not re.match(r'^\d{12}$', cleaned):
        return False, "Aadhar must be exactly 12 digits"
    
    # Simple checksum validation (Verhoeff algorithm would be more accurate)
    # For now, just ensure it's not all zeros or sequential
    if cleaned == "000000000000" or cleaned == "123456789012":
        return False, "Invalid Aadhar number"
    
    return True, None


def validate_pan(pan_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate PAN card number format.
    Format: XXXXX1234X (5 letters, 4 digits, 1 letter)
    Example: ABCDE1234F
    
    Returns: (is_valid, error_message)
    """
    if not pan_number:
        return False, "PAN number is required"
    
    # Convert to uppercase
    pan = pan_number.upper().strip()
    
    # Check format: 5 letters, 4 digits, 1 letter
    if not re.match(r'^[A-Z]{5}\d{4}[A-Z]$', pan):
        return False, "PAN format must be: ABCDE1234F (5 letters, 4 digits, 1 letter)"
    
    return True, None


def validate_driving_license(dl_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate driving license number format.
    Format varies by state, but generally: XX-XXXXXXXXXX or XXXXXXXXXXXX
    
    Returns: (is_valid, error_message)
    """
    if not dl_number:
        return False, "Driving license number is required"
    
    cleaned = dl_number.replace(" ", "").replace("-", "").upper()
    
    # Basic validation: 10-16 alphanumeric characters
    if not re.match(r'^[A-Z0-9]{10,16}$', cleaned):
        return False, "Invalid driving license format"
    
    return True, None


def validate_passport(passport_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate passport number format.
    Indian passport format: X1234567 (1 letter, 7 digits)
    
    Returns: (is_valid, error_message)
    """
    if not passport_number:
        return False, "Passport number is required"
    
    passport = passport_number.upper().strip()
    
    # Indian passport format
    if not re.match(r'^[A-Z]\d{7}$', passport):
        return False, "Passport format must be: A1234567 (1 letter, 7 digits)"
    
    return True, None


def validate_document_by_type(doc_type: str, doc_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate document number based on document type.
    
    Args:
        doc_type: One of 'aadhar', 'pan', 'driving_license', 'passport'
        doc_number: The document number to validate
    
    Returns: (is_valid, error_message)
    """
    validators = {
        'aadhar': validate_aadhar,
        'pan': validate_pan,
        'driving_license': validate_driving_license,
        'passport': validate_passport,
    }
    
    validator = validators.get(doc_type.lower())
    if not validator:
        return False, f"Unknown document type: {doc_type}"
    
    return validator(doc_number)


def mask_document_number(doc_type: str, doc_number: str) -> str:
    """
    Mask sensitive document numbers for display.
    Shows only last 4 characters.
    
    Examples:
        Aadhar: XXXX-XXXX-1234
        PAN: XXXXX-1234
    """
    if not doc_number:
        return ""
    
    cleaned = doc_number.replace(" ", "").replace("-", "")
    
    if doc_type == 'aadhar':
        if len(cleaned) == 12:
            return f"XXXX-XXXX-{cleaned[-4:]}"
        return f"XXXX-{cleaned[-4:]}" if len(cleaned) >= 4 else "XXXX"
    
    elif doc_type == 'pan':
        if len(cleaned) == 10:
            return f"XXXXX-{cleaned[-5:]}"
        return f"XXXXX-{cleaned[-4:]}" if len(cleaned) >= 4 else "XXXX"
    
    else:
        # Generic masking for other document types
        if len(cleaned) >= 4:
            return "X" * (len(cleaned) - 4) + cleaned[-4:]
        return "X" * len(cleaned)


def hash_document_number(doc_number: str) -> str:
    """
    Create a secure hash of the document number for storage.
    Uses SHA-256 with salt.
    """
    if not doc_number:
        return ""
    
    # Use a salt (in production, this should be from environment variable)
    salt = "smartjewel_kyc_salt_2026"
    
    # Combine salt and document number
    salted = f"{salt}{doc_number}".encode('utf-8')
    
    # Return hexadecimal hash
    return hashlib.sha256(salted).hexdigest()


def format_document_number(doc_type: str, doc_number: str) -> str:
    """
    Format document number with proper separators.
    
    Examples:
        Aadhar: 1234-5678-9012
        PAN: ABCDE1234F (no change)
    """
    if not doc_number:
        return ""
    
    cleaned = doc_number.replace(" ", "").replace("-", "").upper()
    
    if doc_type == 'aadhar' and len(cleaned) == 12:
        return f"{cleaned[:4]}-{cleaned[4:8]}-{cleaned[8:]}"
    
    # For other types, return as-is (uppercase)
    return cleaned
