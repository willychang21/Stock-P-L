from app.db.session import db
import json

conn = db.get_connection()
res = conn.execute("SELECT symbol, target_upside, recommendation_mean, short_percent FROM screener_data WHERE target_upside IS NOT NULL LIMIT 5").fetchall()
print(res)
