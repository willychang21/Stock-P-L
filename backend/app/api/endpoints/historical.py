from fastapi import APIRouter, Query
from app.services.market_data import market_data_service

router = APIRouter()

@router.get("")
def get_historical_prices(
    symbol: str = Query(..., description="Stock symbol"),
    startDate: str = Query(..., description="Start date (YYYY-MM-DD)"),
    endDate: str = Query(..., description="End date (YYYY-MM-DD)")
):
    if symbol == "CASH":
        return []
    return market_data_service.get_historical_prices(symbol, startDate, endDate)
