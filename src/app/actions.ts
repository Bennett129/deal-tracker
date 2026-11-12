"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { priceSnapshots, wishlistItems } from "@/db/schema";
import { LoginEmail } from "@/emails/templates";
import { createLoginLink, getSession } from "@/lib/auth";
import { getGames, toCents } from "@/lib/cheapshark";
import { sendEmail } from "@/lib/email";
import { SESSION_COOKIE } from "@/lib/session";
import { recordGame } from "@/lib/sync";

export type FormState = { error?: string; success?: string };

const gameIdSchema = z.string().regex(/^\d+$/);

export async function requestLoginLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = z
    .email()
    .max(200)
    .safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Please enter a valid email address." };

  const url = await createLoginLink(email.data);
  try {
    await sendEmail({
      to: email.data,
      subject: "Your Deal Tracker sign-in link",
      react: LoginEmail({ url }),
    });
  } catch (error) {
    console.error("Failed to send sign-in email:", error);
    return { error: "We could not send the email. Please try again." };
  }
  return { success: `Check ${email.data} for your sign-in link.` };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

/** Adds a game to the wishlist, or updates its target price if it is already there. */
export async function saveWishlistItem(
  gameId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!gameIdSchema.safeParse(gameId).success) return { error: "Unknown game." };

  const rawTarget = String(formData.get("target") ?? "").trim();
  let targetCents: number | null = null;
  if (rawTarget !== "") {
    const target = z.coerce.number().positive().max(1000).safeParse(rawTarget);
    if (!target.success) return { error: "Enter a target price like 9.99, or leave it empty." };
    targetCents = toCents(target.data);
  }

  const db = await getDb();
  const [existingSnapshot] = await db
    .select({ id: priceSnapshots.id })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.gameId, gameId))
    .limit(1);

  // First time anyone follows this game: store it with a starting price point.
  if (!existingSnapshot) {
    const [game] = await getGames([gameId]);
    if (!game) return { error: "Unknown game." };
    await recordGame(game);
  }

  await db
    .insert(wishlistItems)
    .values({ userId: session.userId, gameId, targetCents })
    .onConflictDoUpdate({
      target: [wishlistItems.userId, wishlistItems.gameId],
      set: { targetCents },
    });

  refresh();
  return { success: "Saved. We'll email you when the price drops." };
}

export async function removeWishlistItem(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  await db
    .delete(wishlistItems)
    .where(
      and(
        eq(wishlistItems.userId, session.userId),
        eq(wishlistItems.gameId, String(formData.get("gameId") ?? "")),
      ),
    );
  refresh();
}
