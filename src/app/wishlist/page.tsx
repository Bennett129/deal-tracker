import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { removeWishlistItem } from "@/app/actions";
import { WishlistForm } from "@/components/forms";
import { Price } from "@/components/price";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatUsd } from "@/lib/alerts";
import { getSession } from "@/lib/auth";
import { dealUrl } from "@/lib/cheapshark";
import { getWishlist } from "@/lib/data";

export const metadata: Metadata = { title: "Your wishlist" };

export default function WishlistPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">Your wishlist</h1>
        <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
          <Wishlist />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Wishlist() {
  const session = await getSession();
  if (!session) redirect("/login");
  const items = await getWishlist(session.userId);

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        Alerts go to {session.email}.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center">
          <p className="text-muted-foreground">Nothing here yet.</p>
          <Link href="/" className={`${buttonVariants()} mt-4`}>
            Browse deals
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const change =
              item.latest && item.previous
                ? item.latest.priceCents - item.previous.priceCents
                : 0;
            return (
              <li
                key={item.gameId}
                className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center"
              >
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=""
                    loading="lazy"
                    className="aspect-[231/87] w-36 rounded-md object-cover"
                  />
                ) : (
                  <div className="aspect-[231/87] w-36 rounded-md bg-muted" />
                )}

                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/game/${item.gameId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </Link>
                  {item.latest ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Price
                        priceCents={item.latest.priceCents}
                        retailCents={item.latest.retailCents}
                      />
                      {change !== 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-sm tabular-nums ${
                            change < 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {change < 0 ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUp className="size-3.5" aria-hidden />
                          )}
                          {change < 0 ? "Down" : "Up"} {formatUsd(Math.abs(change))} since
                          last check
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No price yet</p>
                  )}
                  {item.cheapestEverCents !== null && (
                    <p className="text-xs text-muted-foreground">
                      Lowest ever {formatUsd(item.cheapestEverCents)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <WishlistForm
                    gameId={item.gameId}
                    onWishlist
                    targetCents={item.targetCents}
                    compact
                  />
                  <div className="flex gap-2">
                    {item.latest && (
                      <a
                        href={dealUrl(item.latest.dealId)}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ size: "sm" })}
                      >
                        Get deal
                      </a>
                    )}
                    <form action={removeWishlistItem}>
                      <input type="hidden" name="gameId" value={item.gameId} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
