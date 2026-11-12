import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// All prices are stored as whole US cents.

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One-time sign-in links. Only a hash of the token is stored. */
export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const stores = pgTable("stores", {
  id: text("id").primaryKey(), // CheapShark storeID
  name: text("name").notNull(),
  iconUrl: text("icon_url").notNull(),
});

export const games = pgTable("games", {
  id: text("id").primaryKey(), // CheapShark gameID
  title: text("title").notNull(),
  thumb: text("thumb").notNull().default(""),
  cheapestEverCents: integer("cheapest_ever_cents"),
  /** Followed by the app itself so charts have history before anyone wishlists the game. */
  tracked: boolean("tracked").notNull().default(false),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    targetCents: integer("target_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/** The cheapest deal for a game at the moment of each sync. */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    storeId: text("store_id").notNull(),
    priceCents: integer("price_cents").notNull(),
    retailCents: integer("retail_cents").notNull(),
    dealId: text("deal_id").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_snapshots_game_time").on(t.gameId, t.capturedAt)],
);

/** Record of alert emails, so the same price is not announced twice. */
export const alertsSent = pgTable(
  "alerts_sent",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_sent_user_game").on(t.userId, t.gameId, t.sentAt)],
);

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
