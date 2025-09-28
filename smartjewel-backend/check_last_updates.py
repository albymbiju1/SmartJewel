from app import create_app

app = create_app()

with app.app_context():
    db = app.extensions['mongo_db']

    # Check products' last update times
    products = list(db.items.find({"metal": {"$regex": "gold", "$options": "i"}}, limit=5))
    print("Product last update times:")
    for product in products:
        name = product.get('name', 'Unknown')
        last_update = product.get('last_price_update')
        price = product.get('price', 'N/A')
        print(f"  {name}: Price={price}, Last update={last_update}")

    print()

    # Check gold rate history
    gold_rates = list(db.gold_rate.find({}, sort=[("updated_at", -1)], limit=3))
    print("Gold rate update history:")
    for rate in gold_rates:
        print(f"  {rate['updated_at']}: {rate['rates']['24k']} INR/gram")

    print()

    # Check scheduler job execution - look for any logs
    print("Checking for scheduler execution logs...")
    # Since we don't have direct access to APScheduler logs, let's see if we can find any indication
    # that the job ran by checking if there were any database operations around 9 AM

    # Check for any price_update_logs around 9 AM today
    from datetime import datetime, timezone, timedelta
    today_9am = datetime(2025, 9, 28, 9, 0, 0, tzinfo=timezone.utc)
    today_10am = today_9am + timedelta(hours=1)

    recent_logs = list(db.price_update_logs.find({
        "timestamp": {"$gte": today_9am, "$lt": today_10am}
    }, sort=[("timestamp", -1)]))

    if recent_logs:
        print(f"Found {len(recent_logs)} price update logs between 9-10 AM today:")
        for log in recent_logs:
            print(f"  {log['timestamp']}: Success={log['success']}, Updated={log.get('updated_count', 0)}")
    else:
        print("No price update logs found between 9-10 AM today")
        print("This suggests the scheduler job may not have run at 9 AM")