const DEFAULT_PRICE_PER_PAGE_EUR = 0.39;
const DEFAULT_MINIMUM_PAGES = 10;

export function getPricePerPageEur(): number {
  const raw = process.env.PRICE_PER_PAGE_EUR;
  if (!raw) return DEFAULT_PRICE_PER_PAGE_EUR;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PRICE_PER_PAGE_EUR;
}

export function getMinimumPages(): number {
  const raw = process.env.MINIMUM_PAGES;
  if (!raw) return DEFAULT_MINIMUM_PAGES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MINIMUM_PAGES;
}

export function getPricePerPageCents(): number {
  return Math.round(getPricePerPageEur() * 100);
}

export function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
