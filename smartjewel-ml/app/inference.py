import math
from typing import List, Dict
from datetime import datetime, timedelta

import numpy as np
from sklearn.tree import DecisionTreeRegressor


class Forecaster:
    """
    Simple on-the-fly DecisionTreeRegressor forecaster.
    - Trains a tree on sliding windows of the provided daily quantity history
    - Uses last `lag_window` days as features to predict the next day
    - Rolls forward recursively for `horizon_days`
    No persisted artifacts are required.
    """

    def __init__(self, lag_window: int = 7, min_train_points: int = 10, random_state: int = 42):
        self.lag_window = max(2, int(lag_window))
        self.min_train_points = max(5, int(min_train_points))
        self.random_state = random_state

    def _prepare_continuous_history(self, recent_history: List[Dict]) -> List[Dict]:
        hist = sorted(recent_history, key=lambda x: x["date"]) if recent_history else []
        if not hist:
            return []
        daily = {h["date"]: float(h["qty"]) for h in hist}
        start = datetime.fromisoformat(hist[0]["date"]).date()
        end = datetime.fromisoformat(hist[-1]["date"]).date()
        cur = start
        out = []
        while cur <= end:
            key = cur.isoformat()
            out.append({"date": key, "qty": daily.get(key, 0.0)})
            cur += timedelta(days=1)
        return out

    def _build_training_data(self, series: List[float]):
        X, y = [], []
        for i in range(self.lag_window, len(series)):
            X.append(series[i - self.lag_window:i])
            y.append(series[i])
        return np.array(X, dtype=float), np.array(y, dtype=float)

    def _train_model(self, series: List[float]):
        X, y = self._build_training_data(series)
        if len(y) < self.min_train_points:
            return None
        model = DecisionTreeRegressor(random_state=self.random_state, max_depth=6, min_samples_leaf=2)
        model.fit(X, y)
        return model

    def _predict_next(self, model, window: List[float], fallback_mean: float) -> float:
        try:
            if model is not None:
                pred = float(model.predict(np.array([window], dtype=float))[0])
            else:
                pred = float(fallback_mean)
            if not math.isfinite(pred):
                pred = fallback_mean
            return max(0.0, pred)
        except Exception:
            return max(0.0, fallback_mean)

    def forecast(self, sku: str, horizon_days: int, recent_history: List[Dict], optional_features: Dict) -> List[Dict]:
        full_hist = self._prepare_continuous_history(recent_history)
        if not full_hist:
            today = datetime.utcnow().date()
            return [{"date": (today + timedelta(days=i + 1)).isoformat(), "forecast": 0.0} for i in range(horizon_days)]

        values = [p["qty"] for p in full_hist]
        fallback_mean = float(np.mean(values[-self.lag_window:])) if values else 0.0
        model = self._train_model(values)

        # If series too short for tree, extend with mean baseline
        work_values = values.copy()
        last_date = datetime.fromisoformat(full_hist[-1]["date"]).date()
        forecasts = []

        for i in range(horizon_days):
            if len(work_values) < self.lag_window:
                yhat = fallback_mean
            else:
                window = work_values[-self.lag_window:]
                yhat = self._predict_next(model, window, fallback_mean)
            target_date = last_date + timedelta(days=i + 1)
            yhat = round(max(0.0, yhat), 3)
            forecasts.append({"date": target_date.isoformat(), "forecast": yhat})
            work_values.append(yhat)

        return forecasts
