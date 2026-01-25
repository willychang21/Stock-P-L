from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict
from app.services.market_data import market_data_service

router = APIRouter()

@router.get("/", response_model=List[Dict])
async def get_fundamentals(symbols: List[str] = Query(..., description="List of stock symbols")):
    """
    Fetch fundamental data (sector, industry, PE, etc.) for a list of symbols.
    """
    try:
        return market_data_service.get_fundamentals(symbols)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
