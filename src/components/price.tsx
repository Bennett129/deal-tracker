import { discountPercent, formatUsd } from "@/lib/alerts";

/** Sale price with the struck-through list price and a discount badge. */
export function Price({
  priceCents,
  retailCents,
  size = "md",
}: {
  priceCents: number;
  retailCents: number;
  size?: "md" | "lg";
}) {
  const discount = discountPercent(priceCents, retailCents);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span
        className={
          size === "lg"
            ? "text-3xl font-semibold tabular-nums"
            : "text-lg font-semibold tabular-nums"
        }
      >
        {formatUsd(priceCents)}
      </span>
      {discount > 0 && (
        <>
          <s className="text-sm text-muted-foreground tabular-nums">
            {formatUsd(retailCents)}
          </s>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
            -{discount}%
          </span>
        </>
      )}
    </span>
  );
}
