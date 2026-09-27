/**
 * Site-wide constants. Safe to import from both server and client components:
 * this module must never contain secrets.
 */

export const siteConfig = {
  name: "MineAlts",
  tagline: "The Minecraft marketplace for alt accounts, servers and boosts.",
  description:
    "Buy and sell Minecraft accounts, server slots and boosts on MineAlts. Secure Discord login, trusted sellers, instant delivery.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Single platform currency. See `lib/money.ts`. */
  currency: "INR",
} as const;

export const routes = {
  home: "/",
  login: "/login",
  marketplace: "/marketplace",
  dashboard: "/dashboard",
  owner: "/owner",
  listing: (id: string) => `/listing/${encodeURIComponent(id)}` as const,
  dashboardPages: {
    sellerApplication: "/dashboard/seller-application",
  },
  seller: {
    dashboard: "/seller/dashboard",
    listingsNew: "/seller/listings/new",
    /** Ids are cuid, so `encodeURIComponent` is belt-and-braces, not a filter. */
    listing: (id: string) => `/seller/listings/${encodeURIComponent(id)}` as const,
    listingEdit: (id: string) =>
      `/seller/listings/${encodeURIComponent(id)}/edit` as const,
  },
  ownerPages: {
    sellerApplications: "/owner/seller-applications",
    sellers: "/owner/sellers",
    seller: (id: string) => `/owner/sellers/${encodeURIComponent(id)}` as const,
    listings: "/owner/listings",
  },
  auth: {
    discordStart: "/api/auth/discord",
    discordCallback: "/api/auth/discord/callback",
    session: "/api/auth/session",
    logout: "/api/auth/logout",
  },
} as const;

/** Where users land after a successful Discord login. */
export const DEFAULT_POST_LOGIN_REDIRECT = routes.dashboard;

/** Feature cards for the marketing home page. */
export const marketplaceFeatures = [
  {
    title: "Instant delivery",
    description:
      "Sellers hand over stock through our bot the moment an order clears. No waiting on DMs.",
  },
  {
    title: "Verified sellers",
    description:
      "Every seller is reviewed by our team before they can list. Applications are approved by an owner.",
  },
  {
    title: "Escrow style payouts",
    description:
      "Funds are held until delivery is confirmed, then 94% of the sale is released to the seller.",
  },
  {
    title: "Discord native",
    description:
      "Sign in with Discord. No passwords to store, no plaintext credentials on our side.",
  },
] as const;

/**
 * Roadmap entries, with what is already live marked.
 *
 * `shipped: true` renders a filled tick; `false` renders an open circle. Both
 * states are shown deliberately — a page that ticks everything reads as vapourware
 * and a page that ticks nothing reads as broken.
 */
export const roadmapFeatures = [
  { item: "Discord sign-in and accounts", shipped: true },
  { item: "Roles and permissions", shipped: true },
  { item: "Seller applications", shipped: true },
  { item: "Seller dashboard and wallet summary", shipped: true },
  { item: "Public marketplace and listing pages", shipped: true },
  { item: "Owner seller and listing management", shipped: true },
  { item: "Creating and editing listings", shipped: false },
  { item: "Checkout, orders and delivery", shipped: false },
  { item: "Payouts and the withdrawal ledger", shipped: false },
] as const;
