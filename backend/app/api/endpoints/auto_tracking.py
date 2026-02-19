"""
Auto-Tracking API Endpoints
Endpoints for triggering auto-tracking and managing pending reviews.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
from app.db.session import get_db
from app.services.auto_tracker import auto_tracker
from app.schemas.influencer import PendingReview, SignalType, TimeframeType, SourceType

router = APIRouter()


class TrackInfluencerRequest(BaseModel):
    """Request to trigger auto-tracking for an influencer."""
    influencer_id: str
    platform: str = "threads"
    limit: int = 5


class TrackingResult(BaseModel):
    """Result of auto-tracking operation."""
    influencer_id: str
    posts_scraped: int
    posts_analyzed: int
    posts_skipped_duplicate: int = 0
    posts_skipped_irrelevant: int = 0
    recommendations_found: int
    pending_review_ids: List[str]
    errors: List[str] = []


class ApproveReviewRequest(BaseModel):
    """Request to approve a pending review and create recommendation."""
    symbol: Optional[str] = None
    signal: Optional[SignalType] = None
    timeframe: Optional[TimeframeType] = None
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    note: Optional[str] = None


@router.post("/auto-track", response_model=TrackingResult)
async def trigger_auto_track(request: TrackInfluencerRequest, db=Depends(get_db)):
    """
    Trigger auto-tracking for an influencer.
    Scrapes their social media, analyzes with AI, and creates pending reviews.
    """
    # Verify influencer exists and get their URL
    inf = db.execute(
        "SELECT id, name, platform, url FROM influencers WHERE id = ?", 
        [request.influencer_id]
    ).fetchone()
    
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    # Use stored platform/URL if not specified
    platform = request.platform or inf[2] or "threads"
    url = inf[3]  # Influencer's URL
    
    if not url:
        raise HTTPException(status_code=400, detail="Influencer has no URL configured")
    
    # Run auto-tracking
    result = await auto_tracker.track_influencer(
        influencer_id=request.influencer_id,
        platform=platform,
        url=url,
        limit=request.limit
    )
    
    return TrackingResult(**result)


@router.get("/pending-reviews", response_model=List[PendingReview])
def get_pending_reviews(
    influencer_id: Optional[str] = None,
    status: str = "PENDING",
    db=Depends(get_db)
):
    """Get all pending reviews waiting for user approval."""
    query = """
        SELECT pr.id, pr.influencer_id, i.name as influencer_name,
               pr.source, pr.source_url, pr.original_content,
               pr.ai_analysis, pr.suggested_symbol, pr.suggested_signal,
               pr.suggested_timeframe, pr.confidence, pr.created_at
        FROM pending_reviews pr
        JOIN influencers i ON pr.influencer_id = i.id
        WHERE pr.status = ?
    """
    params = [status]
    
    if influencer_id:
        query += " AND pr.influencer_id = ?"
        params.append(influencer_id)
    
    query += " ORDER BY pr.created_at DESC"
    
    rows = db.execute(query, params).fetchall()
    
    import json
    results = []
    for r in rows:
        # Parse ai_analysis JSON
        ai_analysis = {}
        try:
            if r[6]:
                ai_analysis = json.loads(r[6])
        except:
            pass
            
        results.append({
            "id": r[0],
            "influencer_id": r[1],
            "influencer_name": r[2],
            "source": r[3],
            "source_url": r[4],
            "original_content": r[5],
            "ai_analysis": ai_analysis,
            "suggested_symbol": r[7],
            "suggested_signal": r[8],
            "suggested_timeframe": r[9],
            "confidence": r[10],
            "created_at": r[11]
        })
    
    return results


@router.post("/pending-reviews/{review_id}/approve")
async def approve_pending_review(
    review_id: str,
    request: ApproveReviewRequest,
    db=Depends(get_db)
):
    """Approve a pending review and create a recommendation."""
    # Get the pending review
    review = db.execute(
        "SELECT * FROM pending_reviews WHERE id = ? AND status = 'PENDING'",
        [review_id]
    ).fetchone()
    
    if not review:
        raise HTTPException(status_code=404, detail="Pending review not found or already processed")
    
    # Create recommendation from the approved review
    from app.api.endpoints.influencers import calculate_expiry_date
    from datetime import date
    
    rec_id = str(uuid.uuid4())
    now = datetime.now()
    rec_date = now.date()
    
    # Use provided values or fall back to suggested values
    symbol = request.symbol or review[7]  # suggested_symbol
    signal = (request.signal.value if request.signal else review[8]) or "BUY"
    timeframe = (request.timeframe.value if request.timeframe else review[9]) or "MID"
    
    # Calculate expiry
    from app.schemas.influencer import TimeframeType as TF
    tf_enum = TF(timeframe)
    expiry = calculate_expiry_date(rec_date, tf_enum)
    
    # Insert recommendation
    db.execute(
        """
        INSERT INTO influencer_recommendations 
        (id, influencer_id, symbol, signal, timeframe, recommendation_date,
         entry_price, target_price, stop_loss, expiry_date, source, source_url, 
         note, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        """,
        [
            rec_id,
            review[1],  # influencer_id
            symbol,
            signal,
            timeframe,
            rec_date,
            request.entry_price,
            request.target_price,
            request.stop_loss,
            expiry,
            review[3],  # source (AUTO_THREADS etc)
            review[4],  # source_url
            request.note or review[5][:200],  # note or truncated content
            now
        ]
    )
    
    # Mark review as approved
    db.execute(
        "UPDATE pending_reviews SET status = 'APPROVED', reviewed_at = ? WHERE id = ?",
        [now, review_id]
    )
    
    return {"status": "approved", "recommendation_id": rec_id}


@router.post("/pending-reviews/{review_id}/reject")
def reject_pending_review(review_id: str, db=Depends(get_db)):
    """Reject and dismiss a pending review."""
    result = db.execute(
        "UPDATE pending_reviews SET status = 'REJECTED', reviewed_at = ? WHERE id = ? AND status = 'PENDING'",
        [datetime.now(), review_id]
    )
    
    return {"status": "rejected"}


@router.delete("/pending-reviews/{review_id}")
def delete_pending_review(review_id: str, db=Depends(get_db)):
    """Delete a pending review."""
    db.execute("DELETE FROM pending_reviews WHERE id = ?", [review_id])
    return {"status": "deleted"}
