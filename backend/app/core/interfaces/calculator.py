from abc import ABC, abstractmethod
from typing import List, Dict, Any
from app.core.domain.models import Transaction, AnalysisResult
from datetime import datetime

class CalculatorStrategy(ABC):
    @abstractmethod
    def calculate(self, transactions: List[Transaction], market_data: Dict[str, Any]) -> AnalysisResult:
        """Calculate portfolio metrics based on transactions and market data."""
        pass

    @abstractmethod
    def metadata(self) -> Dict[str, str]:
        """Return calculator metadata including id, name, and description."""
        pass
