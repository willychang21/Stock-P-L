from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import portfolio, transactions, import_api, quotes, historical, system

app = FastAPI(
    title="Stock Portfolio API",
    description="Backend for Stock Portfolio Tracker",
    version="1.0.0",
)

# Configure CORS
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

app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(import_api.router, prefix="/api/import", tags=["import"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["quotes"])
app.include_router(historical.router, prefix="/api/historical-prices", tags=["historical"])
app.include_router(system.router, prefix="/api/system", tags=["system"])

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/")
def root():
    return {"message": "Welcome to Stock Portfolio API"}
