const FX_URL = 'https://api.frankfurter.dev/v1/latest';

export async function convertToHomeCurrency(
  value: string,
  fromCurrency: string,
  homeCurrency: string,
): Promise<number> {
  const amount = Number(value);
  if (fromCurrency === homeCurrency) return amount;

  const url = `${FX_URL}?base=${encodeURIComponent(fromCurrency)}&symbols=${encodeURIComponent(homeCurrency)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX lookup ${fromCurrency}->${homeCurrency} failed: HTTP ${res.status}`);

  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[homeCurrency];
  if (typeof rate !== 'number') throw new Error(`No FX rate available for ${fromCurrency}->${homeCurrency}`);

  return Math.round(amount * rate * 100) / 100;
}
