import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required

from . import bp
from app.services.price_calculator import GoldPriceCalculator
from app.services.gold_rate_service import GoldRateService
from app.scheduler import trigger_gold_rate_refresh


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
    """Deprecated: Kept for backwards compatibility; delegate to GoldRateService."""
    return GoldRateService.fetch_from_goldapi()


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
        "updated_at": updated_at.isoformat() + '+05:30' if hasattr(updated_at, 'isoformat') else updated_at
    })


@bp.post("/refresh-gold-rate")
@jwt_required()  # require auth; front-end admin will call this
def refresh_gold_rate():
    """Force-refresh the gold rate from GoldAPI (spends one API call)."""
    db = current_app.extensions['mongo_db']
    result = GoldRateService.refresh_and_reprice(db)
    if not result.get("success"):
        return jsonify({"error": result.get("error", "refresh_failed")}), 502

    # Build response
    upd_at = result.get("updated_at")
    updated_at = upd_at.isoformat() + '+05:30' if hasattr(upd_at, 'isoformat') else upd_at
    return jsonify({
        "rates": result.get("rates", {}),
        "updated_at": updated_at,
        "price_update": result.get("price_update", {})
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


@bp.post("/trigger-scheduler-job")
@jwt_required()  # require auth; admin only
def trigger_scheduler_job():
    """Manually trigger the scheduled gold rate refresh job for testing."""
    try:
        result = trigger_gold_rate_refresh(current_app)
        if result["success"]:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


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


