import os
import sys
import json
from bson import ObjectId

# ---- GLOBAL ObjectId JSON PATCH ----
class GlobalObjectIdEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)
json._default_encoder = GlobalObjectIdEncoder()

# Add backend folder to Python path FIRST so 'app' can be imported
# Use insert(0, ...) to put it at the beginning and abspath for reliability
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app import create_app  # now this will work

app = create_app()

if __name__ == "__main__":
    # Local development
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

