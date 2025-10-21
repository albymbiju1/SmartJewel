#!/usr/bin/env python3
"""
Generate a secure JWT secret key for production use.
Run this script to generate a random secret key.
"""

import secrets
import string

def generate_jwt_secret(length=64):
    """Generate a cryptographically secure random string for JWT secret."""
    # Use a combination of letters, digits, and special characters
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}|;:,.<>?"
    secret = ''.join(secrets.choice(alphabet) for _ in range(length))
    return secret

if __name__ == "__main__":
    print("=" * 80)
    print("JWT SECRET KEY GENERATOR")
    print("=" * 80)
    print("\nGenerating a secure JWT secret key...\n")
    
    secret = generate_jwt_secret(64)
    
    print("Your new JWT secret key:")
    print("-" * 80)
    print(secret)
    print("-" * 80)
    
    print("\n✅ Copy this key and add it to your Vercel environment variables as:")
    print("   Variable: JWT_SECRET")
    print(f"   Value: {secret}")
    print("\n⚠️  IMPORTANT:")
    print("   - Never commit this key to version control")
    print("   - Keep this key secure and private")
    print("   - Use this same key across all environments for the same database")
    print("   - If you change this key, all existing JWT tokens will be invalidated")
    print("\n" + "=" * 80)
