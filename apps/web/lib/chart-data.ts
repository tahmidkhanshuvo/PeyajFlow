import type { Forecast, Observation, Advice } from "./pilot-types.ts";

export type ChartPoint = {
  name: string;
  value: number | null;
  low?: number | null;
  high?: number | null;
  fitted?: number | null;
};

export function finiteValue(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function pricePoints(
  rows: Observation[],
  forecast: Forecast | null,
): ChartPoint[] {
  const grouped = new Map<
    string,
    { low: number; high: number; count: number }
  >();
  for (const row of rows) {
    const low = finiteValue(row.low_bdt_kg),
      high = finiteValue(row.high_bdt_kg);
    if (low === null || high === null) continue;
    const previous = grouped.get(row.observed_on) ?? {
      low: 0,
      high: 0,
      count: 0,
    };
    grouped.set(row.observed_on, {
      low: previous.low + low,
      high: previous.high + high,
      count: previous.count + 1,
    });
  }
  const points: ChartPoint[] = [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, row]) => ({
      name,
      value: (row.low + row.high) / (2 * row.count),
      low: row.low / row.count,
      high: row.high / row.count,
    }));
  if (
    forecast &&
    forecast.middle_bdt_kg !== null &&
    !["stale", "insufficient_data"].includes(forecast.status)
  )
    points.push({
      name: forecast.target_on,
      value: finiteValue(forecast.middle_bdt_kg),
      low: finiteValue(forecast.low_bdt_kg),
      high: finiteValue(forecast.high_bdt_kg),
    });
  return points;
}

export function scenarioPoints(advice: Advice, labels: string[]): ChartPoint[] {
  return [
    advice.sell_now_net_bdt,
    advice.hold_low_bdt,
    advice.hold_middle_bdt,
    advice.hold_high_bdt,
  ].map((value, index) => ({ name: labels[index], value: finiteValue(value) }));
}
