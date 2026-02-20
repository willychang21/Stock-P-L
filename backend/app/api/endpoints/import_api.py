from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.importer import importer_service
from app.schemas.portfolio import ImportResult # Need to define this schema or generic dict

router = APIRouter()

@router.post("", response_model=dict)
async def import_csv(
    file: UploadFile = File(...),
    broker: str = Form(...)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    try:
        content = await file.read()
        batch, transactions = importer_service.parse_csv(content, file.filename, broker)
        
        importer_service.save_import(batch, transactions)
        
        return {
            "success": True,
            "count": len(transactions),
            "batch_id": batch.id,
            "message": f"Successfully imported {len(transactions)} transactions."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
