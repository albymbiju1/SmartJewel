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
    from app.utils.cloudinary_helper import upload_image, is_cloudinary_configured
    
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
            try:
                # Try Cloudinary first (for production)
                if is_cloudinary_configured():
                    result = upload_image(
                        file,
                        folder="smartjewel/products",
                        public_id=f"product_{data['sku']}"
                    )
                    image_url = result['secure_url']
                    current_app.logger.info(f"Image uploaded to Cloudinary: {result['public_id']}")
                else:
                    # Fallback to local storage (development only)
                    filename = secure_filename(file.filename)
                    upload_dir = os.path.join(current_app.static_folder or 'static', 'uploads')
                    os.makedirs(upload_dir, exist_ok=True)
                    
                    import uuid
                    file_ext = os.path.splitext(filename)[1]
                    unique_filename = f"{uuid.uuid4()}{file_ext}"
                    file_path = os.path.join(upload_dir, unique_filename)
                    
                    file.save(file_path)
                    image_url = f"/static/uploads/{unique_filename}"
                    current_app.logger.info(f"Image saved locally: {unique_filename}")
                    
            except Exception as img_error:
                current_app.logger.error(f"Image upload failed: {str(img_error)}")
                return jsonify({
                    "error": "image_upload_failed",
                    "message": f"Failed to upload image: {str(img_error)}"
                }), 500

    # Handle new fields
    gemstones = data.get("gemstones", "")
    if isinstance(gemstones, str) and gemstones:
        gemstones_list = [g.strip() for g in gemstones.split(",") if g.strip()]
    else:
        gemstones_list = gemstones if isinstance(gemstones, list) else []
    
    tags = data.get("tags", "")
    if isinstance(tags, str) and tags:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]
    else:
        tags_list = tags if isinstance(tags, list) else []

    doc = {
        "sku": data["sku"],
        "name": data["name"],
        "category": data["category"],
        "sub_category": data.get("sub_category", ""),
        "metal": data["metal"],
        "purity": data["purity"],
        "weight_unit": data["weight_unit"],
        "weight": data.get("weight", 0),
        "price": data.get("price", 0),
        "description": data.get("description", ""),
        "image": image_url,
        "gemstones": gemstones_list,
        "color": data.get("color", ""),
        "style": data.get("style", ""),
        "tags": tags_list,
        "brand": data.get("brand", "Smart Jewel"),
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
        # Optional filtering by category, metal, purity, and additional filters
        for f in ["category", "metal", "purity", "color", "style"]:
            v = request.args.get(f)
            if v:
                q[f] = v
        
        # Handle sub_category filter (for earring types)
        sub_category = request.args.get("earringType")
        if sub_category:
            q["sub_category"] = sub_category
            
        # Handle tags-based filters (for occasion and for)
        tags_filters = []
        occasion = request.args.get("occasion")
        if occasion:
            tags_filters.append(occasion)
            
        for_filter = request.args.get("for")
        if for_filter:
            tags_filters.append(for_filter)
            
        if tags_filters:
            q["tags"] = {"$in": tags_filters}
        
        # Ensure all items have a quantity field (default 0)
        db.items.update_many(
            {"quantity": {"$exists": False}},
            {"$set": {"quantity": 0}}
        )
        
        cur = db.items.find(q).limit(200)
        items = []
        for d in cur:
            d["_id"] = str(d["_id"])
            if d.get("default_location_id"):
                d["default_location_id"] = str(d["default_location_id"])
            # Ensure quantity exists and is a number
            if "quantity" not in d:
                d["quantity"] = 0
            else:
                d["quantity"] = int(d["quantity"]) if d["quantity"] is not None else 0
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
    from app.utils.cloudinary_helper import upload_image, is_cloudinary_configured, delete_image
    
    db = current_app.extensions['mongo_db']
    oid = _oid(item_id)
    if not oid:
        return jsonify({"error": "bad_id"}), 400
    
    try:
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
                        
        allowed = {"name", "category", "sub_category", "metal", "purity", "weight_unit", "weight", "price", "description", "attributes", "status", "default_location_id", "gemstones", "color", "style", "tags", "brand"}
        update = {}
        
        for k, v in data.items():
            if k in allowed:
                if k == "default_location_id":
                    update[k] = ObjectId(v) if v else None
                elif k == "gemstones":
                    if isinstance(v, str) and v:
                        update[k] = [g.strip() for g in v.split(",") if g.strip()]
                    else:
                        update[k] = v if isinstance(v, list) else []
                elif k == "tags":
                    if isinstance(v, str) and v:
                        update[k] = [t.strip() for t in v.split(",") if t.strip()]
                    else:
                        update[k] = v if isinstance(v, list) else []
                else:
                    update[k] = v
                    
        # Handle image upload
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename:
                try:
                    # Get existing item to find old image for cleanup
                    existing_item = db.items.find_one({"_id": oid})
                    old_image = existing_item.get("image") if existing_item else None
                    
                    # Try Cloudinary first (for production)
                    if is_cloudinary_configured():
                        # Delete old image from Cloudinary if it exists
                        if old_image and old_image.startswith("https://res.cloudinary.com"):
                            # Extract public_id from Cloudinary URL
                            try:
                                # URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456/folder/filename.jpg
                                parts = old_image.split("/")
                                if "upload" in parts:
                                    upload_idx = parts.index("upload")
                                    # public_id is everything after upload/ without extension
                                    public_id_parts = parts[upload_idx + 2:]  # Skip version
                                    public_id = "/".join(public_id_parts).rsplit(".", 1)[0]
                                    delete_image(public_id)
                            except Exception as del_err:
                                current_app.logger.warning(f"Failed to delete old Cloudinary image: {del_err}")
                        
                        # Upload new image
                        sku = existing_item.get("sku") if existing_item else item_id
                        result = upload_image(
                            file,
                            folder="smartjewel/products",
                            public_id=f"product_{sku}"
                        )
                        update["image"] = result['secure_url']
                        current_app.logger.info(f"Image uploaded to Cloudinary: {result['public_id']}")
                    else:
                        # Fallback to local storage (development only)
                        filename = secure_filename(file.filename)
                        upload_dir = os.path.join(current_app.static_folder or 'static', 'uploads')
                        os.makedirs(upload_dir, exist_ok=True)
                        
                        import uuid
                        file_ext = os.path.splitext(filename)[1]
                        unique_filename = f"{uuid.uuid4()}{file_ext}"
                        file_path = os.path.join(upload_dir, unique_filename)
                        
                        file.save(file_path)
                        update["image"] = f"/static/uploads/{unique_filename}"
                        current_app.logger.info(f"Image saved locally: {unique_filename}")
                        
                except Exception as img_error:
                    current_app.logger.error(f"Image upload failed: {str(img_error)}")
                    return jsonify({
                        "error": "image_upload_failed",
                        "message": f"Failed to upload image: {str(img_error)}"
                    }), 500
        
        if not update:
            return jsonify({"error": "nothing_to_update"}), 400
            
        update["updated_at"] = _now(db)
        res = db.items.update_one({"_id": oid}, {"$set": update})
        
        if res.matched_count == 0:
            return jsonify({"error": "not_found"}), 404
            
        return jsonify({"updated": True})
        
    except Exception as e:
        current_app.logger.error(f"Update item failed for {item_id}: {str(e)}")
        return jsonify({
            "error": "update_failed",
            "message": str(e)
        }), 500


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


@bp.post("/items/import")
@require_permissions("inventory.create")
def import_items():
    """Import items from CSV data. Accepts JSON array of items."""
    db = current_app.extensions['mongo_db']
    
    try:
        data = request.get_json() or {}
        items_to_import = data.get("items", [])
        
        if not items_to_import:
            return jsonify({"error": "no_items", "message": "No items to import"}), 400
        
        if not isinstance(items_to_import, list):
            return jsonify({"error": "invalid_format", "message": "Items must be an array"}), 400
        
        imported_count = 0
        failed_count = 0
        errors = []
        
        for idx, item_data in enumerate(items_to_import):
            try:
                required = ["sku", "name", "category", "metal", "purity", "weight_unit"]
                missing = [f for f in required if not item_data.get(f)]
                if missing:
                    errors.append(f"Row {idx + 1}: Missing required fields: {', '.join(missing)}")
                    failed_count += 1
                    continue
                
                if db.items.find_one({"sku": item_data["sku"]}):
                    errors.append(f"Row {idx + 1}: SKU '{item_data['sku']}' already exists")
                    failed_count += 1
                    continue
                
                gemstones = item_data.get("gemstones", "")
                if isinstance(gemstones, str) and gemstones:
                    gemstones_list = [g.strip() for g in gemstones.split(",") if g.strip()]
                else:
                    gemstones_list = gemstones if isinstance(gemstones, list) else []
                
                tags = item_data.get("tags", "")
                if isinstance(tags, str) and tags:
                    tags_list = [t.strip() for t in tags.split(";") if t.strip()]
                else:
                    tags_list = tags if isinstance(tags, list) else []
                
                weight = item_data.get("weight")
                price = item_data.get("price")
                if weight:
                    try:
                        weight = float(weight)
                    except (ValueError, TypeError):
                        weight = 0
                
                if price:
                    try:
                        price = float(price)
                    except (ValueError, TypeError):
                        price = 0
                
                doc = {
                    "sku": item_data["sku"],
                    "name": item_data["name"],
                    "category": item_data["category"],
                    "sub_category": item_data.get("sub_category", ""),
                    "metal": item_data["metal"],
                    "purity": item_data["purity"],
                    "weight_unit": item_data["weight_unit"],
                    "weight": weight or 0,
                    "price": price or 0,
                    "description": item_data.get("description", ""),
                    "image": None,
                    "gemstones": gemstones_list,
                    "color": item_data.get("color", ""),
                    "style": item_data.get("style", ""),
                    "tags": tags_list,
                    "brand": item_data.get("brand", "Smart Jewel"),
                    "default_location_id": _oid(item_data.get("default_location_id")) if item_data.get("default_location_id") else None,
                    "attributes": item_data.get("attributes", {}),
                    "status": item_data.get("status", "active"),
                    "created_at": _now(db),
                    "updated_at": _now(db),
                }
                db.items.insert_one(doc)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")
                failed_count += 1
        
        response = {
            "success": imported_count > 0,
            "imported": imported_count,
            "failed": failed_count,
            "total": len(items_to_import),
            "message": f"Successfully imported {imported_count} items"
        }
        
        if errors and len(errors) <= 10:
            response["errors"] = errors
        elif errors:
            response["error_count"] = len(errors)
            response["first_errors"] = errors[:5]
        
        return jsonify(response), 201 if imported_count > 0 else 400
        
    except Exception as e:
        current_app.logger.error(f"CSV import failed: {str(e)}")
        return jsonify({
            "error": "import_failed",
            "message": str(e)
        }), 500


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


# -------- Stock Management --------
@bp.get("/stock")
@require_permissions("inventory.read")
def get_stock():
    """Get all products with stock information"""
    db = current_app.extensions['mongo_db']
    
    # Ensure all items have a quantity field (default 0)
    db.items.update_many(
        {"quantity": {"$exists": False}},
        {"$set": {"quantity": 0}}
    )
    
    # Get all items with their stock info
    items = list(db.items.find({}, {
        "sku": 1,
        "name": 1,
        "category": 1,
        "quantity": 1,
        "status": 1
    }))
    
    # Convert ObjectIds to strings
    for item in items:
        item["_id"] = str(item["_id"])
        # Ensure quantity exists
        if "quantity" not in item:
            item["quantity"] = 0
    
    return jsonify({"products": items})


@bp.put("/stock/<sku>")
@require_permissions("inventory.update")
def update_stock(sku):
    """Update stock quantity for a product by SKU"""
    db = current_app.extensions['mongo_db']
    data = request.get_json() or {}
    
    if "quantity" not in data:
        return jsonify({"error": "quantity_required"}), 400
    
    try:
        new_quantity = int(data["quantity"])
        if new_quantity < 0:
            return jsonify({"error": "invalid_quantity"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "invalid_quantity"}), 400
    
    # Find the current item to get old quantity and name
    item = db.items.find_one({"sku": sku})
    if not item:
        return jsonify({"error": "item_not_found"}), 404
    
    old_quantity = item.get("quantity", 0)
    product_name = item.get("name", "Unknown Product")
    
    # Update the item quantity
    result = db.items.update_one(
        {"sku": sku},
        {"$set": {"quantity": new_quantity, "updated_at": _now(db)}}
    )
    
    if result.matched_count == 0:
        return jsonify({"error": "item_not_found"}), 404
    
    # Determine change type
    if old_quantity == 0 and new_quantity > 0:
        change_type = "Added"
    elif old_quantity > 0 and new_quantity == 0:
        change_type = "Removed"
    elif old_quantity != new_quantity:
        change_type = "Updated"
    else:
        change_type = "Updated"  # Same quantity but still an update
    
    # Get current user info
    current_user_id = get_jwt_identity()
    changed_by = "System"
    try:
        user = db.users.find_one({"_id": _oid(current_user_id)})
        if user:
            changed_by = user.get("name", user.get("email", "Unknown User"))
    except:
        pass
    
    # Create stock history record
    history_record = {
        "sku": sku,
        "productName": product_name,
        "changedBy": changed_by,
        "changeType": change_type,
        "quantityBefore": old_quantity,
        "quantityAfter": new_quantity,
        "timestamp": _now(db)
    }
    db.stock_history.insert_one(history_record)
    
    return jsonify({
        "success": True,
        "quantity": new_quantity
    })


@bp.get("/stock/history")
@require_permissions("inventory.read")
def get_stock_history():
    """Get stock history with filtering and pagination"""
    db = current_app.extensions['mongo_db']
    
    # Get query parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    change_type = request.args.get('changeType', 'All')
    
    # Build filter query
    query = {}
    if change_type and change_type != 'All':
        query['changeType'] = change_type
    
    # Calculate skip value for pagination
    skip = (page - 1) * per_page
    
    # Get total count for pagination
    total_count = db.stock_history.count_documents(query)
    
    # Get history records with pagination
    history_records = list(
        db.stock_history.find(query)
        .sort("timestamp", -1)  # Most recent first
        .skip(skip)
        .limit(per_page)
    )
    
    # Convert ObjectIds to strings
    for record in history_records:
        record["_id"] = str(record["_id"])
        # Format timestamp for display
        if record.get("timestamp"):
            record["formattedTimestamp"] = record["timestamp"].strftime("%d %b %Y, %I:%M %p")
    
    # Calculate pagination info
    total_pages = (total_count + per_page - 1) // per_page
    
    return jsonify({
        "history": history_records,
        "pagination": {
            "current_page": page,
            "per_page": per_page,
            "total_count": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    })