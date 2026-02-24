/**
 * Types for Trusted Circle feature.
 *
 * The trusted circle represents accounts that the current user has staked FOR
 * on trust triples (i.e., accounts they consider trustworthy).
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
}

/**
 * Aggregated network familiarity data for an address.
 * Shows trusted contacts who have ANY claim about the address,
 * de-duplicated from the trust circle section.
 */
export interface NetworkFamiliarity {
  /** Contacts from trust circle with non-trustworthy claims */
  familiarContacts: FamiliarContact[];
  /** Total number of distinct claims about this address (for context) */
  totalClaimsAboutAddress: number;
}

