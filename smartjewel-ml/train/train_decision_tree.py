import argparse
import os
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

from .features import build_training_matrix


def train_for_sku(df_sku: pd.DataFrame):
    dates = df_sku["date"].tolist()
    qty = df_sku["qty"].astype(float).tolist()
    X, y = build_training_matrix(dates, qty)
    if len(y) < 30:
        return None, {"n_samples": int(len(y))}
    # simple split: last 14 days for validation
    split = max(1, len(y) - 14)
    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]

    model = DecisionTreeRegressor(max_depth=8, min_samples_leaf=3, random_state=42)
    model.fit(X_train, y_train)

    yhat = model.predict(X_val)
    mae = mean_absolute_error(y_val, yhat)
    rmse = mean_squared_error(y_val, yhat, squared=False)
    return model, {"n_samples": int(len(y)), "val_mae": float(mae), "val_rmse": float(rmse)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default=os.path.join("data", "daily_sales.csv"))
    parser.add_argument("--models", type=str, default="models")
    args = parser.parse_args()

    os.makedirs(args.models, exist_ok=True)

    df = pd.read_csv(args.data)
    # Expected columns: sku,date,qty,avg_price (avg_price optional)
    df["date"] = pd.to_datetime(df["date"]).dt.date.astype(str)
    df = df.sort_values(["sku", "date"])  # ensure order

    report = []
    for sku, g in df.groupby("sku"):
        model, metrics = train_for_sku(g)
        if model is not None:
            safe = sku.replace("/", "_")
            path = os.path.join(args.models, f"dt_{safe}.joblib")
            joblib.dump(model, path)
            report.append({"sku": sku, **metrics, "saved": True})
        else:
            report.append({"sku": sku, **metrics, "saved": False})

    # Print a concise report
    kept = [r for r in report if r.get("saved")]
    print(f"Trained {len(kept)} SKU models out of {len(report)}")
    if kept:
        mae_vals = [r["val_mae"] for r in kept if "val_mae" in r]
        rmse_vals = [r["val_rmse"] for r in kept if "val_rmse" in r]
        if mae_vals:
            print(f"Avg MAE: {np.mean(mae_vals):.3f}")
        if rmse_vals:
            print(f"Avg RMSE: {np.mean(rmse_vals):.3f}")


if __name__ == "__main__":
    main()
