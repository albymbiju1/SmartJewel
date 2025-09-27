from datetime import datetime
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from app.services.gold_rate_service import GoldRateService


IST = pytz.timezone("Asia/Kolkata")


def _job(app) -> None:
    """Scheduled job to refresh gold rates and reprice products."""
    try:
        # Log job start with explicit IST timestamp for verification
        app.logger.info(
            "gold_rate_refresh_job_started",
            extra={
                "now_ist": datetime.now(IST).isoformat(),
            },
        )
        db = app.extensions.get('mongo_db')
        if not db:
            app.logger.error("Scheduler: DB not available, skipping gold rate refresh")
            return
        result = GoldRateService.refresh_and_reprice(db)
        status = "success" if result.get("success") else f"failed: {result.get('error')}"
        app.logger.info(
            "gold_rate_refresh_job",
            extra={
                "status": status,
                "updated_at": str(result.get("updated_at")),
                "updated_count": result.get("price_update", {}).get("updated_count"),
                "error_count": result.get("price_update", {}).get("error_count"),
                "skipped_count": result.get("price_update", {}).get("skipped_count"),
            },
        )
    except Exception as e:
        app.logger.exception(f"Scheduler job failed: {e}")


def setup_scheduler(app: Any) -> BackgroundScheduler:
    """Initialize and start the background scheduler with IST cron times.

    Runs every day at 09:00 and 18:00 IST.
    """
    scheduler = BackgroundScheduler(timezone=IST)

    morning_trigger = CronTrigger(hour=9, minute=0, timezone=IST)
    evening_trigger = CronTrigger(hour=18, minute=0, timezone=IST)

    scheduler.add_job(
        _job,
        morning_trigger,
        args=[app],
        id="gold_rate_refresh_morning",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        _job,
        evening_trigger,
        args=[app],
        id="gold_rate_refresh_evening",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )

    scheduler.start()
    app.logger.info("APScheduler started with IST cron jobs at 09:00 and 18:00")
    # Log scheduled jobs and next run times for verification
    try:
        jobs = scheduler.get_jobs()
        for job in jobs:
            app.logger.info(
                "scheduler_job_registered",
                extra={
                    "job_id": job.id,
                    "next_run_time": str(job.next_run_time),
                    "trigger": str(job.trigger),
                    "timezone": str(IST),
                },
            )
    except Exception as e:
        app.logger.warning(f"Failed to list scheduled jobs: {e}")
    return scheduler
