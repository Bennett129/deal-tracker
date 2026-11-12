/**
 * Client for the CheapShark API (https://apidocs.cheapshark.com).
 * Free and keyless. Their one condition: links that send users to a deal
 * must go through CheapShark's redirect, which is what `dealUrl` builds.
 */

const API = "https://www.cheapshark.com/api/1.0";
const SITE = "https://www.cheapshark.com";

export type Deal = {
  dealId: string;
  storeId: string;
  priceCents: number;
  retailCents: number;
};

export type GameDetails = {
  id: string;
  title: string;
  thumb: string;
  cheapestEverCents: number | null;
  /** Current offers, cheapest first. */
  deals: Deal[];
};

export type GameSearchResult = {
  id: string;
  title: string;
  thumb: string;
  cheapestCents: number;
  cheapestDealId: string;
};

export type TopDeal = Deal & {
  gameId: string;
  title: string;
  thumb: string;
  steamRatingPercent: number;
};

export type Store = { id: string; name: string; iconUrl: string };

/** "24.99" -> 2499 */
export function toCents(price: string | number): number {
  return Math.round(Number(price) * 100);
}

/** The only kind of link this app uses to send someone to a store. */
export function dealUrl(dealId: string): string {
  // CheapShark returns deal ids already percent-encoded; normalise so it is encoded exactly once.
  return `${SITE}/redirect?dealID=${encodeURIComponent(decodeURIComponent(dealId))}`;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { "User-Agent": "deal-tracker-demo/0.1", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`CheapShark ${response.status} for ${path}`);
  }
  return response.json() as Promise<T>;
}

type RawDeal = { storeID: string; dealID: string; price: string; retailPrice: string };
type RawGame = {
  info: { title: string; thumb: string };
  cheapestPriceEver: { price: string } | null;
  deals: RawDeal[];
};

function parseGame(id: string, raw: RawGame): GameDetails {
  return {
    id,
    title: raw.info.title,
    thumb: raw.info.thumb ?? "",
    cheapestEverCents: raw.cheapestPriceEver
      ? toCents(raw.cheapestPriceEver.price)
      : null,
    deals: raw.deals
      .map((deal) => ({
        dealId: deal.dealID,
        storeId: deal.storeID,
        priceCents: toCents(deal.price),
        retailCents: toCents(deal.retailPrice),
      }))
      .sort((a, b) => a.priceCents - b.priceCents),
  };
}

export const MAX_IDS_PER_REQUEST = 25;

/** Details for up to 25 games in one request. Unknown ids are simply missing from the result. */
export async function getGames(ids: string[]): Promise<GameDetails[]> {
  if (ids.length === 0) return [];
  if (ids.length > MAX_IDS_PER_REQUEST) {
    throw new Error(`getGames accepts at most ${MAX_IDS_PER_REQUEST} ids`);
  }
  if (!ids.every((id) => /^\d+$/.test(id))) throw new Error("Invalid game id");

  // The multi-game endpoint needs at least two ids to return the keyed shape.
  if (ids.length === 1) {
    const raw = await request<RawGame | []>(`/games?id=${ids[0]}`);
    return Array.isArray(raw) || !raw.info ? [] : [parseGame(ids[0], raw)];
  }
  const raw = await request<Record<string, RawGame>>(`/games?ids=${ids.join(",")}`);
  return Object.entries(raw).map(([id, game]) => parseGame(id, game));
}

export async function searchGames(title: string): Promise<GameSearchResult[]> {
  const raw = await request<
    { gameID: string; external: string; thumb: string; cheapest: string; cheapestDealID: string }[]
  >(`/games?title=${encodeURIComponent(title)}&limit=24`);
  return raw.map((game) => ({
    id: game.gameID,
    title: game.external,
    thumb: game.thumb,
    cheapestCents: toCents(game.cheapest),
    cheapestDealId: game.cheapestDealID,
  }));
}

/** Best current deals, one per game. */
export async function getTopDeals(limit = 24): Promise<TopDeal[]> {
  const raw = await request<
    {
      dealID: string;
      storeID: string;
      gameID: string;
      title: string;
      thumb: string;
      salePrice: string;
      normalPrice: string;
      steamRatingPercent: string;
    }[]
  >(`/deals?pageSize=60&sortBy=DealRating&onSale=1`);

  const seen = new Set<string>();
  const deals: TopDeal[] = [];
  for (const deal of raw) {
    if (seen.has(deal.gameID)) continue;
    seen.add(deal.gameID);
    deals.push({
      dealId: deal.dealID,
      storeId: deal.storeID,
      gameId: deal.gameID,
      title: deal.title,
      thumb: deal.thumb,
      priceCents: toCents(deal.salePrice),
      retailCents: toCents(deal.normalPrice),
      steamRatingPercent: Number(deal.steamRatingPercent) || 0,
    });
    if (deals.length === limit) break;
  }
  return deals;
}

export async function getStores(): Promise<Store[]> {
  const raw = await request<
    { storeID: string; storeName: string; isActive: number; images: { icon: string } }[]
  >("/stores");
  return raw
    .filter((store) => store.isActive)
    .map((store) => ({
      id: store.storeID,
      name: store.storeName,
      iconUrl: `${SITE}${store.images.icon}`,
    }));
}
