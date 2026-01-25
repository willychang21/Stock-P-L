import { ICalculator } from './ICalculator';
import { FIFOCalculator } from './FIFOCalculator';
import { WeightedAverageCalculator } from './WeightedAverageCalculator';

export class CalculatorRegistry {
  private static instance: CalculatorRegistry;
  private calculators: Map<string, ICalculator> = new Map();

  private constructor() {
    this.register(new FIFOCalculator());
    this.register(new WeightedAverageCalculator());
  }

  public static getInstance(): CalculatorRegistry {
    if (!CalculatorRegistry.instance) {
      CalculatorRegistry.instance = new CalculatorRegistry();
    }
    return CalculatorRegistry.instance;
  }

  public register(calculator: ICalculator): void {
    this.calculators.set(calculator.metadata().id, calculator);
  }

  public get(id: string): ICalculator | undefined {
    return this.calculators.get(id);
  }

  public getAll(): ICalculator[] {
    return Array.from(this.calculators.values());
  }
}
