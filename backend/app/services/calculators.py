from decimal import Decimal
from typing import List, Optional
from datetime import date
from dataclasses import dataclass

@dataclass
class Lot:
    purchase_date: date
    quantity: Decimal
    cost_basis_per_share: Decimal
    transaction_id: str

@dataclass
class TradeRecord:
    symbol: str
    quantity: Decimal
    entry_date: date
    exit_date: date
    realized_pl: Decimal
    holding_days: int
    status: str = 'CLOSED'
    mfe: Decimal = Decimal(0)
    mae: Decimal = Decimal(0)
    efficiency: float = 0.0
    entry_price: Decimal = Decimal(0)
    exit_price: Decimal = Decimal(0)


class FIFOCalculator:
    def __init__(self):
        self.lots: List[Lot] = []
        self.total_realized_pl: Decimal = Decimal(0)
        self.trades: List[TradeRecord] = []

    def process_transaction(self, tx: dict):
        # tx is a dictionary from the database row
        tx_type = tx['transaction_type']
        
        # Convert to Decimal for precision
        quantity = Decimal(str(tx['quantity']))
        if quantity == 0:
            return

        price = Decimal(str(tx['price']))
        fees = Decimal(str(tx['fees']))
        
        if tx_type == 'BUY':
            cost_basis = price + (fees / quantity)
            self.lots.append(Lot(
                purchase_date=tx['transaction_date'],
                quantity=quantity,
                cost_basis_per_share=cost_basis,
                transaction_id=tx['id']
            ))

        elif tx_type == 'SELL':
            qty_to_sell = abs(quantity)
            remaining_to_sell = qty_to_sell
            
            while remaining_to_sell > 0 and self.lots:
                current_lot = self.lots[0]
                
                sell_from_lot = min(remaining_to_sell, current_lot.quantity)
                
                # Calculate PL
                cost_basis = sell_from_lot * current_lot.cost_basis_per_share
                
                # Prorate fees for this portion of the sell
                fees_prorated = fees * (sell_from_lot / qty_to_sell)
                proceeds = (sell_from_lot * price) - fees_prorated
                
                realized_pl = proceeds - cost_basis
                self.total_realized_pl += realized_pl
                
                # Create Trade Record
                entry_date = current_lot.purchase_date
                exit_date = tx['transaction_date']
                holding_days = (exit_date - entry_date).days
                
                self.trades.append(TradeRecord(
                    symbol=tx.get('symbol', 'UNKNOWN'),
                    quantity=sell_from_lot,
                    entry_date=entry_date,
                    exit_date=exit_date,
                    realized_pl=realized_pl,
                    holding_days=holding_days,
                    entry_price=current_lot.cost_basis_per_share,
                    exit_price=price,
                    status='CLOSED'
                ))
                
                # Update lot
                current_lot.quantity -= sell_from_lot
                remaining_to_sell -= sell_from_lot
                
                if current_lot.quantity == 0:
                    self.lots.pop(0)

    def get_holdings(self) -> Decimal:
        return sum((lot.quantity for lot in self.lots), Decimal(0))

    def get_total_cost_basis(self) -> Decimal:
        return sum((lot.quantity * lot.cost_basis_per_share for lot in self.lots), Decimal(0))
