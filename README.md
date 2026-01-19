# Investment Portfolio Tracker

A **client-side web application** for personal investment tracking and P/L analysis, built with React, TypeScript, and SQLite WASM.

## Features

✅ **Transaction Management**
- Import unlimited transactions from CSV (Robinhood, Charles Schwab)
- Automatic deduplication (safe to re-import)
- Manual transaction entry support

✅ **P/L Calculation**
- FIFO (First-In-First-Out) - IRS-compliant
- Average Cost method
- Realized and unrealized P/L tracking
- Per-symbol P/L breakdown

✅ **Portfolio Analytics**
- Current holdings with cost basis
- Portfolio-wide summary (total value, return %)
- Lot-level tracking for FIFO

✅ **Privacy & Offline-First**
- All data stored locally in browser (SQLite WASM)
- No backend, no cloud sync
- Works completely offline
- Export data for backup

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

#Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Building for Production

```bash
npm run build
npm run preview
```

## Usage Guide

### 1. Import Transactions

1. Click **"Import CSV"** button on Dashboard
2. Select your broker CSV file
3. Choose broker (or let it auto-detect)
4. Review preview and confirm

**Supported Brokers:**
- ✅ Robinhood
- ✅ Charles Schwab
- 🔄 More coming soon (or add your own adapter!)

### 2. View Portfolio

The Dashboard shows:
- **Total Portfolio Value**: Sum of all holdings
- **Total Cost**: Your total investment
- **Unrealized P/L**: Current gains/losses
- **Return %**: Performance percentage

### 3. Configure Settings

Go to **Settings** to:
- Switch between FIFO and Average Cost methods
- (More settings coming in future updates)

##Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI**: Material-UI (MUI) + Tailwind CSS
- **State**: Zustand
- **Storage**: SQLite WASM (via sql.js)
- **Build**: Vite

### Project Structure

```
src/
├── domain/          # Core business logic (calculators, models)
├── infrastructure/  # Storage, CSV import adapters
├── application/     # Services, state management
└── presentation/    # React components, pages
```

### Design Principles

1. **Event Sourcing**: Transactions are immutable; all state is derived
2. **No Stored Aggregates**: P/L calculated on-demand for correctness
3. **Local-First**: Zero dependency on external APIs or cloud
4. **Deterministic**: Same transactions → same P/L, every time

## Key Concepts

### Cost Basis Methods

**FIFO (Recommended)**
- Matches IRS requirements for tax reporting
- Tracks individual purchase lots
- Matches broker 1099-B forms

**Average Cost**
- Simpler calculation
- NOT IRS-compliant for stocks
- Useful for comparison only

### Data Storage

- Uses **SQLite WASM** running entirely in your browser
- Data persisted to **IndexedDB** (browser built-in database)
- Survives browser restarts
- ~100KB per 10,000 transactions

### CSV Import

The system automatically:
- Detects broker format from CSV headers
- Normalizes different column names
- Deduplicates using content hashing
- Handles missing fields gracefully

## Roadmap

### v1.0 (Current)
- ✅ CSV import (Robinhood, Schwab)
- ✅ FIFO & Average Cost P/L
- ✅ Holdings dashboard
- ✅ Basic settings

### v1.1 (Next)
- [ ] Transaction history table with filters
- [ ] Real-time price fetching (optional API)
- [ ] Export P/L reports to PDF
- [ ] Symbol detail view with lot breakdown

### v2.0 (Future)
- [ ] Wash sale tracking (30-day rule)
- [ ] Stock split handling
- [ ] Dividend tracking & DRIP support
- [ ] Multi-currency support

## Development

### Running Tests

```bash
npm test
```

### Adding a New Broker

1. Create adapter in `src/infrastructure/import/adapters/`:

```typescript
export class MyBrokerAdapter implements BrokerAdapter {
  broker = Broker.MY_BROKER;
  
  canHandle(headers: string[]): boolean {
    return headers.includes('My Broker Column');
  }
  
  parseRow(row: Record<string, string>): RawTransaction {
    // Map broker columns to RawTransaction
  }
}
```

2. Register in `ImportPipeline.ts`

## Troubleshooting

**Database won't initialize**
- Check browser console for errors
- Try clearing IndexedDB in DevTools
- Ensure browser supports WASM

**Import fails**
- Verify CSV format matches broker template
- Check for required columns (Symbol, Date, Quantity, Price)
- Try manual broker selection instead of auto-detect

**Holdings show $0.00**
- You need to manually input current prices (API integration coming in v1.1)
- Holdings show shares and cost basis correctly

## FAQ

**Q: Where is my data stored?**  
A: Locally in your browser's IndexedDB. Never sent to any server.

**Q: Can I use this across multiple devices?**  
A: Not automatically. Use the export/import feature (coming in v1.1) to transfer data.

**Q: Is this tax advice?**  
A: No! This is a calculator only. Consult a tax professional.

**Q: Can I trust the P/L calculations?**  
A: The FIFO algorithm is tested against known values, but always verify against your broker's 1099-B.

## Contributing

This is a personal project, but suggestions welcome! File issues on GitHub.

## License

MIT

## Disclaimer

This software is provided "as-is" for personal use. Not financial or tax advice. 
Always verify P/L calculations against official broker statements.

---

**Built with ❤️ for accurate, private portfolio tracking**
