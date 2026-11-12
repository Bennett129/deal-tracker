import { Suspense } from "react";
import Link from "next/link";
import { Search, TrendingDown } from "lucide-react";
import { logout } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export function SiteHeader({ query = "" }: { query?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingDown className="size-4" aria-hidden />
          </span>
          Deal Tracker
        </Link>

        <form action="/" className="order-last flex w-full flex-1 sm:order-none sm:w-auto">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search games</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search PC games…"
              className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </form>

        <nav className="ml-auto flex items-center gap-2">
          <Suspense fallback={null}>
            <UserNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserNav() {
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/login" className={buttonVariants()}>
        Sign in
      </Link>
    );
  }
  return (
    <>
      <Link href="/wishlist" className={buttonVariants({ variant: "ghost" })}>
        Wishlist
      </Link>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        Prices and deal links are provided by{" "}
        <a
          href="https://www.cheapshark.com"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          CheapShark
        </a>
        . Prices are in US dollars and are checked every six hours.
      </div>
    </footer>
  );
}
