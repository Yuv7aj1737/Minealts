/**
 * Phase 4 — permission architecture.
 *
 * Authorisation is expressed as capabilities rather than role comparisons so
 * that adding a role (or a feature) later never requires touching call sites.
 * Route guards in `lib/auth/guards.ts` and UI affordances both read this map,
 * which keeps "what the button shows" and "what the server allows" in sync.
 */

export const PERMISSIONS = {
  /** Access the signed-in area at all. */
  DASHBOARD_VIEW: "dashboard:view",

  /** Submit a request to become a seller. */
  SELLER_APPLICATION_CREATE: "sellerApplication:create",

  /** Approve or reject a seller application. Owner only. */
  SELLER_APPLICATION_REVIEW: "sellerApplication:review",

  /** Suspend, reinstate or change a seller's role. Owner only. */
  SELLER_MANAGE: "seller:manage",

  /** Create and edit listings. */
  LISTING_MANAGE_OWN: "listing:manageOwn",

  /** Edit or remove any listing, including other sellers'. Owner only. */
  LISTING_MANAGE_ALL: "listing:manageAll",

  /** View and act on any order. Owner only. */
  ORDER_MANAGE_ALL: "order:manageAll",

  /** View one's own orders. */
  ORDER_VIEW_OWN: "order:viewOwn",

  /** View one's own wallet, ledger and balances. */
  WALLET_VIEW_OWN: "wallet:viewOwn",

  /** Move funds, edit any ledger entry, force payouts. Owner only. */
  WALLET_MANAGE_ALL: "wallet:manageAll",

  /** Read the owner admin area. */
  OWNER_AREA_VIEW: "owner:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = ["USER", "SELLER", "OWNER"] as const;
export type RoleName = (typeof ROLES)[number];

/**
 * Role -> capability matrix.
 *
 * The `USER` entry is not an empty set: a regular member legitimately needs
 * to browse the dashboard and apply to become a seller.
 */
const ROLE_PERMISSIONS: Record<RoleName, ReadonlySet<Permission>> = {
  USER: new Set<Permission>([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDER_VIEW_OWN,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.SELLER_APPLICATION_CREATE,
  ]),

  SELLER: new Set<Permission>([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDER_VIEW_OWN,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.SELLER_APPLICATION_CREATE,
    PERMISSIONS.LISTING_MANAGE_OWN,
  ]),

  OWNER: new Set<Permission>([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDER_VIEW_OWN,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.SELLER_APPLICATION_CREATE,
    PERMISSIONS.LISTING_MANAGE_OWN,
    PERMISSIONS.SELLER_APPLICATION_REVIEW,
    PERMISSIONS.SELLER_MANAGE,
    PERMISSIONS.LISTING_MANAGE_ALL,
    PERMISSIONS.ORDER_MANAGE_ALL,
    PERMISSIONS.WALLET_MANAGE_ALL,
    PERMISSIONS.OWNER_AREA_VIEW,
  ]),
};

export function permissionsForRole(role: RoleName): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.USER;
}

export function can(role: RoleName, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export function canAny(role: RoleName, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function canAll(role: RoleName, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** Human-readable role label for the UI. */
export const ROLE_LABELS: Record<RoleName, string> = {
  USER: "Member",
  SELLER: "Seller",
  OWNER: "Owner",
};
