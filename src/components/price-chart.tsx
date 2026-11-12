"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { t: number; price: number };

const usd = (value: number) => `$${value.toFixed(2)}`;
const shortDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDate = (t: number) =>
  new Date(t).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function PriceChart({
  points,
  cheapestEver,
}: {
  points: Point[];
  cheapestEver: number | null;
}) {
  const prices = points.map((p) => p.price);
  const low = Math.min(...prices, cheapestEver ?? Infinity);
  const high = Math.max(...prices);
  const pad = Math.max((high - low) * 0.15, 1);

  // Under two days of history: label the axis with times instead of repeating one date.
  const span = points[points.length - 1].t - points[0].t;
  const tick =
    span < 2 * 24 * 60 * 60 * 1000
      ? (t: number) =>
          new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : shortDate;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tick}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[Math.max(0, low - pad), high + pad]}
            tickFormatter={(v: number) => `$${Math.round(v)}`}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            labelFormatter={(label) => fullDate(Number(label))}
            formatter={(value) => [usd(Number(value)), "Best price"]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 13,
            }}
          />
          {cheapestEver !== null && (
            <ReferenceLine
              y={cheapestEver}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `Lowest ever ${usd(cheapestEver)}`,
                position: "insideBottomRight",
                fill: "var(--muted-foreground)",
                fontSize: 12,
              }}
            />
          )}
          <Line
            type="stepAfter"
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={points.length < 30 ? { r: 3, fill: "var(--primary)" } : false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
