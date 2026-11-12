import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { sendDealAlerts, simulatePriceDrop, syncPrices } from "@/lib/sync";

/**
 * Runs a price sync and sends alerts immediately. The scheduled run goes through
 * Inngest (src/inngest); this endpoint is for `npm run sync` and for plain cron services.
 */
export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.SYNC_SECRET;

  if (secret) {
    const given = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    const matches =
      given.length === expected.length &&
      timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!matches) return Response.json({ error: "Unauthorized" }, { status: 401 });
  } else if (isProduction) {
    return Response.json({ error: "SYNC_SECRET is not configured" }, { status: 401 });
  }

  let simulated = 0;
  if (!isProduction && request.nextUrl.searchParams.get("demo") === "drop") {
    simulated = await simulatePriceDrop();
  }

  const synced = await syncPrices();
  const alerts = await sendDealAlerts();
  return Response.json({ ...synced, ...alerts, simulatedDrops: simulated });
}
