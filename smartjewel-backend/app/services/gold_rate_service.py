import requests
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.config import Config
from app.services.price_calculator import GoldPriceCalculator


class GoldRateService:
    """Service to fetch gold rates from GoldAPI, store them, and trigger price updates."""

    @staticmethod
    def fetch_from_goldapi() -> Optional[Dict[str, Any]]:
        api_key = Config.GOLDAPI_KEY
        if not api_key or api_key == "your-gold-api-key-here":
            # Log missing API key for visibility
            print("GoldRateService: GOLDAPI_KEY missing or default placeholder; skipping fetch")
            return None
        url = "https://www.goldapi.io/api/XAU/INR"
        headers = {
            "x-access-token": api_key,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.status_code >= 400:
                try:
                    body = resp.text
                except Exception:
                    body = "<unavailable>"
                print(f"GoldRateService: GoldAPI request failed status={resp.status_code} body={body[:200]}")
                return None
            data = resp.json()

            g24 = data.get("price_gram_24k")
            try:
                g24 = float(g24) if g24 is not None else None
            except Exception:
                g24 = None

            if g24 is None:
                try:
                    oz = float(data.get("price"))
                    g24 = oz / 31.1034768
                except Exception:
                    g24 = None

            if g24 is None:
                return None

            def k(val: int) -> float:
                return round(g24 * (val / 24.0), 4)

            rates = {
                "24k": round(g24, 4),
                "22k": k(22),
                "18k": k(18),
                "14k": k(14),
            }
            return {"rates": rates}
        except Exception as e:
            print(f"GoldRateService: Exception calling GoldAPI: {e}")
            return None

    @staticmethod
    def persist_rates(db, rates_payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"updated_at": datetime.now(timezone.utc), "rates": rates_payload.get("rates", {})}
        db.gold_rate.update_one({}, {"$set": payload}, upsert=True)
        return payload

    @staticmethod
    def refresh_and_reprice(db) -> Dict[str, Any]:
        fetched = GoldRateService.fetch_from_goldapi()
        if not fetched:
            return {"success": False, "error": "refresh_failed"}

        payload = GoldRateService.persist_rates(db, fetched)

        # Trigger product price updates
        price_calculator = GoldPriceCalculator(db)
        update_results = price_calculator.update_product_prices(dry_run=False)

        return {
            "success": True,
            "rates": payload["rates"],
            "updated_at": payload["updated_at"],
            "price_update": {
                "success": update_results.get("success", False),
                "updated_count": update_results.get("updated_count", 0),
                "error_count": update_results.get("error_count", 0),
                "skipped_count": update_results.get("skipped_count", 0),
                "errors": update_results.get("errors", []),
            },
        }
