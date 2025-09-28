from app import create_app

app = create_app()

with app.app_context():
    db = app.extensions['mongo_db']

    # Check how many products exist
    product_count = db.items.count_documents({})
    print(f"Total products in database: {product_count}")

    # Check a few sample products
    products = list(db.items.find({}, limit=3))
    if products:
        print("\nSample products:")
        for i, product in enumerate(products, 1):
            print(f"Product {i}:")
            print(f"  Name: {product.get('name', 'N/A')}")
            print(f"  Price: {product.get('price', 'N/A')}")
            print(f"  Weight: {product.get('weight', 'N/A')}")
            print(f"  Purity: {product.get('purity', 'N/A')}")
            print(f"  Metal: {product.get('metal', 'N/A')}")
            print()
    else:
        print("No products found")

    # Check the latest price update log details
    latest_log = db.price_update_logs.find_one({}, sort=[("timestamp", -1)])
    if latest_log:
        print("Latest price update log details:")
        print(f"  Timestamp: {latest_log['timestamp']}")
        print(f"  Success: {latest_log['success']}")
        print(f"  Updated count: {latest_log.get('updated_count', 0)}")
        print(f"  Error count: {latest_log.get('error_count', 0)}")
        print(f"  Skipped count: {latest_log.get('skipped_count', 0)}")
        if latest_log.get('errors'):
            print(f"  Errors: {latest_log['errors']}")
        if latest_log.get('gold_rates'):
            print(f"  Gold rates used: {latest_log['gold_rates']}")
    else:
        print("No price update logs found")