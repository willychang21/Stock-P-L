from app.db.session import db
import json

conn = db.get_connection()
rows = conn.execute("SELECT symbol, price, trailing_pe, roe, roic, revenue_growth, updated_at FROM screener_data ORDER BY market_cap DESC LIMIT 10").fetchall()
cols = [desc[0] for desc in conn.description]

results = []
for row in rows:
    results.append(dict(zip(cols, row)))

print(json.dumps(results, indent=2, default=str))
