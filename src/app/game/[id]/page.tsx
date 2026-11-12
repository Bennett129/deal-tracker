import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ExternalLink } from "lucide-react";
import { removeWishlistItem } from "@/app/actions";
import { WishlistForm } from "@/components/forms";
import { Price } from "@/components/price";
import { PriceChart } from "@/components/price-chart";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/alerts";
import { getSession } from "@/lib/auth";
import { dealUrl } from "@/lib/cheapshark";
import {
  cachedGame,
  cachedStores,
  getPriceHistory,
  getWishlistItem,
} from "@/lib/data";

export async function generateMetadata({
  params,
}: PageProps<"/game/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = /^\d+$/.test(id) ? await cachedGame(id) : null;
  return { title: game?.title ?? "Game not found" };
}

export default function GamePage(props: PageProps<"/game/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading game…</p>}>
          <Game params={props.params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Game({ params }: Pick<PageProps<"/game/[id]">, "params">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  await connection();

  const [game, stores, history, session] = await Promise.all([
    cachedGame(id),
    cachedStores(),
    getPriceHistory(id),
    getSession(),
  ]);
  if (!game) notFound();

  const storesById = new Map(stores.map((store) => [store.id, store]));
  const wishlistItem = session ? await getWishlistItem(session.userId, id) : null;
  const best = game.deals[0];
  const points = history.map((row) => ({
    t: row.capturedAt.getTime(),
    price: row.priceCents / 100,
  }));

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {game.thumb && (
          <img
            src={game.thumb}
            alt=""
            className="w-full max-w-xs rounded-xl border object-cover"
          />
        )}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {game.title}
          </h1>
          {best ? (
            <>
              <Price priceCents={best.priceCents} retailCents={best.retailCents} size="lg" />
              <p className="text-sm text-muted-foreground">
                Best price now, at {storesById.get(best.storeId)?.name ?? "a partner store"}
                {game.cheapestEverCents !== null &&
                  ` · Lowest ever ${formatUsd(game.cheapestEverCents)}`}
              </p>
              <a
                href={dealUrl(best.dealId)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                Get this deal <ExternalLink aria-hidden />
              </a>
            </>
          ) : (
            <p className="text-muted-foreground">No store is selling this game right now.</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Price history</CardTitle>
            <CardDescription>Best available price at each check.</CardDescription>
          </CardHeader>
          <CardContent>
            {points.length >= 2 ? (
              <PriceChart
                points={points}
                cheapestEver={
                  game.cheapestEverCents !== null ? game.cheapestEverCents / 100 : null
                }
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {points.length === 1
                  ? "Tracking started. The chart appears after the next price check."
                  : "Not tracked yet. Add this game to your wishlist to start recording its price."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{wishlistItem ? "On your wishlist" : "Get a price alert"}</CardTitle>
            <CardDescription>
              We email you when the price drops, hits your target or reaches an
              all-time low.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {session ? (
              <>
                <WishlistForm
                  gameId={id}
                  onWishlist={Boolean(wishlistItem)}
                  targetCents={wishlistItem?.targetCents ?? null}
                />
                {wishlistItem && (
                  <form action={removeWishlistItem}>
                    <input type="hidden" name="gameId" value={id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove from wishlist
                    </Button>
                  </form>
                )}
              </>
            ) : (
              <Link href="/login" className={buttonVariants()}>
                Sign in to add to wishlist
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {game.deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All stores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {game.deals.map((deal) => {
                const store = storesById.get(deal.storeId);
                return (
                  <li
                    key={deal.dealId}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {store && (
                        <img src={store.iconUrl} alt="" className="size-4" loading="lazy" />
                      )}
                      {store?.name ?? `Store ${deal.storeId}`}
                    </span>
                    <span className="flex items-center gap-4">
                      <Price priceCents={deal.priceCents} retailCents={deal.retailCents} />
                      <a
                        href={dealUrl(deal.dealId)}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        View deal
                        <span className="sr-only"> at {store?.name ?? "store"}</span>
                      </a>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
