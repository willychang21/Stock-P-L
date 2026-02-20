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
               pr.suggested_timeframe, pr.confidence, pr.created_at, pr.post_date
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
            "created_at": r[11],
            "post_date": r[12]
        })
    
    return results


# ═══════════════════════════════════════════
# Scraped Posts History (for classification review)
# ═══════════════════════════════════════════

@router.get("/scraped-posts")
def get_scraped_posts(
    influencer_id: Optional[str] = None,
    db=Depends(get_db)
):
    """Get all scraped posts history — shows what was analyzed and what was skipped."""
    query = """
        SELECT sp.id, sp.influencer_id, i.name as influencer_name,
               sp.source, sp.source_url, sp.original_content,
               sp.is_investment_related, sp.post_type, sp.analyzed_at, sp.content_hash
        FROM scraped_posts sp
        JOIN influencers i ON sp.influencer_id = i.id
    """
    params = []
    
    if influencer_id:
        query += " WHERE sp.influencer_id = ?"
        params.append(influencer_id)
    
    query += " ORDER BY sp.analyzed_at DESC"
    
    rows = db.execute(query, params).fetchall()
    
    results = []
    for r in rows:
        results.append({
            "id": r[0],
            "influencer_id": r[1],
            "influencer_name": r[2],
            "source": r[3],
            "source_url": r[4],
            "original_content": r[5],
            "is_investment_related": r[6],
            "post_type": r[7],
            "analyzed_at": str(r[8]) if r[8] else None,
            "content_hash": r[9],
        })
    
    return results


@router.delete("/scraped-posts/{post_id}")
def delete_scraped_post(post_id: str, db=Depends(get_db)):
    """Delete a single scraped post record."""
    result = db.execute("DELETE FROM scraped_posts WHERE id = ?", [post_id])
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"deleted": 1}


class BulkDeleteRequest(BaseModel):
    ids: List[str]


@router.post("/scraped-posts/bulk-delete")
def bulk_delete_scraped_posts(request: BulkDeleteRequest, db=Depends(get_db)):
    """Delete multiple scraped post records at once."""
    if not request.ids:
        return {"deleted": 0}
    placeholders = ",".join(["?" for _ in request.ids])
    result = db.execute(f"DELETE FROM scraped_posts WHERE id IN ({placeholders})", request.ids)
    return {"deleted": result.rowcount}


# ═══════════════════════════════════════════
# Batch Pending-Review Endpoints (MUST come before {review_id} routes)
# ═══════════════════════════════════════════

class ApproveAllResult(BaseModel):
    approved: int
    errors: List[str] = []


@router.post("/pending-reviews/approve-all", response_model=ApproveAllResult)
def approve_all_pending(db=Depends(get_db)):
    """Approve ALL pending reviews at once using their suggested values."""
    reviews = db.execute(
        """
        SELECT id, influencer_id, source, source_url, original_content, 
               ai_analysis, suggested_symbol, suggested_signal, suggested_timeframe,
               confidence, status, created_at, content_hash, post_date
        FROM pending_reviews 
        WHERE status = 'PENDING' ORDER BY created_at
        """
    ).fetchall()
    
    column_names = ["id", "influencer_id", "source", "source_url", "original_content", "ai_analysis", 
                    "suggested_symbol", "suggested_signal", "suggested_timeframe", "confidence", 
                    "status", "created_at", "content_hash", "post_date"]
    
    approved = 0
    errors = []
    for r_tuple in reviews:
        review = dict(zip(column_names, r_tuple))
        try:
            _approve_review(db, review, ApproveReviewRequest())
            approved += 1
        except Exception as e:
            errors.append(f"{review.get('suggested_symbol') or 'unknown'}: {str(e)}")
    
    return ApproveAllResult(approved=approved, errors=errors)


class AutoApproveRequest(BaseModel):
    threshold: float = 0.7  # Minimum confidence to auto-approve


class AutoApproveResult(BaseModel):
    approved: int
    skipped: int
    errors: List[str] = []


@router.post("/pending-reviews/auto-approve", response_model=AutoApproveResult)
def auto_approve_pending(request: AutoApproveRequest, db=Depends(get_db)):
    """Auto-approve pending reviews with confidence >= threshold."""
    approved = _auto_approve_pending(db, request.threshold)
    
    remaining = db.execute(
        "SELECT COUNT(*) FROM pending_reviews WHERE status = 'PENDING'"
    ).fetchone()[0]
    
    return AutoApproveResult(approved=approved, skipped=remaining)


# ═══════════════════════════════════════════
# Per-Review Endpoints (parameterized {review_id})
# ═══════════════════════════════════════════

@router.post("/pending-reviews/{review_id}/approve")
async def approve_pending_review(
    review_id: str,
    request: ApproveReviewRequest,
    db=Depends(get_db)
):
    """Approve a pending review and create a recommendation."""
    review_tuple = db.execute(
        """
        SELECT id, influencer_id, source, source_url, original_content, 
               ai_analysis, suggested_symbol, suggested_signal, suggested_timeframe,
               confidence, status, created_at, content_hash, post_date
        FROM pending_reviews 
        WHERE id = ? AND status = 'PENDING'
        """,
        [review_id]
    ).fetchone()
    
    if not review_tuple:
        raise HTTPException(status_code=404, detail="Pending review not found or already processed")
        
    column_names = ["id", "influencer_id", "source", "source_url", "original_content", "ai_analysis", 
                    "suggested_symbol", "suggested_signal", "suggested_timeframe", "confidence", 
                    "status", "created_at", "content_hash", "post_date"]
    review = dict(zip(column_names, review_tuple))
    
    rec_id = _approve_review(db, review, request)
    return {"status": "approved", "recommendation_id": rec_id}


@router.post("/pending-reviews/{review_id}/reject")
def reject_pending_review(review_id: str, db=Depends(get_db)):
    """Reject and dismiss a pending review."""
    db.execute(
        "UPDATE pending_reviews SET status = 'REJECTED', reviewed_at = ? WHERE id = ? AND status = 'PENDING'",
        [datetime.now(), review_id]
    )
    return {"status": "rejected"}


@router.delete("/pending-reviews/{review_id}")
def delete_pending_review(review_id: str, db=Depends(get_db)):
    """Delete a pending review."""
    db.execute("DELETE FROM pending_reviews WHERE id = ?", [review_id])
    return {"status": "deleted"}


# ═══════════════════════════════════════════
# Track-All Endpoint
# ═══════════════════════════════════════════

class TrackAllRequest(BaseModel):
    """Request to track all influencers at once."""
    limit: int = 5
    auto_approve_threshold: Optional[float] = None


class TrackAllResult(BaseModel):
    """Aggregated result from tracking all influencers."""
    total_influencers: int
    total_posts_scraped: int
    total_posts_analyzed: int
    total_recommendations: int
    auto_approved: int
    errors: List[str]
    per_influencer: List[TrackingResult]


@router.post("/auto-track-all", response_model=TrackAllResult)
async def trigger_auto_track_all(request: TrackAllRequest, db=Depends(get_db)):
    """
    Batch auto-track ALL influencers with URLs.
    Optionally auto-approve high-confidence results.
    """
    influencers = db.execute(
        "SELECT id, name, platform, url FROM influencers WHERE url IS NOT NULL AND url != ''"
    ).fetchall()
    
    result = TrackAllResult(
        total_influencers=len(influencers),
        total_posts_scraped=0,
        total_posts_analyzed=0,
        total_recommendations=0,
        auto_approved=0,
        errors=[],
        per_influencer=[]
    )
    
    for inf in influencers:
        inf_id, name, platform, url = inf[0], inf[1], inf[2] or "threads", inf[3]
        try:
            tracking = await auto_tracker.track_influencer(
                influencer_id=inf_id,
                platform=platform,
                url=url,
                limit=request.limit
            )
            tr = TrackingResult(**tracking)
            result.per_influencer.append(tr)
            result.total_posts_scraped += tr.posts_scraped
            result.total_posts_analyzed += tr.posts_analyzed
            result.total_recommendations += tr.recommendations_found
        except Exception as e:
            result.errors.append(f"{name}: {str(e)}")
    
    # Auto-approve if threshold is set
    if request.auto_approve_threshold is not None:
        auto_count = _auto_approve_pending(db, request.auto_approve_threshold)
        result.auto_approved = auto_count
    
    return result


# ═══════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════

def _approve_review(db, review: dict, request: ApproveReviewRequest) -> str:
    """
    Core approval logic: creates a recommendation from a pending review.
    Returns the new recommendation ID.
    """
    from app.api.endpoints.influencers import calculate_expiry_date
    from app.schemas.influencer import TimeframeType as TF
    from app.services.market_data import market_data_service
    from datetime import timedelta
    
    rec_id = str(uuid.uuid4())
    now = datetime.now()
    
    # Use post_date if available, else today
    post_date_str = review.get("post_date")
    if post_date_str:
        if isinstance(post_date_str, str):
            rec_date = datetime.strptime(post_date_str, "%Y-%m-%d").date()
        else:
            rec_date = post_date_str
    else:
        rec_date = now.date()
    
    symbol = request.symbol or review.get("suggested_symbol")
    signal = (request.signal.value if request.signal else review.get("suggested_signal")) or "BUY"
    timeframe = (request.timeframe.value if request.timeframe else review.get("suggested_timeframe")) or "MID"
    
    tf_enum = TF(timeframe)
    expiry = calculate_expiry_date(rec_date, tf_enum)
    
    entry_price = request.entry_price
    
    # Auto-fetch entry price based on post_date if missing
    if entry_price is None and symbol:
        try:
            start_date = (rec_date - timedelta(days=5)).strftime("%Y-%m-%d")
            end_date = (rec_date + timedelta(days=5)).strftime("%Y-%m-%d")
            
            hist_data = market_data_service.get_historical_prices(symbol, start_date, end_date)
            if hist_data and hist_data.get("prices"):
                prices = hist_data["prices"]
                
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
                    entry_price = float(best_match["close"])
            
            # Fallback to live price if still None AND post_date is within last 3 days
            if entry_price is None:
                diff_days = (now.date() - rec_date).days
                if diff_days <= 3:
                    quotes = market_data_service.get_quotes([symbol])
                    if quotes and quotes[0].get("regularMarketPrice"):
                        entry_price = quotes[0]["regularMarketPrice"]
        except Exception as e:
            print(f"[_approve_review] Failed to auto-fetch entry price: {e}")
    
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
            review.get("influencer_id"),
            symbol,
            signal,
            timeframe,
            rec_date,
            entry_price,
            request.target_price,
            request.stop_loss,
            expiry,
            review.get("source"),
            review.get("source_url"),
            request.note or (review.get("original_content", "")[:200]),
            now
        ]
    )
    
    db.execute(
        "UPDATE pending_reviews SET status = 'APPROVED', reviewed_at = ? WHERE id = ?",
        [now, review.get("id")]
    )
    
    return rec_id


def _auto_approve_pending(db, threshold: float) -> int:
    """Auto-approve all pending reviews with confidence >= threshold. Returns count approved."""
    reviews = db.execute(
        """
        SELECT id, influencer_id, source, source_url, original_content, 
               ai_analysis, suggested_symbol, suggested_signal, suggested_timeframe,
               confidence, status, created_at, content_hash, post_date
        FROM pending_reviews 
        WHERE status = 'PENDING' AND confidence >= ?
        """,
        [threshold]
    ).fetchall()
    
    column_names = ["id", "influencer_id", "source", "source_url", "original_content", "ai_analysis", 
                    "suggested_symbol", "suggested_signal", "suggested_timeframe", "confidence", 
                    "status", "created_at", "content_hash", "post_date"]
    
    approved = 0
    for r_tuple in reviews:
        review = dict(zip(column_names, r_tuple))
        try:
            _approve_review(db, review, ApproveReviewRequest())
            approved += 1
        except Exception as e:
            print(f"[AutoApprove] Failed for {review.get('suggested_symbol')}: {e}")
    
    return approved

