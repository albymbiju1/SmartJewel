from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId

bp = Blueprint("catalog", __name__, url_prefix="/catalog")


# --- Utilities ---
def _db():
    return current_app.extensions['mongo_db']


def _ensure_indexes():
    """Create indexes required for fast search. Safe to call repeatedly."""
    db = _db()
    try:
        # Weighted text index prioritizing name > category > description
        db.items.drop_index('text_all_fields')  # ignore failure
    except Exception:
        pass
    try:
        db.items.create_index(
            [("name", "text"), ("category", "text"), ("description", "text")],
            name="text_weighted",
            default_language="english",
            weights={"name": 10, "category": 5, "description": 2},
        )
    except Exception:
        pass
    try:
        db.items.create_index([("price", 1)], name="price_asc")
    except Exception:
        pass
    try:
        db.items.create_index([("metal", 1)], name="metal_idx")
    except Exception:
        pass
    try:
        db.items.create_index([("purity", 1)], name="purity_idx")
    except Exception:
        pass
    try:
        db.items.create_index([("weight", 1)], name="weight_asc")
    except Exception:
        pass
    try:
        db.items.create_index([("status", 1)], name="status_idx")
    except Exception:
        pass


_INDEXES_READY = False

def _ensure_indexes_once():
    global _INDEXES_READY
    if _INDEXES_READY:
        return
    try:
        _ensure_indexes()
        _INDEXES_READY = True
    except Exception:
        # Ignore index failures for request path; subsequent requests can retry
        pass


# --- Query helpers ---
def _parse_float(val, default=None):
    try:
        if val is None:
            return default
        return float(val)
    except Exception:
        return default


def _parse_int(val, default=None):
    try:
        if val is None:
            return default
        return int(val)
    except Exception:
        return default


def _split_csv(val):
    if not val:
        return []
    return [v.strip() for v in str(val).split(',') if v.strip()]


def _build_match_from_args(args):
    match = {"status": "active"}
    # Metal filter (comma-separated)
    metals = _split_csv(args.get('metal'))
    if metals:
        match["metal"] = {"$in": metals}
    # Purity filter (comma-separated)
    purities = _split_csv(args.get('purity'))
    if purities:
        match["purity"] = {"$in": purities}
    # Price range
    min_price = _parse_float(args.get('min_price'))
    max_price = _parse_float(args.get('max_price'))
    if min_price is not None or max_price is not None:
        pr = {}
        if min_price is not None:
            pr["$gte"] = min_price
        if max_price is not None:
            pr["$lte"] = max_price
        match["price"] = pr
    # Weight range
    min_weight = _parse_float(args.get('min_weight'))
    max_weight = _parse_float(args.get('max_weight'))
    if min_weight is not None or max_weight is not None:
        wr = {}
        if min_weight is not None:
            wr["$gte"] = min_weight
        if max_weight is not None:
            wr["$lte"] = max_weight
        match["weight"] = wr
    # Category filter - handle both single category and multiple categories
    categories = _split_csv(args.get('categories')) or _split_csv(args.get('category'))
    if categories:
        # Create case-insensitive variations for each category
        category_variations = []
        for cat in categories:
            category_variations.append(cat)  # Original case
            category_variations.append(cat.lower())  # Lowercase
            category_variations.append(cat.upper())  # Uppercase
            category_variations.append(cat.capitalize())  # Capitalized
        
        # Remove duplicates while preserving order
        unique_variations = []
        seen = set()
        for var in category_variations:
            if var not in seen:
                unique_variations.append(var)
                seen.add(var)
        
        match["category"] = {"$in": unique_variations}
    # Color filter (comma-separated)
    colors = _split_csv(args.get('color'))
    if colors:
        match["color"] = {"$in": colors}
    # Style filter (comma-separated)
    styles = _split_csv(args.get('style'))
    if styles:
        match["style"] = {"$in": styles}
    # Earring type filter (using sub_category field)
    earring_types = _split_csv(args.get('earringType'))
    if earring_types:
        match["sub_category"] = {"$in": earring_types}
    # Occasion filter (using tags field)
    occasions = _split_csv(args.get('occasion'))
    if occasions:
        # Use regex to match occasions in tags array
        match["tags"] = {"$in": occasions}
    # For filter (using tags field)
    for_values = _split_csv(args.get('for'))
    if for_values:
        # Use regex to match for values in tags array
        if "tags" in match:
            # Combine with existing tags filter
            match["tags"]["$in"].extend(for_values)
        else:
            match["tags"] = {"$in": for_values}
    # Budget filter (map to price ranges)
    budgets = _split_csv(args.get('budget'))
    if budgets:
        # We'll handle budget mapping in the frontend by converting to min_price/max_price
        # This is just a placeholder in case we want to handle it server-side too
        pass
    return match


def _sort_stage(args):
    sort = args.get('sort', 'relevance')
    # Supported: price_asc, price_desc, weight_asc, weight_desc, newest
    if sort == 'price_asc':
        return {"price": 1}
    if sort == 'price_desc':
        return {"price": -1}
    if sort == 'weight_asc':
        return {"weight": 1}
    if sort == 'weight_desc':
        return {"weight": -1}
    if sort == 'newest':
        return {"updated_at": -1}
    # fallback: by textScore if text search used, else by updated_at desc
    return None


# --- Endpoints ---
@bp.get('/search')
@jwt_required(optional=True)
def search_products():
    """Advanced catalog search with filters and pagination.
    Query params: q, min_price, max_price, metal, purity, min_weight, max_weight, category,
    sort (price_asc|price_desc|weight_asc|weight_desc|newest|relevance), page, per_page
    """
    _ensure_indexes_once()
    db = _db()

    q = (request.args.get('q') or '').strip()
    page = max(1, _parse_int(request.args.get('page'), 1) or 1)
    per_page = min(60, max(1, _parse_int(request.args.get('per_page'), 20) or 20))
    skip = (page - 1) * per_page

    match = _build_match_from_args(request.args)

    pipeline = []

    # Text search if q provided
    use_text = False
    if q:
        use_text = True
        pipeline.append({"$match": {"$text": {"$search": q}}})
        # Also keep other filters in match
        if match:
            pipeline.append({"$match": match})
    else:
        pipeline.append({"$match": match})

    # Sorting
    sort_spec = _sort_stage(request.args)
    if sort_spec is not None:
        pipeline.append({"$sort": sort_spec})
    elif use_text:
        pipeline.append({"$sort": {"score": {"$meta": "textScore"}}})
    else:
        pipeline.append({"$sort": {"updated_at": -1}})

    # Projection (include text score when relevant)
    proj = {
        "sku": 1,
        "name": 1,
        "category": 1,
        "metal": 1,
        "purity": 1,
        "weight": 1,
        "weight_unit": 1,
        "price": 1,
        "image": 1,
        "updated_at": 1,
        "quantity": 1,
    }
    if use_text:
        proj["score"] = {"$meta": "textScore"}
    pipeline.append({"$project": proj})

    # Pagination with total count
    pipeline.append({
        "$facet": {
            "results": [
                {"$skip": skip},
                {"$limit": per_page},
            ],
            "total": [
                {"$count": "count"}
            ]
        }
    })

    agg = list(db.items.aggregate(pipeline))
    results = agg[0]["results"] if agg else []
    total = (agg[0]["total"][0]["count"] if agg and agg[0]["total"] else 0)

    # Convert _id
    for d in results:
        if d.get("_id"):
            d["_id"] = str(d["_id"])

    # Optionally record recent search
    _record_recent_search(q, request.args)

    return jsonify({
        "results": results,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    })


def _record_recent_search(q: str, args):
    if not q:
        return
    db = _db()
    try:
        user_id = get_jwt_identity()
    except Exception:
        user_id = None

    # Allow anonymous tracking via optional client_id param
    client_id = args.get('client_id')
    owner = None
    if user_id:
        try:
            owner = ObjectId(user_id)
        except Exception:
            owner = None
    elif client_id:
        owner = client_id  # keep as string

    if not owner:
        return

    doc = {
        "owner": owner,
        "term": (q or '').strip(),
        "filters": {k: v for k, v in args.items() if k not in ("page", "per_page")},
        "ts": datetime.utcnow(),
    }
    # Insert; also keep only last 10 per owner
    db.recent_searches.insert_one(doc)
    try:
        excess = list(db.recent_searches.find({"owner": owner}).sort("ts", -1).skip(10))
        if excess:
            ids = [d["_id"] for d in excess]
            db.recent_searches.delete_many({"_id": {"$in": ids}})
    except Exception:
        pass


@bp.get('/suggestions')
@jwt_required(optional=True)
def suggestions():
    """Return auto-suggestions for search terms from product names and categories."""
    _ensure_indexes_once()
    db = _db()
    q = (request.args.get('q') or '').strip()
    limit = min(10, max(1, _parse_int(request.args.get('limit'), 7) or 7))
    if not q:
        return jsonify({"suggestions": []})

    suggestions = []
    try:
        # Text search path with score, then group by normalized name to remove duplicates
        pipeline = [
            {"$match": {"$text": {"$search": q}}},
            {"$addFields": {"score": {"$meta": "textScore"}}},
            {"$project": {"name": 1, "category": 1, "score": 1}},
            # Prefer name; fallback to category when name missing
            {"$addFields": {"cand": {"$ifNull": ["$name", "$category"]}}},
            {"$addFields": {"norm": {"$toLower": {"$trim": {"input": "$cand"}}}}},
            {"$match": {"cand": {"$type": "string"}}},
            {"$sort": {"score": -1}},
            {"$group": {"_id": "$norm", "cand": {"$first": "$cand"}, "score": {"$first": "$score"}}},
            {"$sort": {"score": -1}},
            {"$limit": limit},
        ]
        docs = list(db.items.aggregate(pipeline))
        suggestions = [d.get("cand") for d in docs if d.get("cand")]
    except Exception:
        suggestions = []

    # Fuzzy/regex fallback or complement when too few
    if len(suggestions) < limit:
        remaining = limit - len(suggestions)
        # Build fuzzy contains and prefix regex on name/category/description
        rx = {"$regex": q, "$options": "i"}
        rx_prefix = {"$regex": f"^{q}", "$options": "i"}
        cur = db.items.find(
            {"$or": [
                {"name": rx_prefix}, {"category": rx_prefix},
                {"name": rx}, {"category": rx}, {"description": rx},
            ]},
            {"name": 1, "category": 1, "_id": 0}
        ).limit(remaining * 4)
        seen = set([s.lower() for s in suggestions])
        for d in cur:
            for field in ("name", "category"):
                v = (d.get(field) or '').strip()
                if v and (v.lower() not in seen):
                    suggestions.append(v)
                    seen.add(v.lower())
                    if len(suggestions) >= limit:
                        break
            if len(suggestions) >= limit:
                break

    return jsonify({"suggestions": suggestions[:limit]})


@bp.get('/recent-searches')
@jwt_required(optional=True)
def get_recent_searches():
    _ensure_indexes_once()
    db = _db()
    try:
        user_id = get_jwt_identity()
    except Exception:
        user_id = None
    client_id = request.args.get('client_id')

    if user_id:
        try:
            owner = ObjectId(user_id)
        except Exception:
            owner = None
    else:
        owner = client_id

    if not owner:
        return jsonify({"recent": []})

    cur = db.recent_searches.find({"owner": owner}).sort("ts", -1).limit(10)
    out = []
    for d in cur:
        out.append({
            "term": d.get("term"),
            "filters": d.get("filters", {}),
            "ts": d.get("ts")
        })
    return jsonify({"recent": out})


@bp.post('/recent-searches')
@jwt_required(optional=True)
def post_recent_search():
    _ensure_indexes_once()
    data = request.get_json() or {}
    term = (data.get('term') or '').strip()
    filters = data.get('filters') or {}

    if not term:
        return jsonify({"error": "term_required"}), 400

    _record_recent_search(term, filters)
    return jsonify({"saved": True})
