import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Price } from "@/components/price";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { cachedSearch, cachedStores, cachedTopDeals } from "@/lib/data";

export default function HomePage(props: PageProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteHeader />}>
        <HeaderWithQuery searchParams={props.searchParams} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Suspense fallback={<GridSkeleton />}>
          <Results searchParams={props.searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

type SearchParams = Pick<PageProps<"/">, "searchParams">;

async function readQuery({ searchParams }: SearchParams): Promise<string> {
  const { q } = await searchParams;
  return typeof q === "string" ? q.trim().slice(0, 80) : "";
}

async function HeaderWithQuery(props: SearchParams) {
  return <SiteHeader query={await readQuery(props)} />;
}

async function Results(props: SearchParams) {
  const query = await readQuery(props);
  await connection();
  return query ? <SearchResults query={query} /> : <TopDeals />;
}

async function TopDeals() {
  const [deals, stores] = await Promise.all([cachedTopDeals(), cachedStores()]);
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));

  return (
    <>
      <section className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Never miss a PC game sale again.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Prices from 30+ stores, checked every six hours. Add games to your
          wishlist and get an email the moment they drop.
        </p>
      </section>

      <h2 className="mb-4 text-lg font-semibold">Top deals right now</h2>
      <Grid>
        {deals.map((deal) => (
          <GameCard
            key={deal.gameId}
            id={deal.gameId}
            title={deal.title}
            thumb={deal.thumb}
            priceCents={deal.priceCents}
            retailCents={deal.retailCents}
            note={storeNames.get(deal.storeId)}
          />
        ))}
      </Grid>
    </>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await cachedSearch(query);

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Results for “{query}”
      </h1>
      {results.length === 0 ? (
        <p className="text-muted-foreground">
          No games found. Try a shorter or different title.
        </p>
      ) : (
        <Grid>
          {results.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              thumb={game.thumb}
              priceCents={game.cheapestCents}
              retailCents={game.cheapestCents}
              note="Best price"
            />
          ))}
        </Grid>
      )}
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function GameCard(props: {
  id: string;
  title: string;
  thumb: string;
  priceCents: number;
  retailCents: number;
  note?: string;
}) {
  return (
    <Link
      href={`/game/${props.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="aspect-[231/87] w-full overflow-hidden bg-muted">
        {props.thumb && (
          <img
            src={props.thumb}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{props.title}</h3>
        <div className="mt-auto pt-1">
          <Price priceCents={props.priceCents} retailCents={props.retailCents} />
        </div>
        {props.note && (
          <p className="text-xs text-muted-foreground">{props.note}</p>
        )}
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <Grid>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border bg-card" />
      ))}
    </Grid>
  );
}
