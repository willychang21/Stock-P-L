import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Holding } from '@domain/models/Holding';
import { CostBasisMethod } from '@domain/models/PLReport';
import { plService } from '@application/services/PLService';
import { priceService } from '@application/services/PriceService';
import Decimal from 'decimal.js';
import { ImportPipeline, ImportResult } from '@infrastructure/import/ImportPipeline';
import { Broker } from '@domain/models/Transaction';

interface AppState {
  holdings: Map<string, Holding>;
  isLoading: boolean;
  error: string | null;
  lastRefresh: number;
  costBasisMethod: CostBasisMethod;
  currentPrices: Map<string, Decimal>;

  // Actions
  refreshHoldings: () => Promise<void>;
  setCostBasisMethod: (method: CostBasisMethod) => void;
  clearError: () => void;
  resetStore: () => void;
  initialize: () => Promise<void>;
  importCSV: (file: File, broker: Broker) => Promise<ImportResult>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      holdings: new Map(),
      isLoading: false,
      error: null,
      lastRefresh: 0,
      costBasisMethod: 'FIFO',
      currentPrices: new Map(),

      refreshHoldings: async () => {
        set({ isLoading: true, error: null });
        try {
          const method = get().costBasisMethod;
          
          // 1. Calculate holdings based on transactions
          const holdingsMap = await plService.getAllHoldings(method);
          
          // 2. Fetch current prices
          const symbols = Array.from(holdingsMap.keys());
          const prices = await priceService.getPrices(symbols);
          
          // 3. Update holdings with market data
          const currentPrices = new Map<string, Decimal>();
          
          for (const [symbol, holding] of holdingsMap.entries()) {
             const price = prices.get(symbol.toUpperCase());
             if (price) {
                 const priceDec = new Decimal(price);
                 currentPrices.set(symbol, priceDec);
                 holding.current_price = priceDec;
                 holding.market_value = holding.total_shares.times(priceDec);
                 
                 // Recalculate Unrealized P/L
                 // Value - Cost Basis
                 holding.unrealized_pl = holding.market_value.minus(holding.cost_basis);
                 
                 // Return %
                 if (!holding.cost_basis.isZero()) {
                     holding.return_percentage = holding.unrealized_pl.div(holding.cost_basis).times(100);
                 }
                 
                 // Update Asset Type from Price Service if not set
                 const type = priceService.getAssetType(symbol);
                 if (type) holding.assetType = type;
             }
          }

          set({ 
              holdings: new Map(holdingsMap), 
              currentPrices, 
              lastRefresh: Date.now(),
              isLoading: false 
          });
          
        } catch (error) {
          console.error('Failed to refresh holdings:', error);
          set({ error: String(error), isLoading: false });
        }
      },

      setCostBasisMethod: (method: CostBasisMethod) => {
        set({ costBasisMethod: method });
        get().refreshHoldings();
      },

      clearError: () => set({ error: null }),
      
      resetStore: () => {
          set({
              holdings: new Map(),
              isLoading: false,
              error: null,
              lastRefresh: 0,
              currentPrices: new Map()
          });
      },

      importCSV: async (file: File, broker: Broker) => {
        set({ isLoading: true, error: null });
        try {
          const pipeline = new ImportPipeline();
          const result = await pipeline.processFile(file, broker);
          
          if (result.success) {
             await get().refreshHoldings();
          }
          
          set({ isLoading: false });
          return result;
        } catch (error) {
           console.error('Import failed:', error);
           set({ isLoading: false, error: String(error) });
           throw error;
        }
      },

      initialize: async () => {
          await get().refreshHoldings();
      }
    }),
    {
      name: 'portfolio-storage',
      // Only persist user preferences, NOT computed data (holdings/prices come from DB)
      partialize: (state) => ({ 
        costBasisMethod: state.costBasisMethod 
      }),
    }
  )
);
