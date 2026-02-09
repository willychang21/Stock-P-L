import Decimal from 'decimal.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortfolioService } from '../PortfolioService';
import { ITransactionRepository } from '../../../domain/models/ITransactionRepository';
import { ICalculator } from '../../../domain/calculators/ICalculator';
import {
  Transaction,
  TransactionType,
} from '../../../domain/models/Transaction';
import { Result } from '../../../domain/errors/AppError';

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let mockRepo: ITransactionRepository;
  let mockCalculator: ICalculator;

  beforeEach(() => {
    mockRepo = {
      getAll: vi.fn(),
      getBySymbol: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockCalculator = {
      calculate: vi.fn(),
      metadata: vi.fn(),
    };
    portfolioService = new PortfolioService(mockRepo, { fifo: mockCalculator });
  });

  it('should calculate portfolio successfully', async () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        date: new Date(),
        symbol: 'AAPL',
        type: TransactionType.BUY,
        quantity: new Decimal(10),
        price: new Decimal(100),
        fees: new Decimal(0),
        currency: 'USD',
      },
    ];
    vi.mocked(mockRepo.getAll).mockResolvedValue(Result.ok(transactions));
    vi.mocked(mockCalculator.calculate).mockReturnValue({
      calculatorId: 'fifo',
      metrics: {},
      generatedAt: new Date(),
    } as any);

    const result = await portfolioService.calculatePortfolio('fifo');

    expect(result.success).toBe(true);
    expect(mockRepo.getAll).toHaveBeenCalled();
    expect(mockCalculator.calculate).toHaveBeenCalled();
  });
});
