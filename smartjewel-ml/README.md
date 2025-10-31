# SmartJewel ML Service (Forecasting)

Decision Tree-based demand forecasting (7/30 days) served via FastAPI.

## Structure
- app/main.py: FastAPI app with /ml/inventory/forecast
- app/inference.py: Model loading and forecasting logic
- train/train_decision_tree.py: Training script (per-SKU models)
- train/features.py: Feature engineering utilities
- models/: Saved .joblib models per SKU
- data/daily_sales.csv: Input data (sku,date,qty,avg_price)

## Orders -> daily_sales.csv (Mongo aggregation example)
```js
// Use payment_status: "paid". Adjust field names as needed.
db.orders.aggregate([
  { $match: { payment_status: "paid" } },
  { $unwind: "$items" },
  { $addFields: {
      day: { $dateToString: { date: "$created_at", format: "%Y-%m-%d" } },
      sku: "$items.id",
      qty: "$items.qty",
      price: "$items.price"
  }},
  { $group: { _id: { sku: "$sku", day: "$day" }, qty: { $sum: "$qty" }, avg_price: { $avg: "$price" } } },
  { $project: { _id: 0, sku: "$_id.sku", date: "$_id.day", qty: 1, avg_price: 1 } },
  { $sort: { sku: 1, date: 1 } }
]).forEach(doc => printjson(doc));
```
Save the output as CSV with headers: `sku,date,qty,avg_price`.

## Train
```bash
python -m smartjewel-ml.train.train_decision_tree --data data/daily_sales.csv --models models
```

## Run API
```bash
uvicorn app.main:app --reload --port 8085
```

## Request example
```bash
curl -X POST http://localhost:8085/ml/inventory/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "68fd1060b8e92ed166f4d2ec",
    "horizon_days": 7,
    "recent_history": [
      {"date":"2025-10-01","qty":1},
      {"date":"2025-10-02","qty":0}
    ]
  }'
```
