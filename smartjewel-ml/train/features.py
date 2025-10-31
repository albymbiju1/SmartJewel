from typing import List, Dict
from datetime import datetime, timedelta
import numpy as np


def _dow(date):
    return date.weekday()


def _week_of_year(date):
    return int(date.strftime("%U"))


def _month(date):
    return date.month


def _rolling(arr: List[float], window: int, func):
    if len(arr) < window:
        return float(np.mean(arr)) if arr else 0.0
    return float(func(arr[-window:]))


def _lag(arr: List[float], k: int):
    if len(arr) < k:
        return float(arr[-1]) if arr else 0.0
    return float(arr[-k])


def build_features_for_inference(history_series: List[Dict], target_date):
    # history_series: list of {date, qty} sorted asc
    qty_series = [float(x["qty"]) for x in history_series]
    # Calendar features
    dow = _dow(target_date)
    woy = _week_of_year(target_date)
    mon = _month(target_date)
    # Lags
    lag1 = _lag(qty_series, 1)
    lag7 = _lag(qty_series, 7)
    lag14 = _lag(qty_series, 14)
    # Rolling stats
    mean7 = _rolling(qty_series, 7, np.mean)
    std7 = _rolling(qty_series, 7, np.std)
    mean14 = _rolling(qty_series, 14, np.mean)
    mean28 = _rolling(qty_series, 28, np.mean)

    return [dow, woy, mon, lag1, lag7, lag14, mean7, std7, mean14, mean28]


def build_training_matrix(dates: List[str], qty: List[float]):
    # Returns X (features), y (target) aligned for next-day prediction
    series = [{"date": d, "qty": float(q)} for d, q in zip(dates, qty)]
    # ensure sorted
    series.sort(key=lambda x: x["date"])
    X = []
    y = []
    parsed_dates = [datetime.fromisoformat(d) for d in [s["date"] for s in series]]
    for i in range(len(series)):
        if i < 28:  # need enough history for robust features
            continue
        target_date = parsed_dates[i] + timedelta(days=1)
        feats = build_features_for_inference(series[: i + 1], target_date)
        X.append(feats)
        y.append(float(series[i + 0]["qty"]))  # predict next day's qty based on current day features
    return np.array(X), np.array(y)
