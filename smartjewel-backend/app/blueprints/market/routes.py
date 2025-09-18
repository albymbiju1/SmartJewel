import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required

from . import bp
from app.services.price_calculator import GoldPriceCalculator


def _now():
    return datetime.now(timezone.utc)


def _to_jsonable(doc: dict):
    if not isinstance(doc, dict):
        return doc
    out = {}
    for k, v in doc.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def _fetch_gold_rate_inr() -> Optional[dict]:
    from app.config import Config
    api_key = Config.GOLDAPI_KEY
    if not api_key:
        return None
    # GoldAPI endpoint for XAU/INR spot price
    url = "https://www.goldapi.io/api/XAU/INR"
    headers = {
        "x-access-token": api_key,
        "Content-Type": "application/json",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code >= 400:
            return None
        data = resp.json()
        # GoldAPI provides per-gram rates for 24k and fineness-based fields; derive common retail purities
        # Base: 24k per gram
        g24 = data.get("price_gram_24k")
        try:
            g24 = float(g24) if g24 is not None else None
        except Exception:
            g24 = None
        if g24 is None:
            # As a fallback, derive from ounce price when necessary
            try:
                oz = float(data.get("price"))
                g24 = oz / 31.1034768
            except Exception:
                g24 = None

        if g24 is None:
            return None

        # Derive per-gram for common purities using karat ratio
        def k(val):
            return round(g24 * (val / 24.0), 4)

        rates = {
            "24k": round(g24, 4),
            "22k": k(22),
            "18k": k(18),
            "14k": k(14),
        }
        return {"rates": rates}
    except Exception:
        return None


@bp.get("/gold-rate")
@jwt_required(optional=True)
def get_gold_rate():
    """Return cached gold rate only (fast). Use POST /market/refresh-gold-rate to refresh."""
    db = current_app.extensions['mongo_db']
    doc = db.gold_rate.find_one({}, sort=[("updated_at", -1)]) or {}
    updated_at = doc.get("updated_at")
    rates = (doc.get("rates") or {})

    return jsonify({
        "rates": rates,
        "updated_at": updated_at.isoformat() if hasattr(updated_at, 'isoformat') else updated_at
    })


@bp.post("/refresh-gold-rate")
@jwt_required()  # require auth; front-end admin will call this
def refresh_gold_rate():
    """Force-refresh the gold rate from GoldAPI (spends one API call)."""
    db = current_app.extensions['mongo_db']
    fetched = _fetch_gold_rate_inr()
    if not fetched:
        return jsonify({"error": "refresh_failed"}), 502
    payload = {"updated_at": _now(), "rates": fetched.get("rates", {})}
    db.gold_rate.update_one({}, {"$set": payload}, upsert=True)
    
    # Automatically update product prices when gold rates are refreshed
    try:
        price_calculator = GoldPriceCalculator(db)
        update_results = price_calculator.update_product_prices(dry_run=False)
        
        # Add price update info to response
        response_data = {
            "rates": payload["rates"], 
            "updated_at": payload["updated_at"].isoformat(),
            "price_update": {
                "success": update_results["success"],
                "updated_count": update_results["updated_count"],
                "error_count": update_results["error_count"],
                "skipped_count": update_results["skipped_count"]
            }
        }
        
        if update_results["errors"]:
            response_data["price_update"]["errors"] = update_results["errors"]
        
        return jsonify(response_data)
        
    except Exception as e:
        # Don't fail the gold rate refresh if price update fails
        current_app.logger.error(f"Price update failed during gold rate refresh: {e}")
        return jsonify({
            "rates": payload["rates"], 
            "updated_at": payload["updated_at"].isoformat(),
            "price_update": {"success": False, "error": str(e)}
        })


@bp.post("/update-product-prices")
@jwt_required()  # require auth; admin only
def update_product_prices():
    """Manually update product prices based on current gold rates."""
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    dry_run = data.get("dry_run", False)
    
    try:
        price_calculator = GoldPriceCalculator(db)
        results = price_calculator.update_product_prices(dry_run=dry_run)
        
        if results["success"]:
            return jsonify(results), 200
        else:
            return jsonify(results), 400
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "updated_count": 0,
            "error_count": 0,
            "skipped_count": 0
        }), 500


@bp.get("/price-update-history")
@jwt_required()  # require auth; admin only
def get_price_update_history():
    """Get the history of price update operations."""
    db = current_app.extensions['mongo_db']
    
    try:
        price_calculator = GoldPriceCalculator(db)
        history = price_calculator.get_price_update_history(limit=20)
        
        return jsonify({"history": history}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.get("/last-price-update")
@jwt_required(optional=True)  # allow public access for status
def get_last_price_update():
    """Get information about the last successful price update."""
    db = current_app.extensions['mongo_db']
    
    try:
        price_calculator = GoldPriceCalculator(db)
        last_update = price_calculator.get_last_successful_update()
        
        if last_update:
            return jsonify({"last_update": last_update}), 200
        else:
            return jsonify({"last_update": None}), 200
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.post("/calculate-gold-price")
@jwt_required(optional=True)  # allow public access for testing
def calculate_gold_price():
    """Calculate gold price using the standalone function for testing."""
    data = request.get_json() or {}
    
    try:
        # Validate required fields
        required_fields = ["price_24k_per_gram", "weight_grams", "karat", "making_charge_type", "making_charge_value"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({"error": "Missing required fields", "missing": missing_fields}), 400
        
        # Extract parameters
        price_24k_per_gram = float(data["price_24k_per_gram"])
        weight_grams = float(data["weight_grams"])
        karat = int(data["karat"])
        making_charge_type = data["making_charge_type"]
        making_charge_value = float(data["making_charge_value"])
        gst_percent = float(data.get("gst_percent", 3.0))
        
        # Validate karat
        if karat not in [24, 22, 18, 14]:
            return jsonify({"error": "Invalid karat. Must be 24, 22, 18, or 14"}), 400
        
        # Validate making charge type
        if making_charge_type not in ["percent", "per_gram"]:
            return jsonify({"error": "Invalid making_charge_type. Must be 'percent' or 'per_gram'"}), 400
        
        # Calculate price using standalone function
        final_price = GoldPriceCalculator.calculate_gold_price_standalone(
            price_24k_per_gram=price_24k_per_gram,
            weight_grams=weight_grams,
            karat=karat,
            making_charge_type=making_charge_type,
            making_charge_value=making_charge_value,
            gst_percent=gst_percent
        )
        
        # Calculate breakdown for response
        purity_factors = {24: 1.0, 22: 0.916, 18: 0.750, 14: 0.585}
        purity_factor = purity_factors.get(karat, 1.0)
        gold_cost = price_24k_per_gram * purity_factor * weight_grams
        
        if making_charge_type == "percent":
            making_charges = gold_cost * (making_charge_value / 100.0)
        else:
            making_charges = making_charge_value * weight_grams
        
        subtotal = gold_cost + making_charges
        gst_amount = subtotal * (gst_percent / 100.0)
        
        return jsonify({
            "final_price": final_price,
            "breakdown": {
                "gold_cost": round(gold_cost, 2),
                "making_charges": round(making_charges, 2),
                "subtotal": round(subtotal, 2),
                "gst_percent": gst_percent,
                "gst_amount": round(gst_amount, 2),
                "purity_factor": purity_factor
            },
            "inputs": {
                "price_24k_per_gram": price_24k_per_gram,
                "weight_grams": weight_grams,
                "karat": karat,
                "making_charge_type": making_charge_type,
                "making_charge_value": making_charge_value,
                "gst_percent": gst_percent
            }
        }), 200
        
    except ValueError as e:
        return jsonify({"error": f"Invalid numeric value: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


