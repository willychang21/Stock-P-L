import { Result } from '../errors/AppError';

export interface PricePoint {
  date: Date;
  price: number;
}

export interface IMarketDataService {
  getCurrentPrice(symbol: string): Promise<Result<number>>;
  getHistory(symbol: string, startDate: Date, endDate: Date): Promise<Result<PricePoint[]>>;
}
