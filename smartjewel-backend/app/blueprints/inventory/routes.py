from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.authz import require_permissions, require_any_role


bp = Blueprint("inventory", __name__, url_prefix="/inventory")
# Helper: read latest gold rate per gram (24k) and return float or None
def _latest_rates(db):
    try:
        doc = db.gold_rate.find_one({}, sort=[("updated_at", -1)]) or {}
        rates = doc.get("rates") or {}
        # Normalize keys to lower e.g. "24k" -> "24k"
        norm = {str(k).lower(): float(v) for k, v in rates.items() if v is not None}
        return norm
    except Exception:
        return {}

# -------- Locations --------
@bp.post("/locations")
@require_any_role("admin")
def create_location():
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    required = ["name", "type"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "validation_failed", "missing": missing}), 400
    if db.locations.find_one({"name": data["name"]}):
        return jsonify({"error": "duplicate_location"}), 409
    doc = {
        "name": data["name"],
        "type": data["type"],  # branch | warehouse | safe | consignment
        "address": data.get("address"),
        "parent_location_id": _oid(data.get("parent_location_id")),
        "created_at": _now(db)
    }
    ins = db.locations.insert_one(doc)
    return jsonify({"id": str(ins.inserted_id)}), 201


@bp.get("/locations")
@require_permissions("inventory.location.read")
def list_locations():
    db = current_app.extensions['mongo_db']
    cur = db.locations.find({}).limit(200)
    out = []
    for d in cur:
        d["_id"] = str(d["_id"]) 
        if d.get("parent_location_id"): d["parent_location_id"] = str(d["parent_location_id"]) 
        out.append(d)
    return jsonify({"locations": out})


# -------- Prices --------
@bp.post("/prices")
@require_permissions("inventory.valuation.read")
def set_price():
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    required = ["metal", "purity", "rate", "currency"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "validation_failed", "missing": missing}), 400
    doc = {
        "metal": data["metal"],
        "purity": data["purity"],
        "rate": float(data["rate"]),
        "currency": data.get("currency", "INR"),
        "timestamp": _now(db)
    }
    db.prices.insert_one(doc)
    return jsonify({"saved": True}), 201


@bp.get("/prices/latest")
@require_permissions("inventory.valuation.read")
def latest_prices():
    db = current_app.extensions['mongo_db']
    out = []
    for p in db.prices.aggregate([
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": {"metal": "$metal", "purity": "$purity"}, "rate": {"$first": "$rate"}, "currency": {"$first": "$currency"}, "timestamp": {"$first": "$timestamp"}}}
    ]):
        out.append({
            "metal": p["_id"]["metal"],
            "purity": p["_id"]["purity"],
            "rate": p["rate"],
            "currency": p.get("currency", "INR"),
            "timestamp": p.get("timestamp")
        })
    return jsonify({"prices": out})


# -------- BOM Production --------
@bp.post("/bom/produce")
@require_permissions("inventory.bom.manage")
def bom_produce():
    """Consume components as per BOM and add finished goods stock.
    Request: {product_id, quantity, to_location_id, note}
    quantity scales component quantities; supports weight and pieces per component.
    """
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    product_oid = _oid(data.get("product_id"))
    if not product_oid:
        return jsonify({"error": "bad_product_id"}), 400
    qty = data.get("quantity", 1)
    to_loc = _oid(data.get("to_location_id"))
    bom = db.bom.find_one({"product_id": product_oid})
    if not bom:
        return jsonify({"error": "bom_not_found"}), 404

    # 1) Consume components
    comps = bom.get("components", [])
    for comp in comps:
        comp_item = _oid(comp.get("item_id"))
        if not comp_item:
            continue
        comp_qty = (comp.get("quantity") or 0) * qty
        comp_weight = (comp.get("weight") or 0.0) * qty
        db.stock_movements.insert_one({
            "item_id": comp_item,
            "type": "outward",
            "quantity": comp_qty,
            "weight": comp_weight,
            "unit": comp.get("unit"),
            "from_location_id": to_loc,  # assume components pulled from same shop/workshop
            "to_location_id": None,
            "ref": {"doc_type": "BOM_PRODUCE", "product_id": product_oid},
            "note": data.get("note"),
            "created_by": _oid(get_jwt_identity()),
            "created_at": _now(db)
        })
        # decrement stock_levels
        db.stock_levels.update_one(
            {"item_id": comp_item, "location_id": to_loc},
            {"$inc": {"quantity": -(comp_qty or 0), "weight": -(comp_weight or 0.0)}},
            upsert=True
        )

    # 2) Add finished product stock
    db.stock_movements.insert_one({
        "item_id": product_oid,
        "type": "inward",
        "quantity": qty,
        "weight": data.get("finished_weight"),
        "unit": data.get("unit"),
        "from_location_id": None,
        "to_location_id": to_loc,
        "ref": {"doc_type": "BOM_PRODUCE"},
        "note": data.get("note"),
        "created_by": _oid(get_jwt_identity()),
        "created_at": _now(db)
    })
    db.stock_levels.update_one(
        {"item_id": product_oid, "location_id": to_loc},
        {"$inc": {"quantity": qty or 0, "weight": (data.get("finished_weight") or 0.0)}, "$setOnInsert": {"unit": data.get("unit")}},
        upsert=True
    )

    return jsonify({"produced": True})


def _oid(val):
    try:
        return ObjectId(val)
    except Exception:
        return None


def _now(db):
    # Use Mongo server time if available
    try:
        is_master = db.command("isMaster")
        return is_master.get("localTime")
    except Exception:
        from datetime import datetime
        return datetime.utcnow()


@bp.post("/items")
@require_permissions("inventory.create")
def create_item():
    import os
    from werkzeug.utils import secure_filename
    
    db = current_app.extensions['mongo_db']
    
    # Handle both JSON and form data
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()
        
        # Handle numeric fields
        for field in ['weight', 'price']:
            if field in data and data[field]:
                try:
                    data[field] = float(data[field])
                except ValueError:
                    data[field] = 0
    
    required = ["sku", "name", "category", "metal", "purity", "weight_unit"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "validation_failed", "missing": missing}), 400

    if db.items.find_one({"sku": data["sku"]}):
        return jsonify({"error": "duplicate_sku"}), 409

    # Handle image upload
    image_url = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename:
            filename = secure_filename(file.filename)
            # Create uploads directory if it doesn't exist
            upload_dir = os.path.join(current_app.static_folder or 'static', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            import uuid
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join(upload_dir, unique_filename)
            
            file.save(file_path)
            # Use full URL for frontend to display images properly
            image_url = f"http://127.0.0.1:5000/static/uploads/{unique_filename}"

    doc = {
        "sku": data["sku"],
        "name": data["name"],
        "category": data["category"],
        "metal": data["metal"],
        "purity": data["purity"],
        "weight_unit": data["weight_unit"],
        "weight": data.get("weight", 0),
        "price": data.get("price", 0),
        "description": data.get("description", ""),
        "image": image_url,
        "default_location_id": _oid(data.get("default_location_id")),
        "attributes": data.get("attributes", {}),
        "status": "active",
        "created_at": _now(db),
        "updated_at": _now(db),
    }
    ins = db.items.insert_one(doc)
    return jsonify({"id": str(ins.inserted_id)}), 201


@bp.get("/items")
@require_permissions("inventory.read")
def list_items():
    db = current_app.extensions['mongo_db']
    q = {}
    for f in ["category", "metal", "purity", "status", "sku"]:
        v = request.args.get(f)
        if v:
            q[f] = v
    cur = db.items.find(q).limit(200)
    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        if d.get("default_location_id"):
            d["default_location_id"] = str(d["default_location_id"])
        items.append(d)
    return jsonify({"items": items})


# Public endpoint for customer-facing product catalog (no authentication required)
@bp.get("/products")
def list_products():
    """Public endpoint for displaying products to customers without authentication."""
    try:
        db = current_app.extensions['mongo_db']
        q = {"status": "active"}
        # Optional filtering by category, metal, etc.
        for f in ["category", "metal", "purity"]:
            v = request.args.get(f)
            if v:
                q[f] = v
        cur = db.items.find(q).limit(200)
        items = []
        for d in cur:
            d["_id"] = str(d["_id"])
            if d.get("default_location_id"):
                d["default_location_id"] = str(d["default_location_id"])
            items.append(d)
        return jsonify({"products": items})
    except Exception as exc:
        # Fail fast if DB is unavailable so frontend loader doesn't spin
        current_app.logger.error("catalog_fetch_failed", extra={"error": str(exc)})
        return jsonify({"products": []}), 200


from flask_jwt_extended import jwt_required

@bp.get("/items/<item_id>")
@jwt_required(optional=True)
def get_item(item_id):
    db = current_app.extensions['mongo_db']
    oid = _oid(item_id)
    if not oid:
        return jsonify({"error": "bad_id"}), 400
    d = db.items.find_one({"_id": oid})
    if not d:
        return jsonify({"error": "not_found"}), 404
    d["_id"] = str(d["_id"])
    if d.get("default_location_id"):
        d["default_location_id"] = str(d["default_location_id"])
    # Compute price using the proper price calculation system
    try:
        from app.services.price_calculator import GoldPriceCalculator
        
        weight = float(d.get("weight") or 0)
        unit = (d.get("weight_unit") or 'g').lower()
        if unit in ('gram', 'grams', 'g'):
            grams = weight
        elif unit in ('mg', 'milligram', 'milligrams'):
            grams = weight / 1000.0
        elif unit in ('kg', 'kilogram', 'kilograms'):
            grams = weight * 1000.0
        else:
            grams = weight
            
        if grams > 0:
            # Get current gold rates
            rates = _latest_rates(db)
            gold_rate_24k = rates.get('24k', 0)
            
            if gold_rate_24k > 0:
                # Use the proper price calculator
                price_calculator = GoldPriceCalculator(db)
                price_breakdown = price_calculator.calculate_total_price(d, gold_rate_24k)
                d["computed_price"] = price_breakdown["total_price"]
                d["currency"] = "INR"
                d["price_breakdown"] = price_breakdown
    except Exception as e:
        # Fallback to old method if new calculation fails
        try:
            weight = float(d.get("weight") or 0)
            unit = (d.get("weight_unit") or 'g').lower()
            if unit in ('gram', 'grams', 'g'):
                grams = weight
            elif unit in ('mg', 'milligram', 'milligrams'):
                grams = weight / 1000.0
            elif unit in ('kg', 'kilogram', 'kilograms'):
                grams = weight * 1000.0
            else:
                grams = weight
            rates = _latest_rates(db)
            purity_key = str(d.get("purity") or '').lower()
            base_rate = rates.get(purity_key) or rates.get('24k')
            making = float((d.get('making_charges') or 0))
            gst_rate = float((d.get('gst_percent') or 0)) / 100.0
            if base_rate:
                base = grams * base_rate
                subtotal = base + making
                total = round(subtotal * (1 + gst_rate), 2)
                d["computed_price"] = total
                d["currency"] = "INR"
        except Exception:
            pass
    return jsonify({"item": d})


@bp.put("/items/<item_id>")
@require_permissions("inventory.update")
def update_item(item_id):
    import os
    from werkzeug.utils import secure_filename
    
    db = current_app.extensions['mongo_db']
    oid = _oid(item_id)
    if not oid:
        return jsonify({"error": "bad_id"}), 400
        
    # Handle both JSON and form data
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()
        
        # Handle numeric fields
        for field in ['weight', 'price']:
            if field in data and data[field]:
                try:
                    data[field] = float(data[field])
                except ValueError:
                    data[field] = 0
                    
    allowed = {"name", "category", "metal", "purity", "weight_unit", "weight", "price", "description", "attributes", "status", "default_location_id"}
    update = {}
    
    for k, v in data.items():
        if k in allowed:
            if k == "default_location_id":
                update[k] = ObjectId(v) if v else None
            else:
                update[k] = v
                
    # Handle image upload
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename:
            filename = secure_filename(file.filename)
            upload_dir = os.path.join(current_app.static_folder or 'static', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            
            import uuid
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join(upload_dir, unique_filename)
            
            file.save(file_path)
            # Use full URL for frontend to display images properly
            update["image"] = f"http://127.0.0.1:5000/static/uploads/{unique_filename}"
    
    if not update:
        return jsonify({"error": "nothing_to_update"}), 400
    update["updated_at"] = _now(db)
    res = db.items.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"updated": True})


@bp.delete("/items/<item_id>")
@require_any_role("admin")
def delete_item(item_id):
    db = current_app.extensions['mongo_db']
    oid = _oid(item_id)
    if not oid:
        return jsonify({"error": "bad_id"}), 400
    res = db.items.update_one({"_id": oid}, {"$set": {"status": "deleted", "updated_at": _now(db)}})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"deleted": True})


@bp.post("/stock/move")
@require_permissions("inventory.flow")
def stock_move():
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    required = ["item_id", "type"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "validation_failed", "missing": missing}), 400
    mtype = data.get("type")
    if mtype not in ("inward", "outward", "transfer", "adjustment"):
        return jsonify({"error": "bad_type"}), 400

    item_oid = _oid(data["item_id"]) 
    if not item_oid:
        return jsonify({"error": "bad_item_id"}), 400

    from_loc = _oid(data.get("from_location_id"))
    to_loc = _oid(data.get("to_location_id"))

    qty = data.get("quantity")
    weight = data.get("weight")
    unit = data.get("unit")

    # Movement record
    mov = {
        "item_id": item_oid,
        "type": mtype,
        "quantity": qty,
        "weight": weight,
        "unit": unit,
        "from_location_id": from_loc,
        "to_location_id": to_loc,
        "ref": data.get("ref"),
        "note": data.get("note"),
        "created_by": _oid(get_jwt_identity()),
        "created_at": _now(db)
    }
    db.stock_movements.insert_one(mov)

    # Update stock_levels per location
    def upsert_level(loc_id, qty_delta, weight_delta):
        if not loc_id:
            return
        db.stock_levels.update_one(
            {"item_id": item_oid, "location_id": loc_id},
            {"$inc": {"quantity": qty_delta or 0, "weight": weight_delta or 0.0}, "$setOnInsert": {"unit": unit}},
            upsert=True
        )

    if mtype == "inward":
        upsert_level(to_loc or from_loc, qty or 0, weight or 0.0)
    elif mtype == "outward":
        upsert_level(from_loc or to_loc, -(qty or 0), -(weight or 0.0))
    elif mtype == "transfer":
        upsert_level(from_loc, -(qty or 0), -(weight or 0.0))
        upsert_level(to_loc, qty or 0, weight or 0.0)
    elif mtype == "adjustment":
        upsert_level(to_loc or from_loc, qty or 0, weight or 0.0)

    return jsonify({"moved": True})


@bp.get("/stock/ledger")
@require_permissions("inventory.read")
def stock_ledger():
    db = current_app.extensions['mongo_db']
    q = {}
    if request.args.get("item_id"):
        oid = _oid(request.args.get("item_id"))
        if not oid:
            return jsonify({"error": "bad_item_id"}), 400
        q["item_id"] = oid
    if request.args.get("location_id"):
        oid = _oid(request.args.get("location_id"))
        if not oid:
            return jsonify({"error": "bad_location_id"}), 400
        q["$or"] = [{"from_location_id": oid}, {"to_location_id": oid}]
    cur = current_app.extensions['mongo_db'].stock_movements.find(q).sort("created_at", -1).limit(300)
    out = []
    for m in cur:
        m["_id"] = str(m["_id"]) 
        m["item_id"] = str(m["item_id"]) 
        if m.get("from_location_id"): m["from_location_id"] = str(m["from_location_id"]) 
        if m.get("to_location_id"): m["to_location_id"] = str(m["to_location_id"]) 
        if m.get("created_by"): m["created_by"] = str(m["created_by"]) 
        out.append(m)
    return jsonify({"movements": out})


@bp.post("/tags/assign")
@require_permissions("inventory.tag.assign")
def tags_assign():
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    required = ["item_id", "tag"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": "validation_failed", "missing": missing}), 400
    item_oid = _oid(data["item_id"]) 
    if not item_oid:
        return jsonify({"error": "bad_item_id"}), 400
    tag = data["tag"]
    # ensure uniqueness of tag
    if db.tags.find_one({"tag": tag}):
        return jsonify({"error": "tag_in_use"}), 409
    db.tags.insert_one({
        "tag": tag,
        "item_id": item_oid,
        "assigned_at": _now(db),
        "assigned_by": _oid(get_jwt_identity())
    })
    return jsonify({"assigned": True})


@bp.get("/valuation")
@require_permissions("inventory.valuation.read")
def valuation():
    db = current_app.extensions['mongo_db']
    # latest price per metal+purity * weight (uses prices documents: metal, purity, rate, currency, timestamp)
    latest_prices = {}
    for p in db.prices.aggregate([
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": {"metal": "$metal", "purity": "$purity"}, "rate": {"$first": "$rate"}, "currency": {"$first": "$currency"}}}
    ]):
        key = f"{p['_id']['metal']}|{p['_id']['purity']}"
        latest_prices[key] = {"rate": p["rate"], "currency": p.get("currency", "INR")}

    items = []
    currency = None
    cur = db.stock_levels.aggregate([
        {"$lookup": {"from": "items", "localField": "item_id", "foreignField": "_id", "as": "item"}},
        {"$unwind": "$item"}
    ])
    for sl in cur:
        it = sl["item"]
        key = f"{it['metal']}|{it['purity']}"
        price_info = latest_prices.get(key, {"rate": 0, "currency": "INR"})
        if currency is None:
            currency = price_info.get("currency", "INR")
        weight = sl.get("weight", 0)
        items.append({
            "item_id": str(it["_id"]),
            "sku": it["sku"],
            "metal": it["metal"],
            "purity": it["purity"],
            "unit": sl.get("unit"),
            "weight": weight,
            "valuation": round((price_info["rate"] or 0) * (weight or 0), 2),
            "currency": price_info.get("currency", "INR")
        })
    total = round(sum(i["valuation"] for i in items), 2)
    return jsonify({"total": total, "currency": currency or "INR", "items": items})


@bp.post("/bom")
@require_permissions("inventory.bom.manage")
def bom_create():
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    if not data.get("product_id") or not isinstance(data.get("components"), list):
        return jsonify({"error": "validation_failed"}), 400
    product_oid = _oid(data["product_id"]) 
    if not product_oid:
        return jsonify({"error": "bad_product_id"}), 400
    db.bom.update_one(
        {"product_id": product_oid},
        {"$set": {"components": data["components"], "updated_at": _now(db)}},
        upsert=True
    )
    return jsonify({"saved": True})


@bp.get("/bom/<product_id>")
@require_permissions("inventory.bom.manage")
def bom_get(product_id):
    db = current_app.extensions['mongo_db']
    oid = _oid(product_id)
    if not oid:
        return jsonify({"error": "bad_product_id"}), 400
    doc = db.bom.find_one({"product_id": oid}) or {"product_id": product_id, "components": []}
    if doc and doc.get("_id"): doc["_id"] = str(doc["_id"]) 
    if doc and doc.get("product_id"): doc["product_id"] = str(doc["product_id"]) 
    return jsonify(doc)


@bp.patch("/bom/<product_id>")
@require_permissions("inventory.bom.manage")
def bom_update(product_id):
    db = current_app.extensions['mongo_db']
    oid = _oid(product_id)
    if not oid:
        return jsonify({"error": "bad_product_id"}), 400
    data = request.get_json() or {}
    update = {}
    if "components" in data:
        update["components"] = data["components"]
    if not update:
        return jsonify({"error": "nothing_to_update"}), 400
    update["updated_at"] = _now(db)
    db.bom.update_one({"product_id": oid}, {"$set": update}, upsert=True)
    return jsonify({"updated": True})