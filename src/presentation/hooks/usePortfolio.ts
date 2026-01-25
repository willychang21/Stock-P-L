import { useState, useCallback } from 'react';
import { PortfolioService } from '../../application/services/PortfolioService';
import { TransactionRepository } from '../../infrastructure/repositories/TransactionRepository';
import { AnalysisResult } from '../../domain/models/AnalysisResult';
import { AppError } from '../../domain/errors/AppError';
import { CalculatorRegistry } from '../../domain/calculators/CalculatorRegistry';

// In a real app, these would be provided via Context/DI
const transactionRepo = new TransactionRepository();
const registry = CalculatorRegistry.getInstance();
const calculators = registry.getAll().reduce((acc, calc) => {
  acc[calc.metadata().id] = calc;
  return acc;
}, {} as any);

const portfolioService = new PortfolioService(transactionRepo, calculators);

export function usePortfolio() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const calculate = useCallback(async (calculatorId: string) => {
    setIsLoading(true);
    setError(null);
    const result = await portfolioService.calculatePortfolio(calculatorId);
    if (result.success) {
      setAnalysis(result.value);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  return {
    analysis,
    isLoading,
    error,
    calculate
  };
}
