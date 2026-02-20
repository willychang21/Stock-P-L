from __future__ import annotations
from app.db.session import db
from app.services.calculators import FIFOCalculator, TradeRecord
from app.services.market_data import market_data_service
from decimal import Decimal
from typing import List, Dict, Any
from datetime import date, timedelta

class AnalyticsService:
    def get_behavioral_analytics(self) -> Dict[str, Any]:
        trades = self._get_all_trades_including_open()
        
        # Calculate MFE/MAE for all trades
        self._calculate_mfe_mae(trades)
        
        # Realized (Closed)
        closed_winners = [t for t in trades if t.status == 'CLOSED' and t.realized_pl > 0]
        closed_losers = [t for t in trades if t.status == 'CLOSED' and t.realized_pl <= 0]
        
        # Unrealized (Open)
        open_winners = [t for t in trades if t.status == 'OPEN' and t.realized_pl > 0]
        open_losers = [t for t in trades if t.status == 'OPEN' and t.realized_pl <= 0]
        
        avg_hold_win_closed = self._avg_holding_days(closed_winners)
        avg_hold_loss_closed = self._avg_holding_days(closed_losers)
        
        avg_hold_win_open = self._avg_holding_days(open_winners)
        avg_hold_loss_open = self._avg_holding_days(open_losers)
        
        # Format for frontend
        trade_list = [
            {
                "symbol": t.symbol,
                "quantity": float(t.quantity),
                "entryDate": t.entry_date.isoformat(),
                "exitDate": t.exit_date.isoformat(),
                "realizedPl": float(t.realized_pl), # Actually unrealized for OPEN trades
                "holdingDays": t.holding_days,
                "status": t.status,
                "mfe": float(t.mfe),
                "mae": float(t.mae),
                "efficiency": t.efficiency,
                "entryPrice": float(t.entry_price),
                "exitPrice": float(t.exit_price)
            }
            for t in trades
        ]
        
        return {
            "metrics": {
                "avgHoldingDaysWinners": avg_hold_win_closed,
                "avgHoldingDaysLosers": avg_hold_loss_closed,
                "avgHoldingDaysWinnersOpen": avg_hold_win_open,
                "avgHoldingDaysLosersOpen": avg_hold_loss_open,
                "totalWinners": len(closed_winners),
                "totalLosers": len(closed_losers),
                "openWinners": len(open_winners),
                "openLosers": len(open_losers)
            },
            "trades": trade_list
        }
    
    def _calculate_mfe_mae(self, trades: List[TradeRecord]):
        # Group by symbol to optimize data fetching
        trades_by_symbol = {}
        for t in trades:
            if t.symbol not in trades_by_symbol:
                trades_by_symbol[t.symbol] = []
            trades_by_symbol[t.symbol].append(t)
            
        today = date.today()
            
        for symbol, sym_trades in trades_by_symbol.items():
            if not sym_trades:
                continue
                
            # Find date range
            min_date = min(t.entry_date for t in sym_trades)
            max_date = max(t.exit_date for t in sym_trades)
            
            # Fetch history (add buffer)
            start_str = (min_date - timedelta(days=5)).strftime('%Y-%m-%d')
            end_str = (max_date + timedelta(days=5)).strftime('%Y-%m-%d')
            
            hist_data = market_data_service.get_historical_prices(symbol, start_str, end_str)
            
            # Create price lookup: date_str -> {high, low}
            prices = {}
            for day in hist_data.get('prices', []):
                prices[day['date']] = {'high': Decimal(str(day['high'])), 'low': Decimal(str(day['low']))}
            
            if not prices:
                continue
                
            for t in sym_trades:
                # Iterate each day of holding
                current = t.entry_date
                max_high = t.entry_price # Start with entry
                min_low = t.entry_price
                
                # If entry date is not in prices (e.g. today or weekend/holiday adjustment needed), try best effort
                # Check all days in range
                # Simple iteration
                # Optimization: could iterate keys, but date range is usually small
                
                day_count = (t.exit_date - t.entry_date).days + 1
                found_data = False
                
                for i in range(day_count):
                    d = t.entry_date + timedelta(days=i)
                    d_str = d.strftime('%Y-%m-%d')
                    if d_str in prices:
                        found_data = True
                        p = prices[d_str]
                        if p['high'] > max_high:
                            max_high = p['high']
                        if p['low'] < min_low:
                            min_low = p['low']
                            
                if found_data and t.entry_price > 0:
                    # Logic for Long positions
                    t.mfe = (max_high - t.entry_price) / t.entry_price
                    t.mae = (min_low - t.entry_price) / t.entry_price
                    
                    potential_profit = max_high - t.entry_price
                    actual_profit = t.exit_price - t.entry_price
                    
                    if potential_profit > 0:
                        t.efficiency = float(actual_profit / potential_profit)
                    else:
                        t.efficiency = 0.0
                
    
    def _avg_holding_days(self, trades: List[TradeRecord]) -> float:
        if not trades:
            return 0.0
        total_days = sum(t.holding_days for t in trades)
        return round(total_days / len(trades), 1)

    def _get_all_trades_including_open(self) -> List[TradeRecord]:
        conn = db.get_connection()
        try:
            # Fetch all transactions sorted by date
            query = "SELECT * FROM transactions ORDER BY transaction_date ASC, id ASC"
            cursor = conn.execute(query)
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            transactions = [dict(zip(cols, row)) for row in rows]
            
            # Group by symbol
            tx_by_symbol = {}
            for tx in transactions:
                sym = tx['symbol']
                if sym not in tx_by_symbol:
                    tx_by_symbol[sym] = []
                tx_by_symbol[sym].append(tx)
            
            all_trades = []
            open_lots_map = {} # symbol -> [lots]
            
            for sym, txs in tx_by_symbol.items():
                calc = FIFOCalculator()
                for tx in txs:
                    calc.process_transaction(tx)
                all_trades.extend(calc.trades) # Closed trades
                
                if calc.lots:
                    open_lots_map[sym] = calc.lots
            
            # Fetch prices for open lots
            if open_lots_map:
                quotes = market_data_service.get_quotes(list(open_lots_map.keys()))
                price_map = {q['symbol']: Decimal(str(q['regularMarketPrice'])) for q in quotes if q.get('regularMarketPrice')}
                
                today = date.today()
                
                for sym, lots in open_lots_map.items():
                    current_price = price_map.get(sym)
                    if current_price is None:
                        continue
                        
                    for lot in lots:
                        holding_days = (today - lot.purchase_date).days
                        unrealized_pl = (current_price - lot.cost_basis_per_share) * lot.quantity
                        
                        # Add as an "OPEN" trade record
                        all_trades.append(TradeRecord(
                            symbol=sym,
                            quantity=lot.quantity,
                            entry_date=lot.purchase_date,
                            exit_date=today, # Effective exit date for calc
                            realized_pl=unrealized_pl,
                            holding_days=holding_days,
                            status='OPEN',
                            entry_price=lot.cost_basis_per_share,
                            exit_price=current_price
                        ))
                
            return all_trades
            
        finally:
            conn.close()

analytics_service = AnalyticsService()
