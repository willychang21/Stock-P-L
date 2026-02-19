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

        # Historical Prices Cache Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS historical_prices (
                symbol TEXT NOT NULL,
                date DATE NOT NULL,
                open DOUBLE,
                high DOUBLE,
                low DOUBLE,
                close DOUBLE NOT NULL,
                volume BIGINT,
                created_at TIMESTAMP NOT NULL,
                PRIMARY KEY (symbol, date)
            );
        """)

        # Influencers Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS influencers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                platform TEXT,
                url TEXT,
                created_at TIMESTAMP NOT NULL
            );
        """)

        # Influencer Recommendations Table (Enhanced)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS influencer_recommendations (
                id TEXT PRIMARY KEY,
                influencer_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                signal TEXT NOT NULL DEFAULT 'BUY',
                timeframe TEXT NOT NULL DEFAULT 'MID',
                recommendation_date DATE NOT NULL,
                entry_price DOUBLE,
                target_price DOUBLE,
                stop_loss DOUBLE,
                expiry_date DATE,
                source TEXT NOT NULL DEFAULT 'MANUAL',
                source_url TEXT,
                note TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                final_price DOUBLE,
                final_return DOUBLE,
                created_at TIMESTAMP NOT NULL,
                FOREIGN KEY (influencer_id) REFERENCES influencers(id)
            );
        """)

        # Pending Reviews Table (for auto-tracked content)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pending_reviews (
                id TEXT PRIMARY KEY,
                influencer_id TEXT NOT NULL,
                source TEXT NOT NULL,
                source_url TEXT NOT NULL,
                original_content TEXT NOT NULL,
                ai_analysis TEXT,
                suggested_symbol TEXT,
                suggested_signal TEXT,
                suggested_timeframe TEXT,
                confidence DOUBLE,
                created_at TIMESTAMP NOT NULL,
                reviewed_at TIMESTAMP,
                status TEXT NOT NULL DEFAULT 'PENDING',
                content_hash TEXT,
                FOREIGN KEY (influencer_id) REFERENCES influencers(id)
            );
        """)

        # Scraped Posts History — tracks what we've already analyzed
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scraped_posts (
                id TEXT PRIMARY KEY,
                influencer_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                source TEXT,
                source_url TEXT,
                original_content TEXT,
                is_investment_related BOOLEAN DEFAULT FALSE,
                post_type TEXT,
                analyzed_at TIMESTAMP NOT NULL,
                FOREIGN KEY (influencer_id) REFERENCES influencers(id)
            );
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_scraped_posts_hash 
            ON scraped_posts(influencer_id, content_hash);
        """)

        # --- Migrations: add columns to existing tables ---
        try:
            conn.execute("ALTER TABLE pending_reviews ADD COLUMN content_hash TEXT")
            print("  ↳ Added content_hash to pending_reviews")
        except Exception:
            pass  # Column already exists

        print("✅ Database initialized successfully.")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
