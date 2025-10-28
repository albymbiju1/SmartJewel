"""
Check what routes are registered in the Flask app
"""
import requests
import json

def check_routes():
    try:
        response = requests.get("http://127.0.0.1:5000/")
        routes_data = response.json()
        
        print("Registered routes:")
        print("=" * 50)
        
        # Filter for core routes
        core_routes = []
        for route in routes_data.get("routes", []):
            if "healthz" in route or "admin" in route or "dashboard" in route:
                core_routes.append(route)
                print(route)
        
        if not core_routes:
            print("No core routes found. Showing all routes:")
            for route in routes_data.get("routes", [])[:20]:  # Show first 20
                print(route)
                
    except Exception as e:
        print(f"Error checking routes: {e}")

if __name__ == "__main__":
    check_routes()