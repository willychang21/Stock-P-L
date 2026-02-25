from fastapi import APIRouter, Query
from app.services.market_data import market_data_service
from typing import List

router = APIRouter()

@router.get("")
def get_fundamentals(symbols: str = Query(..., description="Comma-separated list of symbols")):
    symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    if not symbol_list:
        return {"result": [], "error": None}
        
    fundamentals = market_data_service.get_fundamentals(symbol_list)
    
    return {"result": fundamentals}
