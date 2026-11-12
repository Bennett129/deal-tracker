export type AlertReason = "target" | "all-time-low" | "drop";

export type AlertInput = {
  /** Cheapest price right now. */
  currentCents: number;
  /** Cheapest price at the previous check, or null if this is the first check. */
  previousCents: number | null;
  /** The user's target price, if they set one. */
  targetCents: number | null;
  /** Lowest price CheapShark has ever recorded. */
  cheapestEverCents: number | null;
  /** Price in the last alert this user received for this game, if any. */
  lastAlertedCents: number | null;
};

/** A drop smaller than this share of the previous price is not worth an email. */
export const MIN_DROP_RATIO = 0.05;

/**
 * Decides whether a wishlisted game deserves an alert, and why.
 *
 * - "target": the price is at or below the user's target.
 * - "all-time-low": the price fell and now matches or beats the lowest ever recorded.
 * - "drop": the price fell by at least 5% since the previous check.
 *
 * A price the user has already been told about is never announced again
 * unless the price has gone up and come back down since.
 */
export function evaluateAlert(input: AlertInput): AlertReason | null {
  const { currentCents, previousCents, targetCents, cheapestEverCents, lastAlertedCents } =
    input;

  const dropped = previousCents !== null && currentCents < previousCents;

  if (!dropped && lastAlertedCents !== null && currentCents >= lastAlertedCents) {
    return null;
  }

  if (targetCents !== null && currentCents <= targetCents) {
    // First sighting at target, or it has just fallen to target.
    if (dropped || previousCents === null || lastAlertedCents === null) return "target";
    return null;
  }

  if (!dropped || previousCents === null) return null;

  if (cheapestEverCents !== null && currentCents <= cheapestEverCents) {
    return "all-time-low";
  }

  const ratio = (previousCents - currentCents) / previousCents;
  return ratio >= MIN_DROP_RATIO ? "drop" : null;
}

export function formatUsd(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

export function discountPercent(priceCents: number, retailCents: number): number {
  if (retailCents <= 0 || priceCents >= retailCents) return 0;
  return Math.round((1 - priceCents / retailCents) * 100);
}
