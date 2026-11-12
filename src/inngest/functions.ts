import { sendDealAlerts, syncPrices } from "@/lib/sync";
import { inngest } from "./client";

/**
 * Every six hours: snapshot current prices, then email wishlist alerts.
 * Each step is retried on its own, so a mail failure never repeats the price sync.
 */
export const scheduledSync = inngest.createFunction(
  {
    id: "sync-prices-and-alert",
    triggers: [{ cron: "0 */6 * * *" }],
    concurrency: 1,
  },
  async ({ step }) => {
    const synced = await step.run("sync-prices", () => syncPrices());
    const alerts = await step.run("send-deal-alerts", () => sendDealAlerts());
    return { ...synced, ...alerts };
  },
);

export const functions = [scheduledSync];
