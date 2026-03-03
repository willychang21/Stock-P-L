from fastapi import APIRouter, Query, BackgroundTasks, HTTPException
from typing import Optional
from app.schemas.screener import ScreenerResponse
from app.schemas.screener_preferences import (
    ScreenerAlertCheckResponse,
    ScreenerAlertEvent,
    ScreenerScreen,
    ScreenerScreenCreate,
    ScreenerScreenUpdate,
    ScreenerView,
    ScreenerViewCreate,
)
from app.services.screener_preferences_service import ScreenerPreferencesService
from app.services.screener_service import ScreenerService

router = APIRouter()

@router.get("", response_model=ScreenerResponse, response_model_exclude_none=True)
async def get_screener(
    # Valuation
    min_mkt_cap: Optional[float] = Query(None),
    max_mkt_cap: Optional[float] = Query(None),
    min_pe: Optional[float] = Query(None),
    max_pe: Optional[float] = Query(None),
    min_ps: Optional[float] = Query(None),
    max_ps: Optional[float] = Query(None),
    min_pb: Optional[float] = Query(None),
    max_pb: Optional[float] = Query(None),
    min_peg: Optional[float] = Query(None),
    max_peg: Optional[float] = Query(None),
    # Profitability
    min_roe: Optional[float] = Query(None),
    max_roe: Optional[float] = Query(None),
    min_roic: Optional[float] = Query(None),
    max_roic: Optional[float] = Query(None),
    min_profit_margin: Optional[float] = Query(None),
    max_profit_margin: Optional[float] = Query(None),
    # Growth
    min_revenue_growth: Optional[float] = Query(None),
    max_revenue_growth: Optional[float] = Query(None),
    min_eps_growth: Optional[float] = Query(None),
    max_eps_growth: Optional[float] = Query(None),
    # Cash Flow
    min_fcf: Optional[float] = Query(None),
    max_fcf: Optional[float] = Query(None),
    # Sentiment & Ownership
    min_target_upside: Optional[float] = Query(None),
    max_target_upside: Optional[float] = Query(None),
    min_recommendation_mean: Optional[float] = Query(None),
    max_recommendation_mean: Optional[float] = Query(None),
    min_short_percent: Optional[float] = Query(None),
    max_short_percent: Optional[float] = Query(None),
    min_inst_own: Optional[float] = Query(None),
    max_inst_own: Optional[float] = Query(None),
    min_insider_own: Optional[float] = Query(None),
    max_insider_own: Optional[float] = Query(None),
    # Momentum & Margins
    min_beta: Optional[float] = Query(None),
    max_beta: Optional[float] = Query(None),
    min_gross_margin: Optional[float] = Query(None),
    max_gross_margin: Optional[float] = Query(None),
    min_ebitda_margin: Optional[float] = Query(None),
    max_ebitda_margin: Optional[float] = Query(None),
    # Standard & Metadata
    has_options: Optional[bool] = Query(None),
    sector: Optional[str] = Query(None),
    only_holdings: bool = Query(False),
    sort_by: str = Query("market_cap"),
    sort_order: str = Query("desc"),
    limit: int = Query(100),
    offset: int = Query(0)
):
    """Retrieve filtered stocks from the screener cache with advanced metrics."""
    return ScreenerService.get_screener_stocks(
        min_mkt_cap=min_mkt_cap,
        max_mkt_cap=max_mkt_cap,
        min_pe=min_pe,
        max_pe=max_pe,
        min_ps=min_ps,
        max_ps=max_ps,
        min_pb=min_pb,
        max_pb=max_pb,
        min_peg=min_peg,
        max_peg=max_peg,
        min_roe=min_roe,
        max_roe=max_roe,
        min_roic=min_roic,
        max_roic=max_roic,
        min_profit_margin=min_profit_margin,
        max_profit_margin=max_profit_margin,
        min_revenue_growth=min_revenue_growth,
        max_revenue_growth=max_revenue_growth,
        min_eps_growth=min_eps_growth,
        max_eps_growth=max_eps_growth,
        min_fcf=min_fcf,
        max_fcf=max_fcf,
        min_target_upside=min_target_upside,
        max_target_upside=max_target_upside,
        min_recommendation_mean=min_recommendation_mean,
        max_recommendation_mean=max_recommendation_mean,
        min_short_percent=min_short_percent,
        max_short_percent=max_short_percent,
        min_inst_own=min_inst_own,
        max_inst_own=max_inst_own,
        min_insider_own=min_insider_own,
        max_insider_own=max_insider_own,
        min_beta=min_beta,
        max_beta=max_beta,
        min_gross_margin=min_gross_margin,
        max_gross_margin=max_gross_margin,
        min_ebitda_margin=min_ebitda_margin,
        max_ebitda_margin=max_ebitda_margin,
        has_options=has_options,
        sector=sector,
        only_holdings=only_holdings,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset
    )

@router.get("/top-ideas")
async def get_top_ideas(limit: int = Query(5)):
    """Fetch top rated stocks from the screener database."""
    return ScreenerService.get_top_ideas(limit)

@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, tickers: list[str]):
    """Manually trigger a sync for specific tickers in the background."""
    background_tasks.add_task(ScreenerService.sync_universe, tickers)
    return {"message": f"Sync started for {len(tickers)} tickers"}

@router.post("/sync-all")
async def trigger_sync_all(background_tasks: BackgroundTasks):
    """Fetch all US tickers and trigger a full background sync."""
    tickers = await ScreenerService.get_all_us_tickers()
    background_tasks.add_task(ScreenerService.sync_universe, tickers)
    return {"message": f"Sync started for {len(tickers)} US tickers", "count": len(tickers)}

@router.get("/sync-status")
async def get_sync_status():
    """Return current screener sync status."""
    return ScreenerService.get_sync_status()


@router.get("/symbol/{symbol}/insights")
async def get_symbol_insights(symbol: str):
    """Return live yfinance insights for one symbol."""
    return ScreenerService.get_symbol_insights(symbol)


@router.get("/market-pulse")
async def get_market_pulse():
    """Return market pulse snapshot from yfinance."""
    return ScreenerService.get_market_pulse()


@router.get("/views", response_model=list[ScreenerView])
async def list_screener_views():
    return ScreenerPreferencesService.list_views()


@router.post("/views", response_model=ScreenerView)
async def create_screener_view(payload: ScreenerViewCreate):
    return ScreenerPreferencesService.create_view(payload)


@router.delete("/views/{view_id}")
async def delete_screener_view(view_id: str):
    ScreenerPreferencesService.delete_view(view_id)
    return {"ok": True}


@router.get("/screens", response_model=list[ScreenerScreen])
async def list_screener_screens():
    return ScreenerPreferencesService.list_screens()


@router.post("/screens", response_model=ScreenerScreen)
async def create_screener_screen(payload: ScreenerScreenCreate):
    return ScreenerPreferencesService.create_screen(payload)


@router.put("/screens/{screen_id}", response_model=ScreenerScreen)
async def update_screener_screen(screen_id: str, payload: ScreenerScreenUpdate):
    updated = ScreenerPreferencesService.update_screen(screen_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Screen not found")
    return updated


@router.delete("/screens/{screen_id}")
async def delete_screener_screen(screen_id: str):
    ScreenerPreferencesService.delete_screen(screen_id)
    return {"ok": True}


@router.post("/screens/check-alerts", response_model=ScreenerAlertCheckResponse)
async def check_screener_alerts():
    events = ScreenerPreferencesService.check_alerts()
    return {"generated": len(events), "events": events}


@router.get("/alerts", response_model=list[ScreenerAlertEvent])
async def list_screener_alerts(limit: int = Query(50, ge=1, le=200)):
    return ScreenerPreferencesService.list_alert_events(limit=limit)


@router.patch("/alerts/{event_id}/read")
async def mark_screener_alert_read(event_id: str):
    ScreenerPreferencesService.mark_alert_read(event_id)
    return {"ok": True}
