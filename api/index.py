"""
Vercel serverless function handler for SmartJewel backend.
This file acts as the entry point for Vercel's Python runtime.
"""
import os
import sys

# Add the smartjewel-backend directory to Python path
# This allows importing from the 'app' package
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, 'smartjewel-backend')

# Insert at the beginning of sys.path for priority
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Now we can import the Flask app
from app import create_app

# Create the Flask application instance
app = create_app()

# Vercel expects a Flask app instance named 'app' or a handler function
# The 'app' object will be used by Vercel's WSGI adapter
