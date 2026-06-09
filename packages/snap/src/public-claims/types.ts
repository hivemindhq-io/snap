/**
 * Types for the public-claims (escape-hatch) lane.
 *
 * The public-claims lane surfaces ANY stake-weighted claim about a subject
 * (address or domain), UNFILTERED by the viewer's network. It renders ONLY
 * behind the "More info" click and ONLY when such claims exist, so the cold-start
 * empty state stops reading as "nothing here" when the broader community has in
 * fact staked claims the viewer simply isn't connected to.
 *
 * Stake amounts are wei-scale BigInt strings (summed across curves via
 * `sumMarketCap`) so they round-trip through the JSON-serializable insight model.
 *
 * @module public-claims/types
 */

/**
 * A single public claim (triple) about the subject, with its stake-weighted
 * support / opposition and a `disputed` verdict derived from the two.
 */
export type PublicClaim = {
  /** Human-readable predicate label (e.g. "has tag"). */
  predicateLabel: string;
  /** Human-readable object label (e.g. "DeFi Protocol"). */
  objectLabel: string;
  /** Resolved first-class registry key (e.g. 'hasTag'); absent if not first-class. */
  predicateKey?: string;
  /** The triple's term_id — the cross-lane dedup key. */
  termId: string;
  /** Total FOR (support) stake, wei-scale BigInt string. */
  forStake: string;
  /** Total AGAINST (oppose) stake, wei-scale BigInt string. */
  againstStake: string;
  /** Distinct FOR stakers. */
  forStakers: number;
  /** Distinct AGAINST stakers. */
  againstStakers: number;
  /**
   * Whether the claim is contested: AGAINST stake is a meaningful fraction of
   * FOR stake (see PUBLIC_CLAIM_DISPUTE_RATIO_PERCENT). Drives the warning row.
   */
  disputed: boolean;
};

/**
 * The public-claims payload for one subject. `claims` is the displayed (sorted,
 * top-N, post-exclusion) slice; `total` is the TRUE count of claims about the
 * subject so the UI can show "View all N on Hive Mind" when more exist than are
 * shown. Absent/empty `claims` ⇒ the lane renders nothing.
 */
export type PublicClaims = {
  /** The displayed claims, sorted by total stake desc, capped at top-N. */
  claims: PublicClaim[];
  /** The true total number of claims about the subject (for the "View all" line). */
  total: number;
};
