import { Transaction } from '../models/Transaction';
import { AnalysisResult } from '../models/AnalysisResult';

export type PricePoint = { date: Date; price: number };
export type PriceHistory = PricePoint[];
export type MarketDataMap = Record<string, PriceHistory>;

export interface ICalculator {
  calculate(transactions: Transaction[], marketData: MarketDataMap): AnalysisResult;
  metadata(): {
    id: string;
    name: string;
    description: string;
  };
}
