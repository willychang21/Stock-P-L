from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.watchlist import (
    WatchlistAddRequest,
    WatchlistItem,
    WatchlistResponse,
    WatchlistSearchItem,
    WatchlistUpdateRequest,
    WatchlistDCFSimulationRequest,
    WatchlistDCFSimulationResponse,
)
from app.services.watchlist_service import watchlist_service

router = APIRouter()


@router.get("", response_model=WatchlistResponse, response_model_exclude_none=True)
def list_watchlist():
    return watchlist_service.list_watchlist()


@router.post("/dcf-simulate", response_model=WatchlistDCFSimulationResponse)
def simulate_dcf(payload: WatchlistDCFSimulationRequest):
    return watchlist_service.simulate_dcf(payload.dict())


@router.get(
    "/search",
    response_model=list[WatchlistSearchItem],
    response_model_exclude_none=True,
)
def search_watchlist_symbols(
    q: str = Query(..., min_length=1, description="Search by symbol or name"),
    limit: int = Query(12, ge=1, le=50),
):
    return watchlist_service.search_symbols(q=q, limit=limit)


@router.post("", response_model=WatchlistItem, response_model_exclude_none=True)
def add_watchlist_item(payload: WatchlistAddRequest):
    try:
        return watchlist_service.add_symbol(payload.symbol, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{symbol}", response_model=WatchlistItem, response_model_exclude_none=True)
def update_watchlist_item(symbol: str, payload: WatchlistUpdateRequest):
    item = watchlist_service.update_note(symbol, payload.note)
    if item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return item


@router.delete("/{symbol}")
def remove_watchlist_item(symbol: str):
    removed = watchlist_service.remove_symbol(symbol)
    if not removed:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return {"ok": True}
