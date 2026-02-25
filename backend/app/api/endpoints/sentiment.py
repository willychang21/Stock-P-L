from fastapi import APIRouter
from app.services.sentiment_service import sentiment_service

router = APIRouter()

@router.get("/market")
def get_market_sentiment():
    result = sentiment_service.get_market_sentiment()
    if "error" in result.get("status", ""):
        return {"error": result.get("message")}
    return {"result": result}
