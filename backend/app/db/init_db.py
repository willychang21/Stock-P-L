from __future__ import annotations
import os
import shutil
from datetime import datetime
from app.db.session import db, DATA_DIR

BACKUP_DIR = os.path.join(DATA_DIR, "backups")
MAX_BACKUPS = 5


def _backup_database():
    """Auto-backup the database file before any migration."""
    db_path = os.path.join(DATA_DIR, "portfolio.duckdb")
    if not os.path.exists(db_path):
        return
    
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"portfolio_{timestamp}.duckdb")
    
    try:
        shutil.copy2(db_path, backup_path)
        size_mb = os.path.getsize(backup_path) / (1024 * 1024)
        print(f"  💾 Database backed up: {backup_path} ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"  ⚠️ Backup failed: {e}")
        return
    
    # Clean up old backups, keep only MAX_BACKUPS
    backups = sorted([
        f for f in os.listdir(BACKUP_DIR)
        if f.startswith("portfolio_") and f.endswith(".duckdb")
    ])
    while len(backups) > MAX_BACKUPS:
        old = backups.pop(0)
        os.remove(os.path.join(BACKUP_DIR, old))
        print(f"  🗑️ Removed old backup: {old}")


def _safe_add_column(conn, table: str, column: str, col_type: str, default=None):
    """Safely add a column to a table. No-op if column already exists."""
    try:
        default_clause = f" DEFAULT {default}" if default is not None else ""
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}")
        print(f"  ↳ Added column {column} to {table}")
    except Exception:
        pass  # Column already exists


# ═══════════════════════════════════════════
# Versioned Migrations
# Each tuple: (version, description, SQL)
# ⚠️ NEVER use DROP TABLE or DELETE FROM here!
# ═══════════════════════════════════════════
MIGRATIONS = [
    ("001", "Add content_hash to pending_reviews",
     "ALTER TABLE pending_reviews ADD COLUMN content_hash TEXT"),
    ("002", "Add post_date to pending_reviews",
     "ALTER TABLE pending_reviews ADD COLUMN post_date DATE"),
    ("003", "Expand screener_data with professional metrics",
     """
     ALTER TABLE screener_data ADD COLUMN forward_pe DOUBLE;
     ALTER TABLE screener_data ADD COLUMN price_to_sales DOUBLE;
     ALTER TABLE screener_data ADD COLUMN price_to_book DOUBLE;
     ALTER TABLE screener_data ADD COLUMN ev_to_ebitda DOUBLE;
     ALTER TABLE screener_data ADD COLUMN ev_to_revenue DOUBLE;
     ALTER TABLE screener_data ADD COLUMN peg_ratio DOUBLE;
     ALTER TABLE screener_data ADD COLUMN profit_margin DOUBLE;
     ALTER TABLE screener_data ADD COLUMN operating_margin DOUBLE;
     ALTER TABLE screener_data ADD COLUMN roe DOUBLE;
     ALTER TABLE screener_data ADD COLUMN roa DOUBLE;
     ALTER TABLE screener_data ADD COLUMN revenue_growth DOUBLE;
     ALTER TABLE screener_data ADD COLUMN earnings_growth DOUBLE;
     ALTER TABLE screener_data ADD COLUMN dividend_yield DOUBLE;
     ALTER TABLE screener_data ADD COLUMN payout_ratio DOUBLE;
     ALTER TABLE screener_data ADD COLUMN debt_to_equity DOUBLE;
     ALTER TABLE screener_data ADD COLUMN current_ratio DOUBLE;
     ALTER TABLE screener_data ADD COLUMN fifty_day_sma DOUBLE;
     ALTER TABLE screener_data ADD COLUMN two_hundred_day_sma DOUBLE;
     """),
    ("004", "Add ROIC and FCF components to screener_data",
     """
     ALTER TABLE screener_data ADD COLUMN free_cash_flow DOUBLE;
     ALTER TABLE screener_data ADD COLUMN roic DOUBLE;
     ALTER TABLE screener_data ADD COLUMN eps_growth DOUBLE;
     ALTER TABLE screener_data ADD COLUMN total_debt DOUBLE;
     ALTER TABLE screener_data ADD COLUMN total_equity DOUBLE;
     ALTER TABLE screener_data ADD COLUMN total_cash DOUBLE;
     ALTER TABLE screener_data ADD COLUMN operating_income DOUBLE;
     ALTER TABLE screener_data ADD COLUMN tax_rate DOUBLE;
     """),
    ("005", "Add sentiment and momentum metrics to screener_data",
     """
     ALTER TABLE screener_data ADD COLUMN target_upside DOUBLE;
     ALTER TABLE screener_data ADD COLUMN recommendation_mean DOUBLE;
     ALTER TABLE screener_data ADD COLUMN short_percent DOUBLE;
     ALTER TABLE screener_data ADD COLUMN inst_own_percent DOUBLE;
     ALTER TABLE screener_data ADD COLUMN insider_own_percent DOUBLE;
     ALTER TABLE screener_data ADD COLUMN beta DOUBLE;
     ALTER TABLE screener_data ADD COLUMN gross_margin DOUBLE;
     ALTER TABLE screener_data ADD COLUMN ebitda_margin DOUBLE;
     """),
    ("006", "Add dividend metrics and price ranges for better screening",
     """
     ALTER TABLE screener_data ADD COLUMN dividend_yield DOUBLE;
     ALTER TABLE screener_data ADD COLUMN payout_ratio DOUBLE;
     ALTER TABLE screener_data ADD COLUMN fifty_two_week_high DOUBLE;
     ALTER TABLE screener_data ADD COLUMN fifty_two_week_low DOUBLE;
     ALTER TABLE screener_data ADD COLUMN price_to_fcf DOUBLE;
     """),
]


def _run_migrations(conn):
    """Run only new migrations that haven't been applied yet."""
    # Create migration tracking table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            description TEXT,
            applied_at TIMESTAMP NOT NULL
        )
    """)
    
    # Get already applied versions
    applied = set()
    try:
        rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
        applied = {r[0] for r in rows}
    except Exception:
        pass
    
    # Apply new migrations
    new_count = 0
    for version, description, sql in MIGRATIONS:
        if version in applied:
            continue
        
        # Safety check: block destructive operations
        sql_upper = sql.upper()
        if any(kw in sql_upper for kw in ["DROP TABLE", "DELETE FROM", "TRUNCATE"]):
            print(f"  ❌ Migration {version} BLOCKED: destructive operation detected!")
            continue
        
        try:
            conn.execute(sql)
            conn.execute(
                "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)",
                [version, description, datetime.now()]
            )
            print(f"  ✅ Migration {version}: {description}")
            new_count += 1
        except Exception as e:
            # Column/table already exists — record as applied
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                conn.execute(
                    "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)",
                    [version, f"{description} (pre-existing)", datetime.now()]
                )
                print(f"  ⏭️ Migration {version}: already applied ({description})")
            else:
                print(f"  ⚠️ Migration {version} failed: {e}")
    
    if new_count > 0:
        print(f"  📦 Applied {new_count} new migration(s)")
    else:
        print(f"  📦 All migrations up to date")


def init_db():
    # Step 0: Backup before anything else
    _backup_database()
    
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

        # Screener Data Table (Cache for global stock discovery)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS screener_data (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                price DOUBLE,
                market_cap DOUBLE,
                trailing_pe DOUBLE,
                forward_pe DOUBLE,
                price_to_sales DOUBLE,
                price_to_book DOUBLE,
                ev_to_ebitda DOUBLE,
                ev_to_revenue DOUBLE,
                peg_ratio DOUBLE,
                profit_margin DOUBLE,
                operating_margin DOUBLE,
                roe DOUBLE,
                roa DOUBLE,
                revenue_growth DOUBLE,
                earnings_growth DOUBLE,
                dividend_yield DOUBLE,
                payout_ratio DOUBLE,
                debt_to_equity DOUBLE,
                current_ratio DOUBLE,
                fifty_day_sma DOUBLE,
                two_hundred_day_sma DOUBLE,
                free_cash_flow DOUBLE,
                roic DOUBLE,
                eps_growth DOUBLE,
                total_debt DOUBLE,
                total_equity DOUBLE,
                total_cash DOUBLE,
                operating_income DOUBLE,
                tax_rate DOUBLE,
                target_upside DOUBLE,
                recommendation_mean DOUBLE,
                short_percent DOUBLE,
                inst_own_percent DOUBLE,
                insider_own_percent DOUBLE,
                beta DOUBLE,
                gross_margin DOUBLE,
                ebitda_margin DOUBLE,
                has_options BOOLEAN,
                sector TEXT,
                industry TEXT,
                updated_at TIMESTAMP NOT NULL
            );
        """)

        # Screener saved views (column visibility + filters)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS screener_views (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                visibility_model TEXT NOT NULL,
                filters TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            );
        """)

        # Screener saved screens (filters + alert config)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS screener_screens (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filters TEXT NOT NULL,
                alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                email TEXT,
                last_matched_symbols TEXT NOT NULL DEFAULT '[]',
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            );
        """)

        # Screener alert events (generated by periodic/triggered checks)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS screener_alert_events (
                id TEXT PRIMARY KEY,
                screen_id TEXT NOT NULL,
                screen_name TEXT NOT NULL,
                new_symbols TEXT NOT NULL,
                email TEXT,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL,
                FOREIGN KEY (screen_id) REFERENCES screener_screens(id)
            );
        """)

        # Watchlist items (user curated symbols)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS watchlist_items (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL UNIQUE,
                note TEXT,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            );
        """)

        # --- Run versioned migrations ---
        _run_migrations(conn)

        # Emergency fallback: ensure essential new columns exist regardless of migration version
        missing_cols = {
            "fifty_two_week_high": "DOUBLE",
            "fifty_two_week_low": "DOUBLE",
            "price_to_fcf": "DOUBLE",
            "dividend_yield": "DOUBLE",
            "payout_ratio": "DOUBLE"
        }
        for col, col_type in missing_cols.items():
            _safe_add_column(conn, "screener_data", col, col_type)

        print("✅ Database initialized successfully.")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
