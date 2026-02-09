import { Holding } from './Holding';
import Decimal from 'decimal.js';

export interface Portfolio {
  holdings: Holding[];
  totalMarketValue: Decimal;
  totalUnrealizedPL: Decimal;
  totalRealizedPL: Decimal;
  cashBalance: Decimal;
}