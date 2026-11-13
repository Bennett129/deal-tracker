import "server-only";
import { cacheLife } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { games, priceSnapshots, wishlistItems } from "@/db/schema";
import {
  getGames,
  getStores,
  getTopDeals,
  searchGames,
  type GameDetails,
} from "./cheapshark";
import { fetchSteamHeader, steamAppIdFromCapsule } from "./steam";

/* ---------- Thumbnails ---------- */

/** Steam header images rarely change, so each app is looked up at most once a day. */
async function cachedSteamHeader(appId: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  return fetchSteamHeader(appId);
}

/** Swaps a small Steam capsule for the larger header image; anything else is returned as is. */
export async function betterThumb(thumb: string): Promise<string> {
  const appId = steamAppIdFromCapsule(thumb);
  if (!appId) return thumb;
  return (await cachedSteamHeader(appId)) ?? thumb;
}

async function withBetterThumbs<T extends { thumb: string }>(items: T[]): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, thumb: await betterThumb(item.thumb) })),
  );
}

/* ---------- CheapShark, cached briefly so page views do not hammer the API ---------- */

export async function cachedTopDeals() {
  "use cache";
  cacheLife("minutes");
  return withBetterThumbs(await getTopDeals(24));
}

export async function cachedSearch(title: string) {
  "use cache";
  cacheLife("minutes");
  return withBetterThumbs(await searchGames(title));
}

export async function cachedGame(id: string): Promise<GameDetails | null> {
  "use cache";
  cacheLife("minutes");
  const [game] = await getGames([id]);
  return game ? { ...game, thumb: await betterThumb(game.thumb) } : null;
}

export async function cachedStores() {
  "use cache";
  cacheLife("days");
  return getStores();
}

/* ---------- Database ---------- */

export async function getPriceHistory(gameId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      capturedAt: priceSnapshots.capturedAt,
      priceCents: priceSnapshots.priceCents,
    })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.gameId, gameId))
    .orderBy(desc(priceSnapshots.capturedAt))
    .limit(500);
  return rows.reverse();
}

export async function getWishlistItem(userId: string, gameId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.gameId, gameId)));
  return row ?? null;
}

export async function getWishlist(userId: string) {
  const db = await getDb();
  const items = await db
    .select({
      gameId: games.id,
      title: games.title,
      thumb: games.thumb,
      cheapestEverCents: games.cheapestEverCents,
      targetCents: wishlistItems.targetCents,
    })
    .from(wishlistItems)
    .innerJoin(games, eq(games.id, wishlistItems.gameId))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(asc(games.title));

  return Promise.all(
    items.map(async (item) => {
      const [latest, previous] = await db
        .select()
        .from(priceSnapshots)
        .where(eq(priceSnapshots.gameId, item.gameId))
        .orderBy(desc(priceSnapshots.capturedAt), desc(priceSnapshots.id))
        .limit(2);
      return { ...item, latest: latest ?? null, previous: previous ?? null };
    }),
  );
}
