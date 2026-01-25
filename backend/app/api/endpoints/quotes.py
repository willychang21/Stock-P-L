from fastapi import APIRouter, Query
from app.services.market_data import market_data_service
from typing import List

router = APIRouter()

@router.get("/")
def get_quotes(symbols: str = Query(..., description="Comma-separated list of symbols")):
    symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    if not symbol_list:
        return {"result": [], "error": None}
        
    quotes = market_data_service.get_quotes(symbol_list)
    
    # Wrap in legacy structure { quoteResponse: { result: [], error: null } }
    # Or simplified { result: [] } as per new contract?
    # Contract says: { result: [...] }
    
    return {"result": quotes}
