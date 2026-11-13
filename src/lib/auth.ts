import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { loginTokens, users, type User } from "@/db/schema";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

const TOKEN_TTL_MS = 20 * 60 * 1000;
/** At most this many sign-in emails per address while their links are still valid... */
const MAX_LINKS_PER_TTL = 3;
/** ...and never two within this long of each other. */
const MIN_LINK_GAP_MS = 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function appUrl(pathname = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return base.replace(/\/$/, "") + pathname;
}

/** The signed-in user from the session cookie, or null. */
/**
 * The signed-in user, if any. Private-cached because checking the token compares
 * its expiry with the current time, which Next.js only allows during prefetching
 * inside a private cache. The result stays in the visitor's browser, never on the server.
 */
export async function getSession(): Promise<Session | null> {
  "use cache: private";
  cacheLife({ stale: 60 });
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Whether another sign-in email may go to this address now. Stops the form being
 * used to flood someone's inbox. Tokens store only their expiry, so each one's
 * creation time is its expiry minus the TTL.
 */
export async function canSendLoginLink(email: string): Promise<boolean> {
  const db = await getDb();
  const live = await db
    .select({ expiresAt: loginTokens.expiresAt })
    .from(loginTokens)
    .where(and(eq(loginTokens.email, email), gt(loginTokens.expiresAt, new Date())));
  if (live.length >= MAX_LINKS_PER_TTL) return false;
  const newest = Math.max(0, ...live.map((row) => row.expiresAt.getTime() - TOKEN_TTL_MS));
  return Date.now() - newest >= MIN_LINK_GAP_MS;
}

/** Creates a one-time sign-in link for this email address. */
export async function createLoginLink(email: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");

  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, new Date()));
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    email,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  return appUrl(`/auth/verify?token=${token}`);
}

/** Exchanges a sign-in token for a user, creating the account on first use. Tokens work once. */
export async function consumeLoginToken(token: string): Promise<User | null> {
  const db = await getDb();
  const [row] = await db
    .delete(loginTokens)
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(token)),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!row) return null;

  await db.insert(users).values({ email: row.email }).onConflictDoNothing();
  const [user] = await db.select().from(users).where(eq(users.email, row.email));
  return user ?? null;
}
