import os
from app import create_app

# Set a default Flask environment (in case it's not set)
os.environ.setdefault("FLASK_ENV", "production")
os.environ.setdefault("FLASK_APP", "app")

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
