from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ScreenerViewCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    visibility_model: Dict[str, bool] = Field(default_factory=dict)
    filters: Dict[str, Any] = Field(default_factory=dict)


class ScreenerView(BaseModel):
    id: str
    name: str
    visibility_model: Dict[str, bool]
    filters: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ScreenerScreenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    filters: Dict[str, Any] = Field(default_factory=dict)
    alerts_enabled: bool = True
    email: Optional[str] = None


class ScreenerScreenUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    filters: Optional[Dict[str, Any]] = None
    alerts_enabled: Optional[bool] = None
    email: Optional[str] = None


class ScreenerScreen(BaseModel):
    id: str
    name: str
    filters: Dict[str, Any]
    alerts_enabled: bool
    email: Optional[str] = None
    last_matched_symbols: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ScreenerAlertEvent(BaseModel):
    id: str
    screen_id: str
    screen_name: str
    new_symbols: List[str] = Field(default_factory=list)
    email: Optional[str] = None
    is_read: bool
    created_at: datetime


class ScreenerAlertCheckResponse(BaseModel):
    generated: int
    events: List[ScreenerAlertEvent]
