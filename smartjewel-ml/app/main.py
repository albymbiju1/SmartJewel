from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta

from .inference import Forecaster

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SmartJewel ML Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryPoint(BaseModel):
    date: str
    qty: float


class ForecastRequest(BaseModel):
    sku: str
    horizon_days: int = Field(default=7, ge=1, le=60)
    recent_history: List[HistoryPoint] = Field(default_factory=list)
    optional_features: Optional[Dict] = None


class ForecastDay(BaseModel):
    date: str
    forecast: float


class ForecastResponse(BaseModel):
    sku: str
    horizon_days: int
    daily: List[ForecastDay]
    totals: Dict[str, float]


@app.post("/ml/inventory/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    try:
        forecaster = Forecaster()
        daily = forecaster.forecast(
            sku=req.sku,
            horizon_days=req.horizon_days,
            recent_history=[{"date": h.date, "qty": h.qty} for h in req.recent_history],
            optional_features=req.optional_features or {}
        )
        sum_7 = sum([d["forecast"] for d in daily[:7]]) if len(daily) >= 7 else sum([d["forecast"] for d in daily])
        sum_30 = sum([d["forecast"] for d in daily[:30]]) if len(daily) >= 30 else sum([d["forecast"] for d in daily])
        return ForecastResponse(
            sku=req.sku,
            horizon_days=req.horizon_days,
            daily=[ForecastDay(**d) for d in daily],
            totals={"sum_7": round(sum_7, 3), "sum_30": round(sum_30, 3)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
