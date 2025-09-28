from app import create_app
from app.scheduler import setup_scheduler

app = create_app()

with app.app_context():
    # Check if scheduler exists
    if hasattr(app.extensions, 'scheduler') and app.extensions['scheduler']:
        scheduler = app.extensions['scheduler']
        print("Scheduler is active")

        jobs = scheduler.get_jobs()
        print(f"Number of jobs: {len(jobs)}")

        for job in jobs:
            print(f"Job ID: {job.id}")
            print(f"  Next run time: {job.next_run_time}")
            print(f"  Trigger: {job.trigger}")
            print(f"  Function: {job.func}")
            print()
    else:
        print("Scheduler not found - setting up new one")
        scheduler = setup_scheduler(app)
        print("New scheduler created")

    # Try to get pending jobs
    try:
        pending_jobs = scheduler.get_jobs()
        print(f"Current jobs: {len(pending_jobs)}")
        for job in pending_jobs:
            print(f"  {job.id} - Next: {job.next_run_time}")
    except Exception as e:
        print(f"Error getting jobs: {e}")