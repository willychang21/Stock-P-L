from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.services.strategy_service import strategy_service

router = APIRouter()

@router.get("/signals/{symbol}")
def get_strategy_signals(symbol: str):
    """
    Get technical analysis signals and strategy suggestions for a symbol.
    """
    result = strategy_service.get_signals(symbol)
    if "error" in result:
        # If no data found, return 404, otherwise 500
        if result["error"] == "No data found":
             raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
