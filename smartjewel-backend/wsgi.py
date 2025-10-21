import os
import sys

# Add backend folder to Python path so 'app' can be imported
sys.path.append(os.path.dirname(__file__))

from app import create_app  # now this will work

app = create_app()

if __name__ == "__main__":
    # Local development
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

