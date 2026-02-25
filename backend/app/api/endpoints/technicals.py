from fastapi import APIRouter, Query
from app.services.technical_service import technical_service
from typing import List

router = APIRouter()

@router.get("")
def get_technicals(symbols: str = Query(..., description="Comma-separated list of symbols")):
    symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    if not symbol_list:
        return {"result": [], "error": None}
        
    technicals = technical_service.get_technicals(symbol_list)
    
    return {"result": technicals}
