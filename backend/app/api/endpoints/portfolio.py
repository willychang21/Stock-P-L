from fastapi import APIRouter, Depends, HTTPException
from app.services.portfolio_service import portfolio_service
from app.core.domain.models import Portfolio

router = APIRouter()

from app.services.analytics_service import analytics_service

@router.get("/summary", response_model=Portfolio)
def get_portfolio_summary(calculator_id: str = 'fifo'):
    try:
        return portfolio_service.get_portfolio(calculator_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/behavior")
def get_behavioral_analytics():
    try:
        return analytics_service.get_behavioral_analytics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
