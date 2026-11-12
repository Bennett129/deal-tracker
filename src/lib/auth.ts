import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { loginTokens, users, type User } from "@/db/schema";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

const TOKEN_TTL_MS = 20 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function appUrl(pathname = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return base.replace(/\/$/, "") + pathname;
}

/** The signed-in user from the session cookie, or null. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
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
