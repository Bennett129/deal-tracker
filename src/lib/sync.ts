import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alertsSent,
  games,
  priceSnapshots,
  stores,
  users,
  wishlistItems,
} from "@/db/schema";
import {
  DealAlertEmail,
  alertSubject,
  type AlertEmailItem,
} from "@/emails/templates";
import { evaluateAlert } from "./alerts";
import { betterThumb } from "./data";
import { appUrl } from "./auth";
import {
  MAX_IDS_PER_REQUEST,
  dealUrl,
  getGames,
  getStores,
  getTopDeals,
  type GameDetails,
} from "./cheapshark";
import { sendEmail } from "./email";

/** How many popular games the app follows on its own, so charts are never empty. */
const TRACKED_GAMES = 12;

/** Saves the game and, if it has offers, a snapshot of its cheapest one. */
export async function recordGame(
  game: GameDetails,
  options: { tracked?: boolean } = {},
): Promise<void> {
  const db = await getDb();
  const best = game.deals[0];
  const thumb = await betterThumb(game.thumb);
  const cheapestEver =
    best && (game.cheapestEverCents === null || best.priceCents < game.cheapestEverCents)
      ? best.priceCents
      : game.cheapestEverCents;

  await db
    .insert(games)
    .values({
      id: game.id,
      title: game.title,
      thumb,
      cheapestEverCents: cheapestEver,
      tracked: options.tracked ?? false,
    })
    .onConflictDoUpdate({
      target: games.id,
      set: {
        title: game.title,
        thumb,
        cheapestEverCents: cheapestEver,
        ...(options.tracked ? { tracked: true } : {}),
      },
    });

  if (best) {
    await db.insert(priceSnapshots).values({
      gameId: game.id,
      storeId: best.storeId,
      priceCents: best.priceCents,
      retailCents: best.retailCents,
      dealId: best.dealId,
    });
  }
}

/** Step 1: fetch current prices for every followed game and store a snapshot of each. */
export async function syncPrices(): Promise<{ games: number }> {
  const db = await getDb();

  const storeList = await getStores();
  for (const store of storeList) {
    await db
      .insert(stores)
      .values(store)
      .onConflictDoUpdate({
        target: stores.id,
        set: { name: store.name, iconUrl: store.iconUrl },
      });
  }

  // Follow a handful of popular games so the site has price history from day one.
  const tracked = await db.select({ id: games.id }).from(games).where(eq(games.tracked, true));
  if (tracked.length < TRACKED_GAMES) {
    const top = await getTopDeals(TRACKED_GAMES);
    for (const deal of top) {
      await db
        .insert(games)
        .values({ id: deal.gameId, title: deal.title, thumb: await betterThumb(deal.thumb), tracked: true })
        .onConflictDoUpdate({ target: games.id, set: { tracked: true } });
    }
  }

  const followed = await db
    .selectDistinct({ id: games.id })
    .from(games)
    .leftJoin(wishlistItems, eq(wishlistItems.gameId, games.id))
    .where(or(eq(games.tracked, true), sql`${wishlistItems.userId} is not null`));
  const ids = followed.map((row) => row.id);

  let synced = 0;
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const details = await getGames(ids.slice(i, i + MAX_IDS_PER_REQUEST));
    for (const game of details) {
      await recordGame(game);
      if (game.deals.length > 0) synced++;
    }
  }
  return { games: synced };
}

/** Step 2: email each user one digest of the wishlist games that deserve an alert. */
export async function sendDealAlerts(): Promise<{ emails: number; alerts: number }> {
  const db = await getDb();

  const items = await db
    .select({
      userId: users.id,
      email: users.email,
      gameId: games.id,
      title: games.title,
      cheapestEverCents: games.cheapestEverCents,
      targetCents: wishlistItems.targetCents,
    })
    .from(wishlistItems)
    .innerJoin(users, eq(users.id, wishlistItems.userId))
    .innerJoin(games, eq(games.id, wishlistItems.gameId));
  if (items.length === 0) return { emails: 0, alerts: 0 };

  const storeNames = new Map(
    (await db.select().from(stores)).map((store) => [store.id, store.name]),
  );

  // Latest two snapshots per game
  const gameIds = [...new Set(items.map((item) => item.gameId))];
  const recent = new Map<string, (typeof priceSnapshots.$inferSelect)[]>();
  for (const gameId of gameIds) {
    recent.set(
      gameId,
      await db
        .select()
        .from(priceSnapshots)
        .where(eq(priceSnapshots.gameId, gameId))
        .orderBy(desc(priceSnapshots.capturedAt), desc(priceSnapshots.id))
        .limit(2),
    );
  }

  const digests = new Map<string, { email: string; userId: string; items: (AlertEmailItem & { gameId: string })[] }>();

  for (const item of items) {
    const [latest, previous] = recent.get(item.gameId) ?? [];
    if (!latest) continue;

    const [lastAlert] = await db
      .select()
      .from(alertsSent)
      .where(and(eq(alertsSent.userId, item.userId), eq(alertsSent.gameId, item.gameId)))
      .orderBy(desc(alertsSent.sentAt))
      .limit(1);

    // This snapshot was already announced: running the job twice must not email twice.
    if (lastAlert && lastAlert.sentAt >= latest.capturedAt) continue;

    const reason = evaluateAlert({
      currentCents: latest.priceCents,
      previousCents: previous?.priceCents ?? null,
      targetCents: item.targetCents,
      cheapestEverCents: item.cheapestEverCents,
      lastAlertedCents: lastAlert?.priceCents ?? null,
    });
    if (!reason) continue;

    const digest = digests.get(item.userId) ?? {
      email: item.email,
      userId: item.userId,
      items: [],
    };
    digest.items.push({
      gameId: item.gameId,
      title: item.title,
      reason,
      priceCents: latest.priceCents,
      previousCents: previous?.priceCents ?? null,
      retailCents: latest.retailCents,
      targetCents: item.targetCents,
      storeName: storeNames.get(latest.storeId) ?? "a partner store",
      url: dealUrl(latest.dealId),
    });
    digests.set(item.userId, digest);
  }

  let emails = 0;
  let alerts = 0;
  for (const digest of digests.values()) {
    try {
      await sendEmail({
        to: digest.email,
        subject: alertSubject(digest.items),
        react: DealAlertEmail({ items: digest.items, wishlistUrl: appUrl("/wishlist") }),
      });
    } catch (error) {
      // Not recorded as sent, so it is retried on the next run.
      console.error(`Failed to send deal alert to ${digest.email}:`, error);
      continue;
    }
    await db.insert(alertsSent).values(
      digest.items.map((entry) => ({
        userId: digest.userId,
        gameId: entry.gameId,
        priceCents: entry.priceCents,
      })),
    );
    emails++;
    alerts += digest.items.length;
  }
  return { emails, alerts };
}

/**
 * Development helper for demos and testing: raises the most recent stored price
 * of every wishlisted game by 25%, so the next sync sees a real price as a drop.
 */
export async function simulatePriceDrop(): Promise<number> {
  const db = await getDb();
  const wished = await db.selectDistinct({ gameId: wishlistItems.gameId }).from(wishlistItems);
  const latestIds: number[] = [];
  for (const { gameId } of wished) {
    const [latest] = await db
      .select({ id: priceSnapshots.id })
      .from(priceSnapshots)
      .where(eq(priceSnapshots.gameId, gameId))
      .orderBy(desc(priceSnapshots.capturedAt), desc(priceSnapshots.id))
      .limit(1);
    if (latest) latestIds.push(latest.id);
  }
  if (latestIds.length > 0) {
    await db
      .update(priceSnapshots)
      .set({ priceCents: sql`round(${priceSnapshots.priceCents} * 1.25) + 100` })
      .where(inArray(priceSnapshots.id, latestIds));
  }
  return latestIds.length;
}
