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

/* ---------- CheapShark, cached briefly so page views do not hammer the API ---------- */

export async function cachedTopDeals() {
  "use cache";
  cacheLife("minutes");
  return getTopDeals(24);
}

export async function cachedSearch(title: string) {
  "use cache";
  cacheLife("minutes");
  return searchGames(title);
}

export async function cachedGame(id: string): Promise<GameDetails | null> {
  "use cache";
  cacheLife("minutes");
  const [game] = await getGames([id]);
  return game ?? null;
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
