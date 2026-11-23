import assert from "node:assert/strict";
import test from "node:test";
import { finiteValue, pricePoints, scenarioPoints } from "../lib/chart-data.ts";
import type { Observation, Forecast, Advice } from "../lib/pilot-types.ts";

test("price mapping sorts dates, averages same-day reports and preserves a forecast interval", () => {
  const rows = [
    { observed_on: "2026-11-20", low_bdt_kg: "40", high_bdt_kg: "50" },
    { observed_on: "2026-11-19", low_bdt_kg: "30", high_bdt_kg: "40" },
    { observed_on: "2026-11-20", low_bdt_kg: "42", high_bdt_kg: "52" },
  ] as Observation[];
  const forecast = {
    status: "baseline",
    target_on: "2026-11-28",
    low_bdt_kg: "38",
    middle_bdt_kg: "45",
    high_bdt_kg: "55",
  } as Forecast;
  assert.deepEqual(pricePoints(rows, forecast), [
    { name: "2026-11-19", value: 35, low: 30, high: 40 },
    { name: "2026-11-20", value: 46, low: 41, high: 51 },
    { name: "2026-11-28", value: 45, low: 38, high: 55 },
  ]);
  assert.equal(pricePoints(rows, { ...forecast, status: "stale" }).length, 2);
});

test("missing evidence never becomes a zero and losses can be negative", () => {
  for (const value of [null, undefined, "", "NaN", Infinity])
    assert.equal(finiteValue(value), null);
  const points = scenarioPoints(
    {
      sell_now_net_bdt: "-12.50",
      hold_low_bdt: null,
      hold_middle_bdt: "0",
      hold_high_bdt: "10",
    } as Advice,
    ["now", "low", "middle", "high"],
  );
  assert.deepEqual(
    points.map((row) => row.value),
    [-12.5, null, 0, 10],
  );
});
