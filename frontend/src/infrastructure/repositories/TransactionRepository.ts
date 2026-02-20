import { ITransactionRepository } from '../../domain/models/ITransactionRepository';
import { Transaction } from '../../domain/models/Transaction';
import { Result, AppError } from '../../domain/errors/AppError';
import { apiClient } from '../api/client';

export class TransactionRepository implements ITransactionRepository {
  async getAll(): Promise<Result<Transaction[]>> {
    try {
      const data = await apiClient.getTransactions();
      return Result.ok(data);
    } catch (e: any) {
      return Result.fail(new AppError(e.message, 'FETCH_ERROR'));
    }
  }

  async getBySymbol(symbol: string): Promise<Result<Transaction[]>> {
    try {
      const allResult = await this.getAll();
      if (!allResult.success) return allResult;
      const filtered = allResult.value.filter(t => t.symbol === symbol);
      return Result.ok(filtered);
    } catch (e: any) {
      return Result.fail(new AppError(e.message, 'FETCH_ERROR'));
    }
  }

  async add(
    _transaction: Omit<Transaction, 'id'>
  ): Promise<Result<Transaction>> {
    return Result.fail(
      new AppError('Method not implemented in API client', 'NOT_IMPLEMENTED')
    );
  }

  async update(_transaction: Transaction): Promise<Result<Transaction>> {
    return Result.fail(
      new AppError('Method not implemented in API client', 'NOT_IMPLEMENTED')
    );
  }

  async delete(_id: string): Promise<Result<void>> {
    return Result.fail(
      new AppError('Method not implemented in API client', 'NOT_IMPLEMENTED')
    );
  }
}
