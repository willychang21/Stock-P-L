from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.db.session import db
from app.schemas.screener_preferences import (
    ScreenerAlertEvent,
    ScreenerScreen,
    ScreenerScreenCreate,
    ScreenerScreenUpdate,
    ScreenerView,
    ScreenerViewCreate,
)
from app.services.screener_service import ScreenerService


class ScreenerPreferencesService:
    _ALLOWED_FILTER_KEYS = {
        "min_mkt_cap", "max_mkt_cap", "min_pe", "max_pe", "min_ps", "max_ps",
        "min_pb", "max_pb", "min_peg", "max_peg", "min_roe", "max_roe",
        "min_roic", "max_roic", "min_profit_margin", "max_profit_margin",
        "min_revenue_growth", "max_revenue_growth", "min_eps_growth", "max_eps_growth",
        "min_fcf", "max_fcf", "min_target_upside", "max_target_upside",
        "min_recommendation_mean", "max_recommendation_mean", "min_short_percent", "max_short_percent",
        "min_inst_own", "max_inst_own", "min_insider_own", "max_insider_own",
        "min_beta", "max_beta", "min_gross_margin", "max_gross_margin",
        "min_ebitda_margin", "max_ebitda_margin", "has_options", "sector",
        "only_holdings", "sort_by", "sort_order", "limit", "offset",
    }

    @classmethod
    def _sanitize_filters(cls, filters: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(filters, dict):
            return {}
        sanitized = {k: v for k, v in filters.items() if k in cls._ALLOWED_FILTER_KEYS}
        # prevent stored screens from exploding payload sizes
        sanitized.setdefault("limit", 200)
        sanitized.setdefault("offset", 0)
        return sanitized

    @staticmethod
    def _json_loads(value: Optional[str], fallback: Any):
        if not value:
            return fallback
        try:
            return json.loads(value)
        except Exception:
            return fallback

    @staticmethod
    def _json_dumps(value: Any) -> str:
        return json.dumps(value, ensure_ascii=True)

    @classmethod
    def list_views(cls) -> List[ScreenerView]:
        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, name, visibility_model, filters, created_at, updated_at
                FROM screener_views
                ORDER BY updated_at DESC
                """
            ).fetchall()
            result: List[ScreenerView] = []
            for row in rows:
                result.append(
                    ScreenerView(
                        id=row[0],
                        name=row[1],
                        visibility_model=cls._json_loads(row[2], {}),
                        filters=cls._json_loads(row[3], {}),
                        created_at=row[4],
                        updated_at=row[5],
                    )
                )
            return result
        finally:
            conn.close()

    @classmethod
    def create_view(cls, payload: ScreenerViewCreate) -> ScreenerView:
        conn = db.get_connection()
        try:
            now = datetime.now()
            view_id = str(uuid.uuid4())
            filters = cls._sanitize_filters(payload.filters)
            conn.execute(
                """
                INSERT INTO screener_views (id, name, visibility_model, filters, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    view_id,
                    payload.name.strip(),
                    cls._json_dumps(payload.visibility_model),
                    cls._json_dumps(filters),
                    now,
                    now,
                ],
            )
            return ScreenerView(
                id=view_id,
                name=payload.name.strip(),
                visibility_model=payload.visibility_model,
                filters=filters,
                created_at=now,
                updated_at=now,
            )
        finally:
            conn.close()

    @classmethod
    def delete_view(cls, view_id: str) -> None:
        conn = db.get_connection()
        try:
            conn.execute("DELETE FROM screener_views WHERE id = ?", [view_id])
        finally:
            conn.close()

    @classmethod
    def list_screens(cls) -> List[ScreenerScreen]:
        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, name, filters, alerts_enabled, email, last_matched_symbols, created_at, updated_at
                FROM screener_screens
                ORDER BY updated_at DESC
                """
            ).fetchall()
            result: List[ScreenerScreen] = []
            for row in rows:
                result.append(
                    ScreenerScreen(
                        id=row[0],
                        name=row[1],
                        filters=cls._json_loads(row[2], {}),
                        alerts_enabled=bool(row[3]),
                        email=row[4],
                        last_matched_symbols=cls._json_loads(row[5], []),
                        created_at=row[6],
                        updated_at=row[7],
                    )
                )
            return result
        finally:
            conn.close()

    @classmethod
    def create_screen(cls, payload: ScreenerScreenCreate) -> ScreenerScreen:
        conn = db.get_connection()
        try:
            now = datetime.now()
            screen_id = str(uuid.uuid4())
            filters = cls._sanitize_filters(payload.filters)
            conn.execute(
                """
                INSERT INTO screener_screens (
                    id, name, filters, alerts_enabled, email, last_matched_symbols, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    screen_id,
                    payload.name.strip(),
                    cls._json_dumps(filters),
                    payload.alerts_enabled,
                    payload.email,
                    cls._json_dumps([]),
                    now,
                    now,
                ],
            )
            return ScreenerScreen(
                id=screen_id,
                name=payload.name.strip(),
                filters=filters,
                alerts_enabled=payload.alerts_enabled,
                email=payload.email,
                last_matched_symbols=[],
                created_at=now,
                updated_at=now,
            )
        finally:
            conn.close()

    @classmethod
    def update_screen(cls, screen_id: str, payload: ScreenerScreenUpdate) -> Optional[ScreenerScreen]:
        conn = db.get_connection()
        try:
            row = conn.execute(
                """
                SELECT id, name, filters, alerts_enabled, email, last_matched_symbols, created_at, updated_at
                FROM screener_screens WHERE id = ?
                """,
                [screen_id],
            ).fetchone()
            if not row:
                return None

            current = {
                "name": row[1],
                "filters": cls._json_loads(row[2], {}),
                "alerts_enabled": bool(row[3]),
                "email": row[4],
                "last_matched_symbols": cls._json_loads(row[5], []),
                "created_at": row[6],
            }

            next_name = payload.name.strip() if payload.name is not None else current["name"]
            next_filters = cls._sanitize_filters(payload.filters) if payload.filters is not None else current["filters"]
            next_alerts_enabled = payload.alerts_enabled if payload.alerts_enabled is not None else current["alerts_enabled"]
            next_email = payload.email if payload.email is not None else current["email"]
            now = datetime.now()

            conn.execute(
                """
                UPDATE screener_screens
                SET name = ?, filters = ?, alerts_enabled = ?, email = ?, updated_at = ?
                WHERE id = ?
                """,
                [
                    next_name,
                    cls._json_dumps(next_filters),
                    next_alerts_enabled,
                    next_email,
                    now,
                    screen_id,
                ],
            )

            return ScreenerScreen(
                id=screen_id,
                name=next_name,
                filters=next_filters,
                alerts_enabled=bool(next_alerts_enabled),
                email=next_email,
                last_matched_symbols=current["last_matched_symbols"],
                created_at=current["created_at"],
                updated_at=now,
            )
        finally:
            conn.close()

    @classmethod
    def delete_screen(cls, screen_id: str) -> None:
        conn = db.get_connection()
        try:
            conn.execute("DELETE FROM screener_screens WHERE id = ?", [screen_id])
        finally:
            conn.close()

    @classmethod
    def _create_alert_event(
        cls,
        conn,
        screen_id: str,
        screen_name: str,
        new_symbols: List[str],
        email: Optional[str],
    ) -> ScreenerAlertEvent:
        event_id = str(uuid.uuid4())
        now = datetime.now()
        conn.execute(
            """
            INSERT INTO screener_alert_events (id, screen_id, screen_name, new_symbols, email, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                event_id,
                screen_id,
                screen_name,
                cls._json_dumps(new_symbols),
                email,
                False,
                now,
            ],
        )
        return ScreenerAlertEvent(
            id=event_id,
            screen_id=screen_id,
            screen_name=screen_name,
            new_symbols=new_symbols,
            email=email,
            is_read=False,
            created_at=now,
        )

    @classmethod
    def check_alerts(cls) -> List[ScreenerAlertEvent]:
        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, name, filters, alerts_enabled, email, last_matched_symbols
                FROM screener_screens
                WHERE alerts_enabled = TRUE
                """
            ).fetchall()

            created_events: List[ScreenerAlertEvent] = []
            for row in rows:
                screen_id, name, filters_json, _, email, last_symbols_json = row
                filters = cls._json_loads(filters_json, {})
                filters = cls._sanitize_filters(filters)
                filters["limit"] = min(int(filters.get("limit", 200)), 300)
                filters["offset"] = 0

                result = ScreenerService.get_screener_stocks(**filters)
                matched_symbols = [item.symbol for item in result.get("items", [])]
                previous_symbols = set(cls._json_loads(last_symbols_json, []))
                new_symbols = [s for s in matched_symbols if s not in previous_symbols]

                if new_symbols:
                    event = cls._create_alert_event(
                        conn=conn,
                        screen_id=screen_id,
                        screen_name=name,
                        new_symbols=new_symbols[:20],
                        email=email,
                    )
                    created_events.append(event)

                conn.execute(
                    """
                    UPDATE screener_screens
                    SET last_matched_symbols = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    [cls._json_dumps(matched_symbols), datetime.now(), screen_id],
                )

            return created_events
        finally:
            conn.close()

    @classmethod
    def list_alert_events(cls, limit: int = 50) -> List[ScreenerAlertEvent]:
        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, screen_id, screen_name, new_symbols, email, is_read, created_at
                FROM screener_alert_events
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [limit],
            ).fetchall()
            return [
                ScreenerAlertEvent(
                    id=row[0],
                    screen_id=row[1],
                    screen_name=row[2],
                    new_symbols=cls._json_loads(row[3], []),
                    email=row[4],
                    is_read=bool(row[5]),
                    created_at=row[6],
                )
                for row in rows
            ]
        finally:
            conn.close()

    @classmethod
    def mark_alert_read(cls, event_id: str) -> None:
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE screener_alert_events SET is_read = TRUE WHERE id = ?",
                [event_id],
            )
        finally:
            conn.close()
