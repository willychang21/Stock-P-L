from fastapi import APIRouter, Depends
from app.schemas.portfolio import PortfolioSummary
from app.services.portfolio_service import portfolio_service

router = APIRouter()

@router.get("/summary", response_model=PortfolioSummary)
def get_portfolio_summary():
    return portfolio_service.get_summary()
