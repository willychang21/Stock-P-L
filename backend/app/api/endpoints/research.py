from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.services.research_service import research_service

router = APIRouter()

class NoteInput(BaseModel):
    id: Optional[str] = None
    symbol: str
    content: Optional[str] = ""
    forward_pe: Optional[float] = None
    revenue_growth: Optional[float] = None
    target_price: Optional[float] = None
    sentiment: Optional[str] = None
    external_links: Optional[List[Dict[str, str]]] = []

@router.get("/", response_model=List[Dict])
async def get_all_notes(symbol: Optional[str] = None):
    try:
        return research_service.get_notes(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{symbol}", response_model=List[Dict])
async def get_symbol_notes(symbol: str):
    try:
        return research_service.get_notes(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=Dict)
async def create_or_update_note(note: NoteInput):
    try:
        return research_service.save_note(note.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{note_id}", response_model=bool)
async def delete_note(note_id: str):
    try:
        return research_service.delete_note(note_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
