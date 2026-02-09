import { ITransactionRepository } from '../../domain/models/ITransactionRepository';
import { ICalculator } from '../../domain/calculators/ICalculator';
import { Result, AppError } from '../../domain/errors/AppError';
import { AnalysisResult } from '../../domain/models/AnalysisResult';

export class PortfolioService {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly calculators: Record<string, ICalculator>
  ) {}

  async calculatePortfolio(calculatorId: string): Promise<Result<AnalysisResult>> {
    const calculator = this.calculators[calculatorId];
    if (!calculator) {
      return Result.fail(new AppError(`Calculator ${calculatorId} not found`, 'CALCULATOR_NOT_FOUND'));
    }

    const transactionsResult = await this.transactionRepo.getAll();
    if (!transactionsResult.success) {
      return Result.fail(transactionsResult.error);
    }

    // TODO: Fetch market data
    const marketData = {}; 

    try {
      const result = calculator.calculate(transactionsResult.value, marketData);
      return Result.ok(result);
    } catch (e: any) {
      return Result.fail(new AppError(e.message, 'CALCULATION_ERROR'));
    }
  }
}
