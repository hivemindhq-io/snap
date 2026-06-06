/**
 * Types for Trusted Circle feature.
 *
 * The trusted circle represents the accounts the current user follows — i.e.
 * accounts they hold a FOR position on in an `[I] follow [account]` triple.
 *
 * @module trusted-circle/types
 */

/**
 * A trusted contact with minimal display information.
 */
export interface TrustedContact {
  /** The account's wallet address */
  accountId: string;
  /** Display label (address, ENS, or other identifier) */
  label: string;
  /** Shares staked as string (for sorting by stake amount, stored as string for JSON serialization) */
  shares?: string;
}

/**
 * Cached trusted circle data with timestamp for TTL validation.
 */
export interface CachedTrustedCircle {
  /** List of trusted contacts */
  contacts: TrustedContact[];
  /** Timestamp when cache was created (ms since epoch) */
  timestamp: number;
  /**
   * Schema version of the cached payload. Bumped whenever the *definition* of
   * the trust circle changes (e.g. the migration from `[account] has tag →
   * trustworthy` to `[I] follow [account]`). Entries with a missing/mismatched
   * version are treated as invalid so stale pre-migration circles self-heal.
   */
  version?: number;
}

/**
 * State structure stored via snap_manageState.
 * Keyed by user address for multi-account support.
 */
export interface TrustedCircleState {
  /** Map of user address to their cached trusted circle */
  [userAddress: string]: CachedTrustedCircle;
}

/**
 * Contacts from the trusted circle who have positions on a triple.
 * Used to display "Your Trust Circle" section.
 */
export interface TrustedCirclePositions {
  /** Trusted contacts who staked FOR */
  forContacts: TrustedContact[];
  /** Trusted contacts who staked AGAINST */
  againstContacts: TrustedContact[];
}

/**
 * A single claim (triple) that a familiar contact has a position on.
 * Used to show context like "tagged as DeFi Protocol".
 */
export interface ClaimContext {
  /** Human-readable predicate label (e.g., "has tag") */
  predicateLabel: string;
  /** Human-readable object label (e.g., "DeFi Protocol") */
  objectLabel: string;
  /** Resolved first-class registry key (e.g. 'hasTag'); absent if not first-class. */
  predicateKey?: string;
  /**
   * Placement tier resolved from the familiarity vocabulary whitelist.
   *   - `'primary'`   → eligible to render inline (1-hop) and in More info (2-hop).
   *   - `'secondary'` → always demoted to More info, even from a direct follow.
   * Absent ⇒ the claim came through the verbatim escape hatch (no whitelist match
   * anywhere on the subject) and is treated as `'secondary'` by renderers.
   */
  tier?: 'primary' | 'secondary';
}

/**
 * A contact from the user's trust circle who has made any claim
 * about the target address (beyond just "hasTag trustworthy").
 *
 * Displayed in the "Network Familiarity" section to show that
 * people the user trusts have interacted with this address.
 */
export interface FamiliarContact {
  /** The contact's wallet address */
  accountId: string;
  /** Display label (ENS name or truncated address) */
  label: string;
  /** Claims this contact has positions on for the target address */
  claims: ClaimContext[];
  /**
   * Degree of separation. 1 = direct follow (trust circle), 2 = friend-of-a-friend.
   * Absent ⇒ treat as 1 (back-compat with the existing 1-hop familiarity set).
   */
  degree?: TrustDegree;
  /**
   * For degree-2 only: number of distinct bridges (the viewer's direct follows
   * that reach this account). Drives the "via N of your follows" copy and the
   * MIN_BRIDGES gate. Undefined for degree-1.
   */
  bridgeCount?: number;
}

/**
 * Aggregated network familiarity data for an address.
 * Shows trusted contacts who have ANY claim about the address,
 * de-duplicated from the trust circle section.
 */
export interface NetworkFamiliarity {
  /** 1-hop contacts (trust circle) with non-trustworthy claims */
  familiarContacts: FamiliarContact[];
  /** Total number of distinct claims about this address (for context) */
  totalClaimsAboutAddress: number;
  /**
   * 2-hop (friend-of-a-friend) contacts with non-trustworthy claims, gated by
   * MIN_BRIDGES. Rendered in a SEPARATE "Extended Network" subsection, never
   * mixed with `familiarContacts`. Absent/empty ⇒ no 2-hop subsection.
   */
  extendedContacts?: FamiliarContact[];
}

// ────────────────────────────────────────────────────────────────────────────
// Extended network (2-hop "friend-of-a-friend") — see docs/extended-network-spec.md
//
// The extended network is the union of `[F] follow [G]` edges for every direct
// follow `F` in the viewer's OWN 1-hop circle, minus the viewer and minus the
// 1-hop set. Seeds are the viewer's follows only (never the whitelist). Stake is
// never read; bridge count (number of distinct direct follows that reach a FoaF)
// is the only weight. Renders in its own section, gated by MIN_BRIDGES.
// ────────────────────────────────────────────────────────────────────────────

/** Degree of separation from the viewer. 1 = direct follow, 2 = friend-of-a-friend. */
export type TrustDegree = 1 | 2;

/**
 * A 2-hop contact: an account followed by one or more of the viewer's direct
 * follows, but NOT followed by the viewer directly (and not the viewer).
 */
export interface ExtendedContact {
  /** The FoaF's wallet address */
  accountId: string;
  /** Display label (ENS name or truncated hex address) */
  label: string;
  /**
   * Lowercased addresses of the direct follows who bridge to this account.
   * `via.length` is the bridge count — the only trust weight for degree 2.
   */
  via: string[];
}

/** Resolved 2-hop layer for a viewer (excludes self + all direct follows). */
export interface ExtendedNetwork {
  /** FoaF contacts, sorted by bridge count (via.length) desc. */
  contacts: ExtendedContact[];
}

/**
 * Cached extended network with TTL + schema version, tied to the 1-hop
 * timestamp it was derived from so it self-invalidates when the seed set
 * (the 1-hop circle) changes.
 */
export interface CachedExtendedNetwork {
  contacts: ExtendedContact[];
  /** When this extended set was computed (ms since epoch). */
  timestamp: number;
  /**
   * The 1-hop cache `timestamp` this set was derived from. If the 1-hop circle
   * is refreshed (different timestamp), this extended entry is treated as stale.
   */
  derivedFrom: number;
  /** Bumped when the *definition* of the extended layer changes. */
  version?: number;
}

/**
 * State structure for extended-network cache, stored via snap_manageState under
 * a key prefix separate from the 1-hop circle. Keyed by lowercased user address.
 */
export interface ExtendedNetworkState {
  [userAddress: string]: CachedExtendedNetwork;
}
