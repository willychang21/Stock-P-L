import pytest
from fastapi.testclient import TestClient
from main import app
from app.db.session import db
from datetime import datetime

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """Ensure the screener_data table is clean before tests."""
    conn = db.get_connection()
    conn.execute("DELETE FROM screener_data")
    conn.execute("""
        INSERT INTO screener_data (
            symbol, name, market_cap, trailing_pe, roe, profit_margin, revenue_growth, has_options, price, updated_at
        )
        VALUES 
        ('AAPL', 'Apple Inc.', 3000000000000, 30.5, 1.5, 0.25, 0.05, TRUE, 180.0, ?),
        ('MSFT', 'Microsoft', 2500000000000, 35.2, 0.35, 0.35, 0.15, TRUE, 350.0, ?),
        ('GME', 'GameStop', 5000000000, 100.0, -0.1, -0.02, -0.1, TRUE, 15.0, ?),
        ('NADA', 'No Options Corp', 1000000000, 10.0, 0.05, 0.05, 0.02, FALSE, 10.0, ?)
    """, [datetime.now(), datetime.now(), datetime.now(), datetime.now()])
    conn.close()
    yield

def test_get_screener_no_filters():
    response = client.get("/api/screener")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4

def test_filter_roe():
    # High ROE (> 30%)
    response = client.get("/api/screener?min_roe=0.3")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    symbols = [item["symbol"] for item in data["items"]]
    assert "AAPL" in symbols
    assert "MSFT" in symbols

def test_filter_profit_margin():
    # Negative margins
    response = client.get("/api/screener?max_profit_margin=0")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["symbol"] == "GME"

def test_filter_revenue_growth():
    # Fast growers (> 10%)
    response = client.get("/api/screener?min_revenue_growth=0.1")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["symbol"] == "MSFT"
