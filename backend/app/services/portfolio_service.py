from app.db.session import db
from app.schemas.portfolio import PortfolioSummary
from app.services.market_data import market_data_service
from app.services.calculators import FIFOCalculator
import duckdb
from decimal import Decimal

class PortfolioService:
    def get_summary(self) -> PortfolioSummary:
        conn = db.get_connection()
        try:
            # Fetch all transactions sorted by date
            query = "SELECT * FROM transactions ORDER BY transaction_date ASC, id ASC"
            cursor = conn.execute(query)
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            transactions = [dict(zip(cols, row)) for row in rows]
            
            if not transactions:
                return PortfolioSummary(
                    total_value=0.0,
                    total_cost=0.0,
                    total_pl=0.0,
                    total_pl_percent=0.0,
                    total_realized_pl=0.0,
                    total_unrealized_pl=0.0
                )
            
            # Group by symbol
            tx_by_symbol = {}
            for tx in transactions:
                sym = tx['symbol']
                if sym not in tx_by_symbol:
                    tx_by_symbol[sym] = []
                tx_by_symbol[sym].append(tx)
            
            # Calculate holdings and realized P/L per symbol
            symbol_state = {} # symbol -> { quantity, cost_basis, realized_pl }
            total_realized_pl = Decimal(0)
            
            for sym, txs in tx_by_symbol.items():
                calc = FIFOCalculator()
                for tx in txs:
                    calc.process_transaction(tx)
                
                qty = calc.get_holdings()
                cost_basis = calc.get_total_cost_basis()
                realized = calc.total_realized_pl
                
                total_realized_pl += realized
                
                if qty > 0:
                    symbol_state[sym] = {
                        'quantity': qty,
                        'cost_basis': cost_basis
                    }
            
            # Fetch current prices for open positions
            symbols_to_fetch = list(symbol_state.keys())
            quotes = market_data_service.get_quotes(symbols_to_fetch)
            price_map = {q['symbol']: Decimal(str(q['regularMarketPrice'])) for q in quotes if q.get('regularMarketPrice')}
            
            total_value = Decimal(0)
            total_cost_basis = Decimal(0)
            
            for sym, state in symbol_state.items():
                qty = state['quantity']
                cost = state['cost_basis']
                
                # Get price, default to cost basis per share if missing (to avoid 0 value) 
                # or simplified: default to 0.
                price = price_map.get(sym, Decimal(0))
                
                market_val = qty * price
                
                total_value += market_val
                total_cost_basis += cost
                
            total_unrealized_pl = total_value - total_cost_basis
            
            # Total PL = Realized + Unrealized
            grand_total_pl = total_realized_pl + total_unrealized_pl
            
            total_pl_percent = Decimal(0)
            if total_cost_basis > 0:
                # Typically % return is on the *invested* capital (Cost Basis of current holdings)
                # But "Total P/L %" often implies (Realized + Unrealized) / (Total Invested ever?)
                # Standard brokerage display:
                # "Unrealized %" = Unrealized / Cost Basis
                # "Total %" is ambiguous. Let's stick to (Unrealized + Realized) / Cost Basis (current) is weird if realized is high.
                # Let's return Unrealized % as the main "Portfolio %" often displayed?
                # Actually user asked for "Total P/L (%)".
                # If I have realized gain $1000 and current holding cost $0, % is infinity.
                # Let's use: Total PL / Cost Basis.
                total_pl_percent = (grand_total_pl / total_cost_basis * 100)
            
            return PortfolioSummary(
                total_value=round(float(total_value), 2),
                total_cost=round(float(total_cost_basis), 2),
                total_pl=round(float(grand_total_pl), 2),
                total_pl_percent=round(float(total_pl_percent), 2),
                total_realized_pl=round(float(total_realized_pl), 2),
                total_unrealized_pl=round(float(total_unrealized_pl), 2)
            )
            
        finally:
            conn.close()

portfolio_service = PortfolioService()
