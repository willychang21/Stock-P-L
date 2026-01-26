from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import portfolio, transactions, import_api, quotes, historical, system, strategy, influencers

app = FastAPI(
    title="Stock Portfolio API",
    description="Backend for Stock Portfolio Tracker",
    version="1.0.0",
    redirect_slashes=False
)

# Configure CORS FIRST
origins = [
    "http://localhost:5173",  # Vite default
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full error for debugging
    print(f"ERROR: {str(exc)}")
    import traceback
    traceback.print_exc()
    
    response = JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc),
                "details": None
            }
        },
    )
    
    # Manually add CORS headers for error responses
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(import_api.router, prefix="/api/import", tags=["import"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["quotes"])
app.include_router(historical.router, prefix="/api/historical-prices", tags=["historical"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])
app.include_router(influencers.router, prefix="/api", tags=["influencers"])

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/")
def root():
    return {"message": "Welcome to Stock Portfolio API"}
