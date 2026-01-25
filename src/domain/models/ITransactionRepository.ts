import { Transaction } from './Transaction';
import { Result } from '../errors/AppError';

export interface ITransactionRepository {
  getAll(): Promise<Result<Transaction[]>>;
  getBySymbol(symbol: string): Promise<Result<Transaction[]>>;
  add(transaction: Omit<Transaction, 'id'>): Promise<Result<Transaction>>;
  update(transaction: Transaction): Promise<Result<Transaction>>;
  delete(id: string): Promise<Result<void>>;
}
