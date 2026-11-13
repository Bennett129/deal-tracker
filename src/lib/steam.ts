/**
 * CheapShark gives Steam games Steam's 231x87 search-result capsule, which looks
 * blurry at card size. Steam's store API knows the URL of the 460x215 header
 * image; the URL contains a per-image hash, so it cannot be guessed from the capsule.
 */

const STEAM_CAPSULE = /\/steam\/apps\/(\d+)\/(?:[0-9a-f]+\/)?capsule_[^/]+\.jpg/i;

/** The Steam app id if `thumb` is a small Steam capsule, otherwise null. */
export function steamAppIdFromCapsule(thumb: string): string | null {
  return STEAM_CAPSULE.exec(thumb)?.[1] ?? null;
}

/** The 460x215 header image for a Steam app, or null if Steam does not return one. */
export async function fetchSteamHeader(appId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`,
      {
        headers: { "User-Agent": "deal-tracker-demo/0.1", Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as Record<
      string,
      { success: boolean; data?: { header_image?: string } }
    > | null;
    const header = body?.[appId]?.success ? body[appId].data?.header_image : undefined;
    return typeof header === "string" && header.startsWith("https://") ? header : null;
  } catch {
    return null;
  }
}
