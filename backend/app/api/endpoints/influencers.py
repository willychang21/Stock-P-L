from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timedelta
import uuid
from app.db.session import get_db
from app.schemas.influencer import (
    Influencer, InfluencerCreate, InfluencerUpdate, 
    Recommendation, RecommendationCreate, RecommendationUpdate,
    InfluencerWithStats
)
from app.services.market_data import market_data_service

router = APIRouter()

@router.get("/influencers", response_model=List[InfluencerWithStats])
def get_influencers(db=Depends(get_db)):
    """List all influencers with basic stats"""
    influencers = db.execute("SELECT * FROM influencers ORDER BY name").fetchall()
    
    results = []
    for inf in influencers:
        # Get count of recommendations
        count = db.execute(
            "SELECT COUNT(*) FROM influencer_recommendations WHERE influencer_id = ?", 
            [inf[0]]
        ).fetchone()[0]
        
        results.append({
            "id": inf[0],
            "name": inf[1],
            "platform": inf[2],
            "url": inf[3],
            "created_at": inf[4],
            "recommendation_count": count
        })
    return results

@router.post("/influencers", response_model=Influencer)
def create_influencer(influencer: InfluencerCreate, db=Depends(get_db)):
    """Create a new influencer"""
    inf_id = str(uuid.uuid4())
    now = datetime.now()
    
    db.execute(
        """
        INSERT INTO influencers (id, name, platform, url, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        [inf_id, influencer.name, influencer.platform, influencer.url, now]
    )
    # Commit is handled by DuckDB automatically usually for single statements or we rely on session
    # but with the current session.py, we might need to check if commit is needed.
    # Looking at other files, it seems direct execution works.
    
    return {
        "id": inf_id,
        "name": influencer.name,
        "platform": influencer.platform,
        "url": influencer.url,
        "created_at": now
    }

@router.post("/influencers/{influencer_id}/recommendations", response_model=Recommendation)
def create_recommendation(
    influencer_id: str, 
    recommendation: RecommendationCreate, 
    db=Depends(get_db)
):
    """Add a recommendation for an influencer"""
    return create_recommendations_batch(influencer_id, [recommendation], db)[0]

@router.post("/influencers/{influencer_id}/recommendations/batch", response_model=List[Recommendation])
def create_recommendations_batch(
    influencer_id: str, 
    recommendations: List[RecommendationCreate], 
    db=Depends(get_db)
):
    """Batch add recommendations for an influencer"""
    # Verify influencer exists
    inf = db.execute("SELECT id FROM influencers WHERE id = ?", [influencer_id]).fetchone()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    results = []
    now = datetime.now()
    
    for rec in recommendations:
        initial_price = rec.initial_price
        
        # Auto-fetch if missing
        if initial_price is None or initial_price == 0:
            try:
                # Search window: Date - 4 days to Date + 4 days to find nearest
                # But typically we look for the exact date, or if weekend, the previous Friday or next Monday.
                # User request: "If holiday, use nearest trading day".
                # We fetch a range around the date.
                rec_date = rec.recommendation_date
                start_date = (rec_date - timedelta(days=5)).strftime("%Y-%m-%d")
                end_date = (rec_date + timedelta(days=5)).strftime("%Y-%m-%d")
                
                hist_data = market_data_service.get_historical_prices(
                    rec.symbol, start_date, end_date
                )
                
                if hist_data and hist_data.get("prices"):
                    prices = hist_data["prices"]
                    print(f"Found {len(prices)} historical prices for {rec.symbol}")
                    # Sort by distance to rec_date
                    # Convert price dates to datetime objects for comparison
                    target_ts = datetime.combine(rec_date, datetime.min.time()).timestamp()
                    
                    best_match = None
                    min_diff = float('inf')
                    
                    for p in prices:
                        p_date = datetime.strptime(p['date'], "%Y-%m-%d")
                        diff = abs(p_date.timestamp() - target_ts)
                        if diff < min_diff:
                            min_diff = diff
                            best_match = p
                    
                    if best_match:
                        initial_price = float(best_match["close"])
                        print(f"Best match for {rec.symbol} is {best_match['date']} at {initial_price}")
                    else:
                        print(f"No best match found for {rec.symbol}")
                else:
                    print(f"No historical prices returned for {rec.symbol}")
            except Exception as e:
                print(f"Failed to fetch initial price for {rec.symbol}: {e}")
            
            # Fallback: If still None and date is recent (within last 3 days or future), try current price
            if initial_price is None:
                try:
                    # check if rec_date is recent
                    diff = (now.date() - rec.recommendation_date).days
                    if diff <= 3: 
                        # Try Current Price
                        quotes = market_data_service.get_quotes([rec.symbol])
                        if quotes and quotes[0].get("regularMarketPrice"):
                             initial_price = quotes[0]["regularMarketPrice"]
                             print(f"Fetched live price as fallback for {rec.symbol}: {initial_price}")
                except Exception as e:
                    print(f"Failed to fetch live fallback for {rec.symbol}: {e}")
        
        rec_id = str(uuid.uuid4())
        
        db.execute(
            """
            INSERT INTO influencer_recommendations 
            (id, influencer_id, symbol, recommendation_date, initial_price, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                rec_id, influencer_id, rec.symbol, 
                rec.recommendation_date, initial_price, 
                rec.note, now
            ]
        )
        
        results.append({
            "id": rec_id,
            "influencer_id": influencer_id,
            "symbol": rec.symbol,
            "recommendation_date": rec.recommendation_date,
            "initial_price": initial_price,
            "note": rec.note,
            "created_at": now
        })
        
    return results

@router.get("/recommendations", response_model=List[Recommendation])
def get_all_recommendations(db=Depends(get_db)):
    """Get all recommendations with live performance metrics"""
    recs = db.execute("""
        SELECT id, influencer_id, symbol, recommendation_date, initial_price, note, created_at 
        FROM influencer_recommendations 
        ORDER BY recommendation_date DESC
    """).fetchall()
    
    if not recs:
        return []
    
    # Collect symbols for batch fetching
    symbols = list(set([r[2] for r in recs]))
    
    # Fetch live prices
    quotes = market_data_service.get_quotes(symbols)
    price_map = {q['symbol']: q['regularMarketPrice'] for q in quotes}
    
    results = []
    for r in recs:
        sym = r[2]
        initial = r[4]
        current = price_map.get(sym)
        
        change_pct = None
        if initial and current and initial > 0:
            change_pct = (current - initial) / initial
            
        results.append({
            "id": r[0],
            "influencer_id": r[1],
            "symbol": sym,
            "recommendation_date": r[3],
            "initial_price": initial,
            "note": r[5],
            "created_at": r[6],
            "current_price": current,
            "price_change_percent": change_pct
        })
        
    return results

@router.put("/influencers/{influencer_id}", response_model=Influencer)
def update_influencer(
    influencer_id: str,
    influencer_update: InfluencerUpdate,
    db=Depends(get_db)
):
    """Update an existing influencer"""
    current = db.execute("SELECT * FROM influencers WHERE id = ?", [influencer_id]).fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    # Build update query dynamically
    updates = []
    values = []
    if influencer_update.name is not None:
        updates.append("name = ?")
        values.append(influencer_update.name)
    if influencer_update.platform is not None:
        updates.append("platform = ?")
        values.append(influencer_update.platform)
    if influencer_update.url is not None:
        updates.append("url = ?")
        values.append(influencer_update.url)
        
    if not updates:
        # No updates provided, return current
        return {
            "id": current[0],
            "name": current[1],
            "platform": current[2],
            "url": current[3],
            "created_at": current[4]
        }
        
    values.append(influencer_id)
    query = f"UPDATE influencers SET {', '.join(updates)} WHERE id = ?"
    db.execute(query, values)
    
    # Fetch updated
    updated = db.execute("SELECT * FROM influencers WHERE id = ?", [influencer_id]).fetchone()
    return {
        "id": updated[0],
        "name": updated[1],
        "platform": updated[2],
        "url": updated[3],
        "created_at": updated[4]
    }

@router.put("/recommendations/{recommendation_id}", response_model=Recommendation)
def update_recommendation(
    recommendation_id: str,
    recommendation_update: RecommendationUpdate,
    db=Depends(get_db)
):
    """Update an existing recommendation"""
    current = db.execute("SELECT * FROM influencer_recommendations WHERE id = ?", [recommendation_id]).fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    updates = []
    values = []
    
    if recommendation_update.symbol is not None:
        updates.append("symbol = ?")
        values.append(recommendation_update.symbol)
    if recommendation_update.recommendation_date is not None:
        updates.append("recommendation_date = ?")
        values.append(recommendation_update.recommendation_date)
    if recommendation_update.initial_price is not None:
        updates.append("initial_price = ?")
        values.append(recommendation_update.initial_price)
    if recommendation_update.note is not None:
        updates.append("note = ?")
        values.append(recommendation_update.note)
        
    if not updates:
        # Return current state (need to map fields correctly matching Recommendation model)
        return {
            "id": current[0],
            "influencer_id": current[1],
            "symbol": current[2],
            "recommendation_date": current[3],
            "initial_price": current[4],
            "note": current[5],
            "created_at": current[6]
        }
        
    values.append(recommendation_id)
    query = f"UPDATE influencer_recommendations SET {', '.join(updates)} WHERE id = ?"
    db.execute(query, values)
    
    updated = db.execute("SELECT * FROM influencer_recommendations WHERE id = ?", [recommendation_id]).fetchone()
    
    # Calculate current price / change if needed, similar to get_all_recommendations
    # For simplicity, we just return the stored data + basic stats if available or just basic data
    # The frontend usually refreshes the list anyway.
    
    # Try to fetch current price for completion
    current_price = None
    change_pct = None
    try:
        quotes = market_data_service.get_quotes([updated[2]])
        if quotes and quotes[0].get("regularMarketPrice"):
            current_price = quotes[0]["regularMarketPrice"]
            if updated[4] and updated[4] > 0:
                change_pct = (current_price - updated[4]) / updated[4]
    except:
        pass

    return {
        "id": updated[0],
        "influencer_id": updated[1],
        "symbol": updated[2],
        "recommendation_date": updated[3],
        "initial_price": updated[4],
        "note": updated[5],
        "created_at": updated[6],
        "current_price": current_price,
        "price_change_percent": change_pct
    }

@router.delete("/influencers/{influencer_id}")
def delete_influencer(influencer_id: str, db=Depends(get_db)):
    """Delete an influencer and their recommendations"""
    # Delete recommendations first
    db.execute("DELETE FROM influencer_recommendations WHERE influencer_id = ?", [influencer_id])
    
    # Delete influencer
    res = db.execute("DELETE FROM influencers WHERE id = ?", [influencer_id])
    # check if deleted? DuckDB python api result might not show affected rows easily without cursor.rowcount
    
    return {"status": "success"}

@router.delete("/recommendations/{recommendation_id}")
def delete_recommendation(recommendation_id: str, db=Depends(get_db)):
    db.execute("DELETE FROM influencer_recommendations WHERE id = ?", [recommendation_id])
    return {"status": "success"}
