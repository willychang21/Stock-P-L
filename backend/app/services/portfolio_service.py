from typing import Dict, List, Any
from app.core.interfaces.calculator import CalculatorStrategy
from app.core.domain.models import Transaction, TransactionType, Portfolio, Holding, AnalysisResult
from app.db.session import db
from decimal import Decimal
from app.services.market_data import market_data_service
from app.services.calculators import FIFOCalculator as LegacyFIFOCalculator
from datetime import datetime

class FIFOCalculatorStrategy(CalculatorStrategy):
    def calculate(self, transactions: List[Transaction], market_data: Dict[str, Any]) -> AnalysisResult:
        calc = LegacyFIFOCalculator()
        for tx in transactions:
            tx_dict = {
                'id': tx.id,
                'transaction_date': tx.date,
                'transaction_type': tx.type.value,
                'quantity': tx.quantity,
                'price': tx.price,
                'fees': tx.fees,
                'symbol': tx.symbol
            }
            calc.process_transaction(tx_dict)
        
        return AnalysisResult(
            calculator_id="fifo",
            metrics={
                "total_realized_pl": calc.total_realized_pl,
                "holdings": calc.get_holdings(),
                "cost_basis": calc.get_total_cost_basis()
            },
            generated_at=datetime.now()
        )
    
    def metadata(self) -> Dict[str, str]:
        return {"id": "fifo", "name": "FIFO", "description": "First In First Out"}

class WeightedAverageCalculatorStrategy(CalculatorStrategy):
    def calculate(self, transactions: List[Transaction], market_data: Dict[str, Any]) -> AnalysisResult:
        total_qty = Decimal(0)
        total_cost_basis = Decimal(0)
        total_realized_pl = Decimal(0)

        for tx in sorted(transactions, key=lambda x: x.date):
            if tx.type == TransactionType.BUY:
                total_qty += tx.quantity
                total_cost_basis += (tx.quantity * tx.price) + tx.fees
            elif tx.type == TransactionType.SELL:
                sell_qty = abs(tx.quantity)
                if total_qty > 0:
                    avg_cost = total_cost_basis / total_qty
                    cost_of_sold = sell_qty * avg_cost
                    proceeds = (sell_qty * tx.price) - tx.fees
                    total_realized_pl += (proceeds - cost_of_sold)
                    total_qty -= sell_qty
                    total_cost_basis -= cost_of_sold
        
        return AnalysisResult(
            calculator_id="weighted_avg",
            metrics={
                "total_realized_pl": total_realized_pl,
                "holdings": total_qty,
                "cost_basis": total_cost_basis
            },
            generated_at=datetime.now()
        )

    def metadata(self) -> Dict[str, str]:
        return {"id": "weighted_avg", "name": "Weighted Average", "description": "Weighted Average Cost"}

class PortfolioService:
    def __init__(self, calculators: Dict[str, CalculatorStrategy]):
        self.calculators = calculators

    def get_portfolio(self, calculator_id: str = 'fifo') -> Portfolio:
        calculator = self.calculators.get(calculator_id)
        if not calculator:
            raise ValueError(f"Calculator {calculator_id} not found")

        transactions = self._get_all_transactions()
        symbols = sorted(list(set(t.symbol for t in transactions)))
        holdings = []
        total_value = Decimal(0)
        total_cost = Decimal(0)
        total_realized_pl = Decimal(0)
        
        quotes = market_data_service.get_quotes(symbols)
        price_map = {q['symbol']: Decimal(str(q['regularMarketPrice'])) for q in quotes if q.get('regularMarketPrice')}
        type_map = {q['symbol']: q.get('quoteType', 'EQUITY') for q in quotes}

        for sym in symbols:
            sym_txs = [t for t in transactions if t.symbol == sym]
            res = calculator.calculate(sym_txs, {})
            
            qty = res.metrics['holdings']
            cost = res.metrics['cost_basis']
            realized = res.metrics['total_realized_pl']
            
            total_realized_pl += realized
            
            if qty > 0:
                price = price_map.get(sym, Decimal(0))
                asset_type = type_map.get(sym, 'EQUITY')
                market_val = qty * price
                total_value += market_val
                total_cost += cost
                
                holdings.append(Holding(
                    symbol=sym,
                    quantity=qty,
                    average_cost=cost / qty if qty > 0 else Decimal(0),
                    current_price=price,
                    market_value=market_val,
                    unrealized_pl=market_val - cost,
                    realized_pl=realized,
                    asset_type=asset_type
                ))
        
        return Portfolio(
            holdings=holdings,
            total_market_value=total_value,
            total_unrealized_pl=total_value - total_cost,
            total_realized_pl=total_realized_pl,
            cash_balance=Decimal(0)
        )

    def _get_all_transactions(self) -> List[Transaction]:
        conn = db.get_connection()
        try:
            query = "SELECT * FROM transactions ORDER BY transaction_date ASC, id ASC"
            cursor = conn.execute(query)
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            transactions = []
            for row in rows:
                row_dict = dict(zip(cols, row))
                
                # Safe mapping for TransactionType
                raw_type = row_dict['transaction_type']
                try:
                    tx_type = TransactionType(raw_type)
                except ValueError:
                    tx_type = TransactionType.FEE # Fallback
                
                transactions.append(Transaction(
                    id=str(row_dict['id']),
                    date=row_dict['transaction_date'],
                    symbol=row_dict['symbol'],
                    type=tx_type,
                    quantity=Decimal(str(row_dict['quantity'])),
                    price=Decimal(str(row_dict['price'])),
                    fees=Decimal(str(row_dict['fees'])),
                    currency=row_dict.get('currency', 'USD')
                ))
            return transactions
        finally:
            conn.close()

# Initialize with FIFO and Weighted Average
portfolio_service = PortfolioService(calculators={
    'fifo': FIFOCalculatorStrategy(),
    'weighted_avg': WeightedAverageCalculatorStrategy()
})
