from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from app.db.session import db
import uuid

class ResearchService:
    def get_notes(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = db.get_connection()
        try:
            if symbol:
                query = "SELECT * FROM research_notes WHERE symbol = ? ORDER BY updated_at DESC"
                params = [symbol]
            else:
                query = "SELECT * FROM research_notes ORDER BY updated_at DESC"
                params = []
            
            cursor = conn.execute(query, params)
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            notes = []
            for row in rows:
                note = dict(zip(cols, row))
                # Parse JSON fields
                if note.get('external_links'):
                    try:
                        note['external_links'] = json.loads(note['external_links'])
                    except:
                        note['external_links'] = []
                notes.append(note)
            return notes
        finally:
            conn.close()

    def save_note(self, note_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = db.get_connection()
        try:
            # Generate ID if new
            note_id = note_data.get('id')
            if not note_id:
                note_id = str(uuid.uuid4())
                is_new = True
            else:
                # Check if exists
                existing = conn.execute("SELECT 1 FROM research_notes WHERE id = ?", [note_id]).fetchone()
                is_new = existing is None

            current_time = datetime.now()
            
            # Prepare links as JSON string
            links_json = json.dumps(note_data.get('external_links', []))

            if is_new:
                query = """
                    INSERT INTO research_notes (
                        id, symbol, content, forward_pe, revenue_growth, 
                        target_price, sentiment, external_links, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                params = [
                    note_id,
                    note_data['symbol'],
                    note_data.get('content', ''),
                    note_data.get('forward_pe'),
                    note_data.get('revenue_growth'),
                    note_data.get('target_price'),
                    note_data.get('sentiment'),
                    links_json,
                    current_time
                ]
            else:
                query = """
                    UPDATE research_notes SET
                        symbol = ?,
                        content = ?,
                        forward_pe = ?,
                        revenue_growth = ?,
                        target_price = ?,
                        sentiment = ?,
                        external_links = ?,
                        updated_at = ?
                    WHERE id = ?
                """
                params = [
                    note_data['symbol'],
                    note_data.get('content', ''),
                    note_data.get('forward_pe'),
                    note_data.get('revenue_growth'),
                    note_data.get('target_price'),
                    note_data.get('sentiment'),
                    links_json,
                    current_time,
                    note_id
                ]

            conn.execute(query, params)
            
            # Return complete object
            return {
                **note_data,
                'id': note_id,
                'external_links': note_data.get('external_links', []),
                'updated_at': current_time.isoformat() if isinstance(current_time, datetime) else current_time
            }
        finally:
            conn.close()

    def delete_note(self, note_id: str) -> bool:
        conn = db.get_connection()
        try:
            conn.execute("DELETE FROM research_notes WHERE id = ?", [note_id])
            return True
        finally:
            conn.close()

research_service = ResearchService()
