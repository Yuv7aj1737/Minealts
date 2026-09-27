/**
 * Seller dashboard demo data.
 *
 * Promotes an account to SELLER and fills it with listings, orders and a wallet
 * balance, so `/seller/dashboard` can be looked at without hand-writing SQL.
 *
 * This is a **local development helper only**. It is the one place outside the
 * owner review flow that assigns a role, and it is a script you run on purpose
 * — the app itself still only promotes through `reviewSellerApplication`.
 *
 * Run with:
 *   npm run db:demo-seller                       # promote `anurag_is_king`
 *   npm run db:demo-seller -- someuser           # promote someone else
 *   npm run db:demo-seller -- someuser --reset   # wipe the demo data first
 *
 * A missing wallet reads as zero on the dashboard, so the wallet row is created
 * here to make the balance cards show something meaningful.
 */

import { Prisma, PrismaClient } from "@prisma/client";

// `.env.local` is not loaded when this runs directly.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No `.env.local`: fall back to the ambient environment.
}

const prisma = new PrismaClient();

/** Defaults to the account created by the real Discord login during testing. */
const DEFAULT_USERNAME = "anurag_is_king";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const username = args.find((a) => !a.startsWith("--")) ?? DEFAULT_USERNAME;

const DEMO_TAG = "demo";

/** Fixed ids so `--reset` can find exactly what this script created. */
const LISTING_IDS = [
  "demo_listing_1",
  "demo_listing_2",
  "demo_listing_3",
  "demo_listing_4",
  "demo_listing_5",
];

/** Every listing and order this script owns, so `--reset` is exact. */
const DEMO_ORDERS = [
  { id: "demo_order_1", listingIndex: 1, amount: "189.00", status: "DELIVERED" as const },
  { id: "demo_order_2", listingIndex: 2, amount: "64.50", status: "DELIVERED" as const },
  { id: "demo_order_3", listingIndex: 0, amount: "320.00", status: "AWAITING_DELIVERY" as const },
  { id: "demo_order_4", listingIndex: 0, amount: "95.00", status: "PENDING" as const },
];

const money = (value: string) => new Prisma.Decimal(value);

/**
 * A fixed review timestamp.
 *
 * `new Date()` would be re-stamped on every run, so `listed on` and
 * `reviewed on` would drift apart and the demo page would stop looking like a
 * real history.
 */
const REVIEWED_AT = new Date("2026-09-20T12:00:00.000Z");

async function resetDemoData() {
  // Orders reference listings, so they go first.
  const deletedOrders = await prisma.order.deleteMany({
    where: { id: { in: DEMO_ORDERS.map((o) => o.id) } },
  });
  const deletedListings = await prisma.listing.deleteMany({
    where: { id: { in: LISTING_IDS } },
  });
  console.log(`  reset: ${deletedOrders.count} orders, ${deletedListings.count} listings`);
}

async function main() {
  console.log(`Preparing seller demo data for "${username}"...`);

  if (reset) await resetDemoData();

  // `username` is not unique in the schema (Discord display names can repeat),
  // so this is a `findFirst` rather than a `findUnique`. An exact match is
  // preferred if the caller passed a Discord snowflake instead.
  const seller = await prisma.user.findFirst({
    where: { OR: [{ username }, { discordId: username }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, role: true, discordId: true },
  });

  if (!seller) {
    console.error(`\nNo user with username "${username}".`);
    console.error("Sign in through Discord first, or check the name with:");
    console.error('  npx prisma studio   # then browse the `users` table\n');
    process.exitCode = 1;
    return;
  }

  // --- promote --------------------------------------------------------------
  if (seller.role !== "SELLER") {
    // Loud on purpose. This script is the one place that can demote an owner,
    // and silently turning an owner account into a seller is not something to
    // discover later by wondering why /owner stopped working.
    if (seller.role === "OWNER") {
      console.log("  role:  OWNER -> SELLER");
      console.log("         (this demotes the account. Run `npm run db:seed` to put it back.)");
    } else {
      console.log(`  role:  ${seller.role} -> SELLER`);
    }

    await prisma.user.update({ where: { id: seller.id }, data: { role: "SELLER" } });
  } else {
    console.log("  role:  already SELLER");
  }

  // --- wallet ---------------------------------------------------------------
  // `upsert` rather than `create`: running twice must not fail, and an approval
  // must never be the thing that zeroes a balance.
  await prisma.wallet.upsert({
    where: { userId: seller.id },
    create: {
      userId: seller.id,
      availableBalance: money("1242.60"),
      pendingBalance: money("415.00"),
    },
    update: {},
  });
  console.log("  wallet: 1242.60 available / 415.00 pending");

  // --- listings -------------------------------------------------------------
  // One of each status the dashboard can render, so the badges are all visible.
  //
  // `description` and `reviewedAt` matter for Phase 4: the public detail page
  // falls back to an italic "no description" line and a "no recorded review"
  // label when they are absent, and a demo that leaves them null cannot show
  // either state. The ACTIVE listing is therefore stamped as reviewed, and the
  // PROCESSING one deliberately is not.
  const listings = [
    {
      id: LISTING_IDS[0],
      title: "Creeper Rare Account",
      username: "notch_hero",
      price: "320.00",
      status: "ACTIVE" as const,
      description:
        "Full 1.16 account with the paid Creeper Rare skin, three name changes and a clean VAC history. Comes with the email it was registered on, so you can reset the password yourself. No drama, no shared access left behind.",
      reviewed: true,
    },
    {
      id: LISTING_IDS[1],
      title: "Diamond Sword Godly",
      username: "blade_master",
      price: "189.00",
      status: "SOLD" as const,
      description:
        "Godly 1.7.10 diamond sword from a paid crate. Sharpness V, unbreaking III, Fire Aspect II, with a full repair job on it. Delivered in a shulker box.",
      reviewed: true,
    },
    {
      id: LISTING_IDS[2],
      title: "Full Netherite Set",
      username: null,
      price: "64.50",
      status: "SOLD" as const,
      description:
        "Complete netherite armour set, helmet through boots, plus a netherite ingot spare. Used for a couple of weeks of hardcore before the owner switched to a server.",
      reviewed: true,
    },
    {
      id: LISTING_IDS[3],
      title: "Server Slot — 20 Players",
      username: null,
      price: "150.00",
      status: "PROCESSING" as const,
      description:
        "Permanent slot on a 1.20 whitelisted SMP. Bedwars and survival, 20 active regulars, no resets since the start of the year. Whitelist add is instant on purchase.",
      reviewed: false,
    },
    {
      id: LISTING_IDS[4],
      title: "Unused Alt (Starter)",
      username: "fresh_start",
      price: "12.00",
      status: "DRAFT" as const,
      // Deliberately null: proves the "no description yet" state on the detail
      // page instead of only ever showing the happy path.
      description: null,
      reviewed: false,
    },
  ];

  for (const listing of listings) {
    // `update` writes the content as well as the status, so re-running the
    // script upgrades fixtures that were created before a column existed. An
    // `update: {}` would leave stale rows behind forever, which is exactly how
    // "the demo data is wrong and I do not know why" happens.
    await prisma.listing.upsert({
      where: { id: listing.id },
      create: {
        id: listing.id,
        sellerId: seller.id,
        title: `${DEMO_TAG} ${listing.title}`,
        minecraftUsername: listing.username,
        description: listing.description,
        price: money(listing.price),
        status: listing.status,
        reviewedAt: listing.reviewed ? REVIEWED_AT : null,
      },
      update: {
        title: `${DEMO_TAG} ${listing.title}`,
        minecraftUsername: listing.username,
        description: listing.description,
        price: money(listing.price),
        status: listing.status,
        reviewedAt: listing.reviewed ? REVIEWED_AT : null,
      },
    });
  }
  console.log(`  listings: ${listings.length} (one of each status, with descriptions)`);

  // --- orders ---------------------------------------------------------------
  // A buyer that is not the seller, so the relations are real.
  const buyer = await prisma.user.upsert({
    where: { discordId: "100000000000000002" },
    create: {
      discordId: "100000000000000002",
      username: "member",
      displayName: "Demo Member",
      role: "USER",
    },
    update: {},
  });

  for (const order of DEMO_ORDERS) {
    await prisma.order.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        listingId: listings[order.listingIndex].id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: money(order.amount),
        status: order.status,
      },
      update: {},
    });
  }
  console.log(`  orders:  ${DEMO_ORDERS.length} (2 delivered, 1 awaiting, 1 pending)`);

  console.log(`\nDone. Sign in as ${seller.username} and open:`);
  console.log("  http://localhost:3000/seller/dashboard\n");
  console.log("To clear the demo rows again:");
  console.log(`  npm run db:demo-seller -- ${username} --reset\n`);
}

main()
  .catch((error: unknown) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
