# MineAlts

A Minecraft marketplace — premium dark UI, red primary with a yellow accent, and
**real Discord OAuth2** sign-in.

This repository is the **Phase 1–4 foundation**: authentication, accounts, roles,
permission architecture and security, the **Phase 2 seller application flow**, the
**Phase 3 seller dashboard**, and **Phase 4's public marketplace plus the owner
seller and listing panel**. Checkout, delivery and payouts are deliberately not
built yet.

---

## 1. Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | >= 20.9 (22/24 recommended) | `node -v` |
| PostgreSQL | 12 or newer | any hosted provider works too |
| Discord developer application | — | free, see §5 |

---

## 2. Install

```bash
npm install
npx prisma generate
```

## 3. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env.local      # Windows PowerShell: copy .env.example .env.local
```

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/minealts` |
| `DISCORD_CLIENT_ID` | yes | Discord app → OAuth2 → Client ID |
| `DISCORD_CLIENT_SECRET` | yes | Discord app → OAuth2 → Client Secret (**never** share or commit) |
| `DISCORD_REDIRECT_URI` | yes | Must match a Discord redirect exactly. Local: `http://localhost:3000/api/auth/discord/callback` |
| `AUTH_SECRET` | yes | 32+ random chars used to sign cookies. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SITE_URL` | yes | Site origin, no trailing slash. `http://localhost:3000` locally |

`.env.local` is git-ignored. No secret is ever sent to the browser.

## 4. Database

```bash
npm run db:migrate     # create/apply migrations (dev)
npm run db:deploy      # apply migrations (production, no prompts)
npm run db:seed        # optional: demo OWNER + USER rows
npm run db:studio      # browse data in a GUI
```

The seed prints a reminder: to make **your own** Discord login the owner, put your
Discord user id in `SEED_OWNER_DISCORD_ID` inside `.env.local`, re-run
`npm run db:seed`, then sign in. Roles are never assigned by the login flow.

`npm run db:demo-seller` creates SELLER fixtures for local UI work. It is the one
script outside the owner review flow that writes a role, it only ever runs when you
type it, and it prints a warning if the account it touches is an owner.

## 5. Discord application setup

1. Go to **https://discord.com/developers/applications** → **New Application**.
2. Name it `MineAlts` (or whatever you like).
3. Open **OAuth2 → General Information** and copy:
   - **Client ID** → `DISCORD_CLIENT_ID`
   - **Client Secret** → `DISCORD_CLIENT_SECRET` (click *Reset Secret* if shown only once)
4. Scroll to **Redirects** → **Add Redirect** and add exactly:

   ```
   http://localhost:3000/api/auth/discord/callback
   ```

   For a public deployment add the production equivalent too, e.g.
   `https://your-domain.com/api/auth/discord/callback`, and set
   `DISCORD_REDIRECT_URI` to the same string. It must match character for character.
5. Save. No scopes need to be ticked in the portal — the app requests `identify`
   itself, which is the minimum needed to recognise the user.

## 6. Run it

```bash
npm run dev        # http://localhost:3000
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm run build` | production build |
| `npm start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | lint + typecheck |
| `npx next typegen` | regenerate typed route types after adding a route |

---

## Seller applications (Phase 2)

A member applies to become a seller; an owner accepts or rejects.

| Route | Who | Purpose |
| --- | --- | --- |
| `/dashboard/seller-application` | `USER` | Apply, or view the current application |
| `/owner/seller-applications` | `OWNER` | Review queue with accept / reject |

**Rules the server enforces**

- Only a `USER` may submit, and only an `OWNER` may review. Both are re-checked
  inside the Server Actions, because an action is a public POST endpoint that a
  crafted request can reach without rendering the page.
- The Discord username and ID on an application are **snapshotted from the
  session**, never from the submitted form, so an application cannot be filed on
  someone else's behalf.
- The validation schema is a `strictObject` with no `role`, `userId`, `status` or
  `reviewedById` field, and `validateSellerApplication` rebuilds the payload from
  three whitelisted keys — an injected `role` is dropped before it can reach the
  database.
- The only code path that writes `SELLER` is `reviewSellerApplication`, and the
  value it writes is the string literal `"SELLER"`.
- Acceptance is a compare-and-set inside one transaction, so two owners clicking
  accept at once cannot both succeed, and the status change and the role change
  always land together.
- Promotion is `USER → SELLER` only, so a stale application can never demote an
  existing seller or owner.

**One active application per user** is enforced twice: a readable pre-check, plus
a partial unique index that the application cannot bypass.

```sql
CREATE UNIQUE INDEX "seller_applications_one_pending_per_user"
    ON "seller_applications" ("user_id")
    WHERE "status" = 'PENDING';
```

Because it is scoped to `PENDING`, a rejected member can apply again and every
decision stays on record. It also closes the race where two simultaneous
submissions both pass the pre-check — the second one fails on `P2002`, which the
service maps back to `ALREADY_PENDING`.

### Trying it out

You need two accounts, because one account cannot be both the applicant and the
reviewer. Promote your own login to owner:

```bash
# .env.local -> SEED_OWNER_DISCORD_ID=your-discord-user-id
npm run db:seed
```

Then use a second Discord account (or a private window) to apply as a member, and
your owner account to review.

---

## Seller dashboard (Phase 3)

An approved seller's own corner of the site: metrics, listings, sales and balance.

| Route | Who | Purpose |
| --- | --- | --- |
| `/seller/dashboard` | `SELLER` | Metrics, wallet summary, listings table, sales history |
| `/seller/listings/new` | `SELLER` | **Phase 5 placeholder** — no form, no write path |
| `/seller/listings/[id]` | `SELLER` | Read-only view of one of your own listings |
| `/seller/listings/[id]/edit` | `SELLER` | **Phase 5 placeholder** — no form, no write path |

The dashboard shows Total Sales, Active Listings, Sold Listings, Pending Orders,
Available Balance and Pending Balance, states the seller share as
**"You will receive 94%"**, and links to Create Listing plus quick links to
My Listings, Wallet Summary and Sales History.

### How scoping is enforced

The guard lives in `app/seller/layout.tsx`, so **every** page under `/seller` is
protected by construction — a new seller page cannot ship unprotected. Each page
re-asserts `requireSeller()` as well, so it stays safe if it is ever mounted
outside that layout.

`OWNER` is deliberately **not** admitted. An owner who wants to inspect a seller's
view goes through the owner area, and accepting `OWNER` would hand every owner a
second dashboard that is easy to mistake for their own. A plain `USER` is
redirected to `/dashboard?error=seller_only`, which explains how to apply.

The data layer in `lib/seller/dashboard.server.ts` is the second half of the
defence. **No function in it accepts a seller id** — the `userId` argument *is* the
seller id, and it is only ever filled in from the server session. There is
therefore no parameter a future change could repoint at another seller's rows, and
no way for a query param, form field or header to choose whose data is read.

Two details worth knowing:

- Counts and sums run in the database via `count`/`aggregate`, not by loading rows,
  so the page stays one round trip and its cost does not grow with a seller's
  history.
- `getOwnedListing()` returns `null` both for a missing listing *and* for someone
  else's, and callers turn both into `notFound()`. Keeping them indistinguishable
  is deliberate: a "forbidden" response for a real id would confirm the id exists.

### Money

Amounts are `Decimal(12,2)` and are never coerced to a JavaScript number for
arithmetic — 94/6 splits and balance maths must be exact. `lib/money.ts` converts
only for display.

Revenue and the Total Sales count include **`DELIVERED` orders only**. A pending or
cancelled order has not earned anything, and counting it would put a figure on the
Total Sales card that the balance card then contradicts.

The database also refuses nonsense that Prisma would happily write:

```sql
CHECK (price >= 0)                            -- listings
CHECK (amount >= 0)                           -- orders
CHECK (available_balance >= 0 AND pending_balance >= 0)   -- wallets
```

These sit at the database layer rather than in a form validator because Phase 5 and
Phase 7 will add write paths (imports, refunds, ledger adjustments) that no browser
check covers.

### Wallets are opened on promotion

Accepting a seller application creates the wallet in the **same transaction** as
the role change:

```ts
await tx.user.updateMany({ where: { id, role: "USER" }, data: { role: "SELLER" } });
await tx.wallet.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
```

Inside the transaction is the point: "is a seller" and "has a wallet" become the
same fact instead of two writes that can half-happen. It is an `upsert` with an
empty `update` because `userId` is unique and a manually promoted seller may
already have one — and an approval must never zero an existing balance.

### Trying it out

You need a `SELLER`. The quickest route is the real flow: apply as a member, accept
as an owner. For a throwaway demo account, set the role directly — the dashboard
reads a missing wallet as zero, so it renders without one:

```sql
UPDATE users SET role = 'SELLER' WHERE username = 'your-username';
```

A wallet is only created on promotion, so add one if you want a non-zero balance:

```sql
INSERT INTO wallets (id, user_id, available_balance, pending_balance, updated_at)
VALUES (gen_random_uuid()::text, '<user id>', 1250.00, 40.00, now());
```

---

## Marketplace and owner panel (Phase 4)

The public shop, and the owner tools that decide what appears in it.

| Route | Who | Purpose |
| --- | --- | --- |
| `/marketplace` | anyone | Grid of live listings, search, platform figures |
| `/listing/[id]` | anyone / owner / owning seller | Detail page, sold overlay, seller panel |
| `/owner/sellers` | `OWNER` | Seller directory, suspend / reinstate |
| `/owner/sellers/[id]` | `OWNER` | One seller's balances, standing and every listing |
| `/owner/listings` | `OWNER` | Every listing on the platform, with review actions |

### What is public, and what 404s

Visibility is decided by the `where` clause in `lib/listings/public.server.ts`, not
by hiding things in JSX.

| Status | Grid | Direct link | Notes |
| --- | :-: | :-: | --- |
| `ACTIVE` | ✓ | 200 | The only status that reaches the grid |
| `SOLD` | — | 200 | Shared links show a "Sold" overlay instead of a dead end |
| `DRAFT` | — | **404** | Never published |
| `PROCESSING` | — | **404** | Awaiting owner review |
| `REJECTED` | — | **404** | Internal feedback, not public |
| `REMOVED` | — | **404** | Withdrawn or taken down |

A 404 for a withdrawn listing is deliberate: a page that said "this listing was
removed" would confirm that a guessed id once existed and would tell a scraper which
ids are worth retrying.

A suspended seller's `ACTIVE` listings leave the grid too, so suspension that left
stock on sale would be theatre.

### Owner actions

The form sends **a decision, never a status**.

```ts
DECISION_TRANSITIONS = {
  APPROVE: { from: ["PROCESSING", "REJECTED", "REMOVED"], to: "ACTIVE" },
  REJECT:  { from: ["PROCESSING", "DRAFT"],             to: "REJECTED" },
  REMOVE:  { from: ["ACTIVE", "PROCESSING", "DRAFT", "REJECTED"], to: "REMOVED" },
  RESTORE: { from: ["REMOVED", "REJECTED"],            to: "DRAFT" },
};
```

The service turns the decision into a status, and the write is a compare-and-set
gated on the listing still being in one of the `from` states:

```ts
await prisma.listing.updateMany({
  where: { id: listingId, status: { in: [...transition.from] } },
  data: { status: transition.to, reviewedById: reviewer.id, reviewedAt: now, reviewNote: note },
});
```

So there is no way to ask for an illegal status: the schema is a `strictObject` with
no `status`, `sellerId` or `reviewedById` key, the reviewer comes from the session,
and a `from` state that no longer matches updates zero rows and is reported as a
conflict rather than silently succeeding. Two owners clicking Approve on one row
cannot both win.

**Remove is a state, not a `delete`.** Orders point at listings, and cascading them
away would destroy the delivery history that disputes and payouts get settled from.

**Suspension is a nullable timestamp, not a role change.** `suspendedAt` and
`suspendedReason` on `User` mean it cannot collide with `OWNER`, cannot demote
anyone, and cannot be backdated by a client. `requireSeller()` reads it off the
session — which is re-read from the database on every request — so a suspension takes
effect on the seller's very next request rather than at cookie expiry. Listings are
not touched: they disappear because every public query filters on `suspendedAt`, one
authoritative flag instead of N rows that can drift apart.

The owner area is guarded in `app/owner/layout.tsx`, each page re-asserts
`requireOwner()`, and every Server Action checks the capability again *and* the
service checks it a third time. A Server Action is a public POST endpoint, so the
layout is not a boundary.

The moderation form asks for a reason, and the seller sees it. `suspendedReason` is
carried on the session next to `suspendedAt` and rendered from the session rather
than from `?error=`, so it is there on every visit instead of once on the redirect.
It is rendered as a text node: a `dangerouslySetInnerHTML` there would turn an
owner account into a stored-XSS vector aimed at every seller an owner ever
suspends.

A suspended seller also gets no "Seller dashboard" button. They are still a
`SELLER`, so a role-only check renders a link that `/seller` immediately redirects
back out of — and every link on a page should point somewhere the reader can
actually land.

### Honest numbers

"Approved by an owner" is derived from `reviewedAt`, which is stamped by the action
that actually made a listing live. A listing from before review tracking existed
reads as *"No recorded review"* rather than being quietly grandfathered in as
verified. Every count on the marketplace and in the owner panel is a real
`count`/`groupBy` over the database — there are no seeded ratings, no fake buyer
counts, and no placeholder revenue.

Seller avatars fall back to a local deterministic initial. A public Minecraft skin
service was rejected on purpose: it would hand every seller's username to a third
party on every page view, and it would start serving somebody else's face the day
that service changed.

### Currency

One platform currency, **INR**. There is no `currency` column on `Listing.price` or
on the wallet balances, so every stored amount is rupees and the symbol lives in
`lib/money.ts` (`en-IN`, lakh/crore compact notation) rather than being chosen per
row. A second currency would mean adding that column *and* an FX table.

### Trying it out

```bash
npm run db:demo-seller            # promotes `anurag_is_king` to SELLER with 5 listings
npm run db:demo-seller -- --reset # wipe the demo rows and recreate them
npm run db:seed                   # put the account back to OWNER
```

The fixtures cover one of every status, with real descriptions, so `/marketplace`,
`/listing/[id]`, the sold overlay and the owner review queue all have something to
render. The script prints a loud warning when it demotes an `OWNER`, because that is
the one surprise it can cause.

---

## How sign-in works

1. The user clicks **Continue with Discord** → `GET /api/auth/discord`.
2. We generate a `state` value and a PKCE pair, store them in signed, `httpOnly`,
   `SameSite=Lax` cookies, and redirect to `https://discord.com/oauth2/authorize`
   with `scope=identify`.
3. **Discord** authenticates the user. Your website never sees their password.
4. Discord redirects to `GET /api/auth/discord/callback?code=...&state=...`.
5. We verify `state` against the signed cookie, then server-to-server exchange the
   code using the client secret, fetch the profile from `/users/@me`, upsert the
   `User` row, mint a session, and redirect to `/dashboard`.

### What is stored

Only `discordId`, `username`, `displayName`, `avatar`, `role`, `suspendedAt`,
`suspendedReason`, `createdAt`, `updatedAt`. The Discord access and refresh tokens
are used once and discarded. No email, no password, no guild data.

---

## Security notes

- **Session tokens** are 32 random bytes; the cookie holds the raw token and the
  database stores only its SHA-256 hash, so a database leak cannot be replayed.
- **Cookies** are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- **CSRF** — the OAuth `state` plus a PKCE `S256` challenge; the verifier lives
  in a signed cookie that expires in 10 minutes.
- **Open redirects** — the post-login `next` parameter is only honoured when it is
  a same-origin path (`lib/auth/redirects.ts`). The seller moderation action applies
  the same rule to its own `returnTo`.
- **Authorisation** is server-side. `/dashboard` is guarded in its layout,
  `/seller` requires the `SELLER` role and `/owner` requires `OWNER`, so nested
  pages are protected by construction. Hiding a link in the UI is never the
  security boundary — and a link is only rendered when it would actually resolve,
  so no role is pointed at a page that would bounce it.
- **Owner actions** never accept a status, a role, a reviewer id or a timestamp from
  the client. Decisions are mapped to statuses in code, the reviewer is the session,
  writes are compare-and-set, and the capability is checked in the action *and* the
  service. See the Phase 4 section.
- **Public pages** take no user id, so there is no branch on the session to get
  wrong, and a non-public listing resolves to the same `notFound()` as one that does
  not exist.
- **Role escalation** is impossible through login: the OAuth callback's `upsert`
  deliberately does not write the `role` column, and `create` omits it so the
  schema default `USER` applies.
- **Role escalation** is equally impossible through the seller application flow —
  see the Phase 2 section above for the three independent layers.
- **Logout** is `POST` only, so a cross-site link cannot end a session.
- `server-only` guards every module that touches secrets, so it cannot be pulled
  into a client bundle.

## Permissions

`lib/auth/permissions.ts` is a role → capability matrix. Add a capability there
and both the server guard (`requirePermission`) and the UI read the same source.

| Capability | USER | SELLER | OWNER |
| --- | :-: | :-: | :-: |
| `dashboard:view` | ✓ | ✓ | ✓ |
| `sellerApplication:create` | ✓ | ✓ | ✓ |
| `order:viewOwn`, `wallet:viewOwn` | ✓ | ✓ | ✓ |
| `listing:manageOwn` | | ✓ | ✓ |
| `sellerApplication:review` | | | ✓ |
| `seller:manage` | | | ✓ |
| `listing:manageAll` | | | ✓ |
| `order:manageAll` | | | ✓ |
| `wallet:manageAll` | | | ✓ |
| `owner:view` | | | ✓ |

## Project layout

```
app/
  layout.tsx                 root shell: header, main, footer
  page.tsx                   home
  login/page.tsx             Discord sign-in
  marketplace/page.tsx       public grid, search, platform figures
  listing/[id]/page.tsx      public detail, sold overlay, seller panel
  dashboard/                 protected (guarded in layout)
    layout.tsx
    page.tsx
    seller-application/
      page.tsx               apply for seller / view own application
      SellerApplicationForm.tsx
      actions.ts             submitSellerApplication
  owner/                     owner-only (guarded in layout)
    layout.tsx
    page.tsx                 overview, live modules, planned modules
    seller-applications/
      page.tsx               review queue
      ReviewButtons.tsx
      actions.ts             reviewSellerApplicationAction
    sellers/
      page.tsx               seller directory
      [id]/page.tsx          one seller's profile
      SellerModerationForm.tsx
      actions.ts             moderateSellerAction
    listings/
      page.tsx               every listing, filterable by status
      ListingDecisionForm.tsx
      actions.ts             reviewListingAction
  seller/                    SELLER-only (guarded in layout)
    layout.tsx
    dashboard/page.tsx       metrics, wallet, listings table, sales
    listings/
      new/page.tsx           Phase 5 placeholder
      [id]/page.tsx          read-only listing view
      [id]/edit/page.tsx     Phase 5 placeholder
  api/auth/
    discord/route.ts         start OAuth (state + PKCE)
    discord/callback/route.ts exchange code, upsert user, create session
    session/route.ts         read current session
    logout/route.ts          destroy session (POST)
components/
  ui/                        Button, Card, Badge, Logo, Field
  layout/                    SiteHeader, SiteNav, SiteFooter, Container
  auth/                      DiscordButton, UserMenu, DiscordIcon
  listings/
    MarketplaceCard.tsx      one grid tile
    SellerAvatar.tsx         Discord avatar or a local deterministic initial
lib/
  env.ts                     validated server environment
  db.ts                      Prisma client singleton
  constants.ts               site + route constants
  money.ts                   Decimal-safe INR display formatting
  auth/
    permissions.ts           role -> capability matrix
    guards.ts                requireUser / requireRole / requirePermission / requireSeller / requireOwner
    session.ts               issue, validate, destroy sessions
    discord.ts               OAuth2 endpoints, token exchange, profile fetch
    crypto.ts                tokens, hashing, signed payloads, PKCE
    redirects.ts             open-redirect protection
  services/user.server.ts    find-or-create user from a Discord account
  seller-applications/
    schema.ts                zod contract, status metadata (client-safe)
    service.server.ts        all authorisation + role changes + wallet opening
  seller/
    dashboard.server.ts      session-scoped seller reads
    status.ts                order status labels; re-exports listing metadata
  listings/
    schema.ts                statuses, decision table, zod contracts (client-safe)
    public.server.ts         marketplace + public detail reads, no session
    admin.server.ts          owner-only listing and seller administration
prisma/
  schema.prisma              User, Session, SellerApplication, Listing, Order, Wallet
  migrations/
  seed.ts
  demo-seller.ts             local SELLER fixtures (npm run db:demo-seller)
types/
  auth.ts, discord.ts
```

## Roadmap (not yet built)

Creating and editing listings · Discord delivery bot · checkout, orders and
delivery · payout ledgers · withdrawal and 94% earnings · payout eligibility ·
order and wallet tools for owners.

The `User`/`Session`/`SellerApplication`/`Listing`/`Order`/`Wallet` schema, the
permission matrix, the route guards they sit behind, the public marketplace and the
owner's seller and listing panel are already in place.
