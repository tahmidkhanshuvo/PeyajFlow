"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Locale } from "../../lib/copy";
import type { ChartPoint } from "../../lib/chart-data";
import { local } from "../../lib/workspace-copy";

export function DataChart({
  locale,
  title,
  summary,
  points,
  unit,
  bars = false,
}: {
  locale: Locale;
  title: string;
  summary: string;
  points: ChartPoint[];
  unit: string;
  bars?: boolean;
}) {
  const id = useId();
  const t = (bn: string, en: string) => local(locale, bn, en);
  const rows = points.map((row) => ({
    ...row,
    band: row.low != null && row.high != null ? [row.low, row.high] : null,
  }));
  const hasFit = rows.some((row) => row.fitted != null);
  if (!rows.some((row) => row.value !== null))
    return (
      <p>
        {t(
          "চিত্রের জন্য যথেষ্ট প্রমাণ নেই।",
          "Insufficient evidence to draw a chart.",
        )}
      </p>
    );
  return (
    <figure className="data-chart" aria-labelledby={id}>
      <figcaption id={id}>
        <h3>{title}</h3>
        <p>{summary}</p>
      </figcaption>
      <div
        aria-hidden="true"
        className="chart-canvas"
        style={{ height: 260, width: "100%", minWidth: 0 }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={rows}
            margin={{ top: 12, right: 16, bottom: 18, left: 5 }}
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={28} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={58}
              domain={["auto", "auto"]}
            />
            <Tooltip />
            {hasFit && (
              <Line
                dataKey="fitted"
                name={t("পরীক্ষামূলক প্রবণতা", "Experimental fit")}
                stroke="#a66d29"
                strokeDasharray="6 4"
                dot={false}
              />
            )}
            {!bars && (
              <Area
                dataKey="band"
                name={t("পরিসর", "Range")}
                stroke="none"
                fill="#9471ad"
                fillOpacity={0.25}
              />
            )}
            {bars ? (
              <Bar dataKey="value" name={unit} fill="#765087" maxBarSize={44} />
            ) : (
              <Line
                dataKey="value"
                name={unit}
                stroke="#765087"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>{t("চিত্রের তথ্য তালিকা", "Chart data table")}</summary>
        <div className="work-table-scroll">
          <table>
            <caption>
              {title} · {unit}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("সময় / বিভাগ", "Date / category")}</th>
                <th scope="col">{unit}</th>
                <th scope="col">{t("নিম্ন", "Low")}</th>
                <th scope="col">{t("উচ্চ", "High")}</th>
                {hasFit && (
                  <th scope="col">
                    {t("পরীক্ষামূলক প্রবণতা", "Experimental fit")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <th scope="row">{row.name}</th>
                  <td>
                    {row.value?.toLocaleString(
                      locale === "bn" ? "bn-BD" : "en-BD",
                    ) ?? "—"}
                  </td>
                  <td>
                    {row.low?.toLocaleString(
                      locale === "bn" ? "bn-BD" : "en-BD",
                    ) ?? "—"}
                  </td>
                  <td>
                    {row.high?.toLocaleString(
                      locale === "bn" ? "bn-BD" : "en-BD",
                    ) ?? "—"}
                  </td>
                  {hasFit && (
                    <td>
                      {row.fitted?.toLocaleString(
                        locale === "bn" ? "bn-BD" : "en-BD",
                      ) ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
