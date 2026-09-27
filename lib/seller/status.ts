import type { OrderStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Status labels for the seller dashboard.
 *
 * Listing status metadata now lives in `lib/listings/schema.ts`, where the
 * public marketplace and the owner panel can share it; it is re-exported here
 * so the dashboard keeps one import for "how do I render a badge".
 *
 * Client-safe: type-only Prisma import.
 */

export { LISTING_STATUS_META, SELLER_SHARE_PERCENT } from "@/lib/listings/schema";

export type StatusMeta = {
  label: string;
  tone: BadgeTone;
  description: string;
};

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: {
    label: "Pending",
    tone: "warning",
    description: "Created, not yet acknowledged.",
  },
  AWAITING_DELIVERY: {
    label: "Awaiting delivery",
    tone: "warning",
    description: "Paid — the account still has to be handed over.",
  },
  DELIVERED: {
    label: "Delivered",
    tone: "success",
    description: "Buyer confirmed. Funds have been released.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    description: "Called off before delivery.",
  },
};
