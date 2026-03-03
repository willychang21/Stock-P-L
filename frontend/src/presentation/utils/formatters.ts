export const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return '-';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatSignedCurrency = (value?: number) => {
  if (value === undefined || value === null) return '-';
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
};

export const formatPercent = (value?: number, digits = 1) => {
  if (value === undefined || value === null) return '-';
  return `${(value * 100).toFixed(digits)}%`;
};

export const formatSignedPercent = (value?: number, digits = 1) => {
  if (value === undefined || value === null) return '-';
  const pct = (value * 100).toFixed(digits);
  return `${value >= 0 ? '+' : ''}${pct}%`;
};

export const formatNumber = (value?: number, digits = 1) => {
  if (value === undefined || value === null) return '-';
  return value.toFixed(digits);
};

export const formatRange = (low?: number, high?: number) => {
  if (low === undefined || low === null || high === undefined || high === null) {
    return '-';
  }
  return `$${low.toFixed(2)} - $${high.toFixed(2)}`;
};

export const formatShares = (value?: number) => {
  if (value === undefined || value === null) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
};
