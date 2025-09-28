from app import create_app

app = create_app()

with app.app_context():
    db = app.extensions['mongo_db']

    # Check gold rates
    gold_rate = db.gold_rate.find_one({}, sort=[("updated_at", -1)])
    if gold_rate:
        print("Latest gold rate:")
        print(f"  Updated at: {gold_rate['updated_at']}")
        print(f"  Rates: {gold_rate['rates']}")
    else:
        print("No gold rates found in database")

    # Check price update logs
    price_logs = list(db.price_update_logs.find({}, sort=[("timestamp", -1)], limit=3))
    if price_logs:
        print(f"\nLatest {len(price_logs)} price update logs:")
        for log in price_logs:
            print(f"  {log['timestamp']}: {log['operation']} - Success: {log['success']}, Updated: {log.get('updated_count', 0)}")
    else:
        print("\nNo price update logs found")

    # Check if scheduler is running
    if hasattr(app.extensions, 'scheduler') and app.extensions['scheduler']:
        scheduler = app.extensions['scheduler']
        jobs = scheduler.get_jobs()
        print(f"\nScheduler jobs ({len(jobs)}):")
        for job in jobs:
            print(f"  {job.id}: Next run at {job.next_run_time}")
    else:
        print("\nScheduler not found in app extensions")