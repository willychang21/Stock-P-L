
import pytest
from unittest.mock import MagicMock
from datetime import datetime, date
from app.schemas.influencer import InfluencerUpdate, RecommendationUpdate
from app.api.endpoints.influencers import update_influencer, update_recommendation
from fastapi import HTTPException

# Mock DB
class MockDB:
    def __init__(self):
        self._execute_return = None
        self._fetchone_return = None
        self.executed_queries = []
        self.executed_params = []

    def execute(self, query, params=None):
        self.executed_queries.append(query)
        self.executed_params.append(params)
        return self

    def fetchone(self):
        return self._fetchone_return

@pytest.fixture
def mock_db():
    return MockDB()

def test_update_influencer_success(mock_db):
    # Setup initial state
    inf_id = "inf-123"
    update_data = InfluencerUpdate(name="New Name", platform="YouTube")
    
    # Mock finding existing influencer
    # First call to fetchone is for "SELECT * FROM influencers WHERE id = ?" (check existence)
    # Second call is for "SELECT * FROM influencers WHERE id = ?" (return updated)
    # We can't easily valid sequence of returns with this simple mock class without iteration.
    # Let's use MagicMock for more control if needed, or simple separate queries check.
    
    # Better to use MagicMock for the db object passed to function
    db = MagicMock()
    
    # Mock return for check existence
    # Returns a tuple: (id, name, platform, url, created_at)
    original = ("inf-123", "Old Name", "Instagram", "http://old", datetime.now())
    updated_ret = ("inf-123", "New Name", "YouTube", "http://old", datetime.now())
    
    db.execute.return_value.fetchone.side_effect = [original, updated_ret]
    
    result = update_influencer(inf_id, update_data, db)
    
    assert result["name"] == "New Name"
    assert result["platform"] == "YouTube"
    
    # Verify update query was called
    # Check call args of execute
    calls = db.execute.call_args_list
    update_call = calls[1] # 0: select exist, 1: update, 2: select updated
    query, params = update_call[0]
    assert "UPDATE influencers SET" in query
    assert "name = ?" in query
    assert "platform = ?" in query
    assert "inf-123" in params

def test_update_influencer_not_found(mock_db):
    inf_id = "inf-999"
    update_data = InfluencerUpdate(name="New Name")
    
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = None
    
    with pytest.raises(HTTPException) as excinfo:
        update_influencer(inf_id, update_data, db)
    assert excinfo.value.status_code == 404

def test_update_recommendation_success(mock_db):
    rec_id = "rec-123"
    update_data = RecommendationUpdate(initial_price=150.0, note="Updated note")
    
    db = MagicMock()
    
    # Original: (id, inf_id, symbol, date, price, note, created_at)
    original = ("rec-123", "inf-1", "AAPL", date(2023, 1, 1), 100.0, "Old note", datetime.now())
    updated_rec = ("rec-123", "inf-1", "AAPL", date(2023, 1, 1), 150.0, "Updated note", datetime.now())
    
    db.execute.return_value.fetchone.side_effect = [original, updated_rec]
    
    result = update_recommendation(rec_id, update_data, db)
    
    assert result["initial_price"] == 150.0
    assert result["note"] == "Updated note"
    
    calls = db.execute.call_args_list
    update_call = calls[1]
    query, params = update_call[0]
    assert "UPDATE influencer_recommendations" in query
    assert "initial_price = ?" in query
    assert "note = ?" in query

