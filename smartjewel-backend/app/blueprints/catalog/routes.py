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


# --- GenAI Chat Endpoint ---
@bp.post('/chat')
def chat():
    """Handle intelligent chatbot requests using Mistral AI.

    Strategy:
    - Fast-path only for order cancel/track with a detected order ID (returns deterministic text or calls internal tracker).
    - For everything else, delegate to Mistral with a jewellery-specific system prompt to ensure intelligent, on-topic replies.
    """
    try:
        # Import current_app directly in the function scope to avoid scoping issues
        from flask import current_app, request, jsonify
        
        # Get the database connection
        db = current_app.extensions.get('mongo_db')
        if db is None:
            return jsonify({"error": "Database not available"}), 503

        # Parse request data
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        history = data.get("history") or []  # optional: list of {role, content}
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Configure Mistral AI
        from mistralai import Mistral
        import os

        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            return jsonify({"error": "Mistral API key not configured"}), 500

        model_name = os.getenv("MISTRAL_MODEL", "mistral-small")
        max_tokens = int(os.getenv("MISTRAL_MAX_TOKENS", "150"))  # Reduced from 220 to 150
        temperature = float(os.getenv("MISTRAL_TEMPERATURE", "0.4"))
        client = Mistral(api_key=api_key)

        # Minimal intent detection for tool-like paths; otherwise rely on LLM
        intent = "general"
        context = ""
        response_text = ""

        lower_message = user_message.lower()
        
        # Debug output for intent detection
        print(f"Processing message: {user_message}")
        print(f"Lower message: {lower_message}")
        
        # Check gold rate intent first
        is_gold_rate_query = (any(keyword in lower_message for keyword in ["gold rate", "gold price", "price of gold", "rate of gold"]) or \
             ("gold" in lower_message and "1 gram" in lower_message and any(keyword in lower_message for keyword in ["price", "rate", "cost", "much"])) or \
             ("price" in lower_message and "1 gram" in lower_message and "gold" in lower_message))
        print(f"Is gold rate query: {is_gold_rate_query}")
        
        # Order cancellation intent - check this first as it's more specific
        if ("cancel" in lower_message and ("order" in lower_message or "ord" in lower_message)) or \
           lower_message.startswith("cancel my order") or \
           lower_message.startswith("cancel order") or \
           "cancel my order" in lower_message:
            intent = "order_cancellation"
            # Try to extract order ID
            import re
            order_id_match = re.search(r'(SJ-?\d+|\d{4,})', user_message, re.IGNORECASE)
            if order_id_match:
                order_id = order_id_match.group(1)
                # Return a message indicating that cancellation needs to be done through the proper endpoint
                response_text = f"To cancel your order {order_id}, please visit your Orders page and click the 'Cancel Order' button. If you need help with that, I can guide you through the process."
            else:
                response_text = "To cancel an order, please provide the order number. For example: 'Cancel my order 12345'"
        
        # Order tracking intent
        elif any(keyword in lower_message for keyword in ["track", "status", "where is my order", "order #", "order number"]):
            intent = "order_tracking"
            # Try to extract order ID
            import re
            order_id_match = re.search(r'(SJ-?\d+|\d{4,})', user_message, re.IGNORECASE)
            if order_id_match:
                order_id = order_id_match.group(1)
                # Use the new public tracking endpoint
                try:
                    # Import requests to make HTTP call
                    import requests
                    
                    # Get the base URL of the current app
                    base_url = request.url_root.rstrip('/')
                    track_url = f"{base_url}/api/orders/track/{order_id}"
                    
                    # Make request to tracking endpoint
                    track_response = requests.get(track_url)
                    
                    if track_response.status_code == 200:
                        track_data = track_response.json()
                        status = track_data.get("status", "unknown")
                        created_at = track_data.get("createdAt", "")
                        
                        response_text = f"Order {order_id} is currently {status}."
                        if created_at:
                            response_text += f" It was created on {created_at.split('T')[0]}."
                    elif track_response.status_code == 404:
                        response_text = f"I couldn't find any order with ID {order_id}. Please check the order number and try again."
                    else:
                        response_text = f"Sorry, I'm having trouble tracking your order right now. Please try again later."
                except Exception as e:
                    print(f"Error tracking order: {str(e)}")
                    response_text = f"Sorry, I'm having trouble tracking your order right now. Please try again later."
            else:
                response_text = "Please provide your order number to track it. For example: 'Where is my order 12345?'"
        
        # Gold rate intent - handle gold price queries directly
        elif any(keyword in lower_message for keyword in ["gold rate", "gold price", "price of gold", "rate of gold"]) or \
             ("gold" in lower_message and "1 gram" in lower_message and any(keyword in lower_message for keyword in ["price", "rate", "cost", "much"])) or \
             ("price" in lower_message and "1 gram" in lower_message and "gold" in lower_message):
            print(f"Gold rate intent detected for message: {user_message}")
            intent = "gold_rate"
            try:
                # Get gold rates from the database
                gold_rates_collection = db.gold_rate
                latest_rate_doc = gold_rates_collection.find_one(sort=[("updated_at", -1)])
                
                if latest_rate_doc and "rates" in latest_rate_doc:
                    rates = latest_rate_doc["rates"]
                    fmt = lambda n: f"₹{n:,.2f}/g" if isinstance(n, (int, float)) else "N/A"
                    response_lines = [
                        "Current gold rates (per gram):",
                        f"24K: {fmt(rates.get('24k'))}",
                        f"22K: {fmt(rates.get('22k'))}",
                        f"18K: {fmt(rates.get('18k'))}",
                        f"14K: {fmt(rates.get('14k'))}",
                        f"\nUpdated: {latest_rate_doc.get('updated_at', 'N/A')}"
                    ]
                    response_text = "\n".join(response_lines)
                else:
                    response_text = "I'm sorry, I couldn't fetch the current gold rates. Please try again later or visit our website for the most up-to-date information."
            except Exception as e:
                print(f"Error fetching gold rates: {str(e)}")
                response_text = "I'm sorry, I'm having trouble accessing the gold rates right now. Please try again later or check our website for current rates."
        
        # For non-tool paths, defer to LLM with a jewellery-specific system prompt
        if not response_text:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are SmartJewel's Jewellery Assistant. Be concise, friendly and accurate. "
                        "Specialize in jewellery, gemstones, metal purity, pricing guidance, certification, care, sizing, store policies, and orders. "
                        "Ask a brief clarifying question when details are missing (e.g., type or budget). "
                        "Use Indian English and INR formatting when relevant. "
                        "Focus on jewelry expertise: rings, necklaces, earrings, bangles, pendants, mangalsutras, nose pins. "
                        "Materials: gold (24K, 22K, 18K, 14K), platinum, silver, diamonds, emeralds, rubies, sapphires. "
                        "Provide specific care instructions for different materials. "
                        "Explain certification (BIS hallmark for gold, IGI/GIA for diamonds). "
                        "Offer sizing guidance and recommend visiting stores for accurate measurements. "
                        "Discuss customization options (5-7 working days additional). "
                        "Mention gold investment options (BIS certified coins and bars). "
                        "For product inquiries, recommend browsing our full catalog. "
                        "Do not make up product names or prices. "
                        "Stay focused on jewelry-related topics. "
                        "Keep responses concise and to the point, under 3 sentences. "
                        "Always provide complete and well-structured responses that end properly."
                    ),
                }
            ]

            # Append trimmed conversation history if provided
            try:
                for m in history[-8:]:  # keep last 8 messages
                    role = m.get("role")
                    content = (m.get("content") or "").strip()
                    if role in ("user", "assistant") and content:
                        messages.append({"role": role, "content": content})
            except Exception:
                pass

            messages.append({"role": "user", "content": user_message})

            chat_response = client.chat.complete(
                model=model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            response_text = chat_response.choices[0].message.content

        # Return the response
        return jsonify({
            "reply": response_text,
            "intent": intent,
            "context": context
        })
        
    except Exception as e:
        # Log the error for debugging
        import traceback
        print(f"Chat endpoint error: {str(e)}")
        print(traceback.format_exc())
        
        # Return a friendly error message
        return jsonify({
            "reply": "I'm sorry, I'm having trouble processing your request right now. Please try again later or contact our customer support team.",
            "error": "internal_error"
        }), 500
