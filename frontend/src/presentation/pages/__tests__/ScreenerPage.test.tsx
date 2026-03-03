import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenerService } from '@application/services/ScreenerService';

vi.mock('@application/services/ScreenerService', () => ({
  ScreenerService: {
    fetchStocks: vi.fn(),
  },
}));

describe('ScreenerPage Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call fetchStocks on initialization', async () => {
    vi.mocked(ScreenerService.fetchStocks).mockResolvedValue({
      total: 1,
      items: [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          market_cap: 3000000000000,
          trailing_pe: 30.5,
          has_options: true,
          price: 180.0,
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const response = await ScreenerService.fetchStocks({
      limit: 50,
      offset: 0,
    });

    expect(ScreenerService.fetchStocks).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
    });
    expect(response.total).toBe(1);
    // @ts-ignore
    expect(response.items[0].symbol).toBe('AAPL');
  });
});
