import os
import duckdb
from app.db.session import db, DATA_DIR

def migrate_parquet():
    conn = db.get_connection()
    try:
        tables = ['transactions', 'import_batches', 'prices']
        
        for table in tables:
            parquet_path = os.path.join(DATA_DIR, f"{table}.parquet")
            
            if os.path.exists(parquet_path):
                print(f"📦 Migrating {table} from {parquet_path}...")
                
                # Check if table is empty before deciding to append or replace
                # For migration, we assume we want to load everything if table is empty
                # or merging might be complex. Let's do a safe INSERT OR IGNORE or simple INSERT.
                # Since we just initialized DB, it should be empty.
                
                try:
                    query = f"INSERT INTO {table} SELECT * FROM read_parquet('{parquet_path}')"
                    conn.execute(query)
                    print(f"✅ Migrated {table}")
                except Exception as e:
                    print(f"⚠️ Failed to migrate {table}: {e}")
            else:
                print(f"ℹ️ No parquet file found for {table}, skipping.")
                
    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_parquet()
