from app.db.session import db

def init_db():
    conn = db.get_connection()
    try:
        # Transactions Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                import_batch_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                transaction_date DATE NOT NULL,
                settle_date DATE,
                quantity DOUBLE NOT NULL,
                price DOUBLE NOT NULL,
                fees DOUBLE NOT NULL,
                total_amount DOUBLE NOT NULL,
                broker TEXT NOT NULL,
                account_id TEXT,
                notes TEXT,
                tags TEXT,
                rating INTEGER,
                created_at TIMESTAMP NOT NULL,
                raw_data TEXT NOT NULL,
                content_hash TEXT NOT NULL UNIQUE
            );
        """)
        
        # Index for faster portfolio queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_symbol_date ON transactions(symbol, transaction_date);
        """)

        # Import Batches Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS import_batches (
                id TEXT PRIMARY KEY,
                broker TEXT NOT NULL,
                filename TEXT NOT NULL,
                imported_at TIMESTAMP NOT NULL,
                row_count INTEGER NOT NULL
            );
        """)

        # Prices Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS prices (
                symbol TEXT PRIMARY KEY,
                price DOUBLE NOT NULL,
                change DOUBLE NOT NULL,
                change_percent DOUBLE NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                quote_type TEXT
            );
        """)

        # Research Notes Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS research_notes (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                content TEXT,
                forward_pe DOUBLE,
                revenue_growth DOUBLE,
                target_price DOUBLE,
                sentiment TEXT,
                external_links TEXT,
                updated_at TIMESTAMP NOT NULL
            );
        """)

        print("✅ Database initialized successfully.")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
