export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  return `${((Number.isFinite(value) ? value : 0) * 100).toFixed(1)}%`;
}
