/**
 * Types for the Snap safety read surface.
 *
 * The safety surface reads a narrow, safety-and-identity slice of the Intuition
 * trust graph (see docs/claim-surface-spec.md §3-§5) and classifies it into
 * three lanes for rendering:
 *  - critical: hard `reported for` reports from whitelisted authorities (top, danger),
 *  - warnings: trust-circle-gated soft flags + non-critical hard reports,
 *  - provenance: identity/provenance signals (created by / audited by / … / same as).
 *
 * Anonymous claims (no whitelist, no trust-circle overlap) are suppressed.
 *
 * @module safety/types
 */

export type SafetyLane = 'hard' | 'soft' | 'provenance';

export type SafetyEntity = 'eoa' | 'contract';

/** Degree of separation from the viewer. 1 = direct follow / whitelist, 2 = FoaF. */
export type TrustDegree = 1 | 2;

/**
 * How an author relates to the viewer, used for attribution grouping:
 *  - 'authority' = a whitelisted publisher (degree-1, but distinct from a follow),
 *  - 'follow'    = a 1-hop trust-circle contact the viewer follows directly,
 *  - 'extended'  = a 2-hop friend-of-a-friend reachable via the viewer's follows.
 *
 * This splits the otherwise-conflated degree-1 tier (authorities + follows) so
 * the UI can attribute each backer to its true source.
 */
export type SafetySource = 'authority' | 'follow' | 'extended';

/** An account asserting a safety claim, with display attribution. */
export interface SafetyAuthor {
  /** The asserting account's address. */
  accountId: string;
  /** Display label — the account's ENS name, else a truncated hex address. */
  label: string;
  /**
   * How this author relates to the viewer (authority / follow / extended).
   * Drives the per-tier attribution grouping in the safety rows.
   */
  source: SafetySource;
  /**
   * Separation from the viewer. 1 = direct follow / whitelist authority,
   * 2 = extended network (friend-of-a-friend). Absent ⇒ treat as 1.
   */
  degree?: TrustDegree;
  /**
   * For degree-2 authors only: the lowercased addresses of the viewer's direct
   * follows who bridge to this account ("via alice.eth, bob.eth").
   */
  via?: string[];
}

/** A single classified safety signal about the target address. */
export interface SafetySignal {
  /** Stable key (the triple term_id). */
  termId: string;
  lane: SafetyLane;
  /** Human-readable predicate label (e.g. "reported for", "audited by"). */
  predicateLabel: string;
  /** Human-readable object label (e.g. "Drainer", "suspicious", deployer id). */
  objectLabel: string;
  /** Object term ID. */
  objectId: string;
  /** Authors drawn from the whitelist / trust circle (for attribution). */
  attributedAuthors: SafetyAuthor[];
  /** At least one whitelisted authority asserts this. */
  fromWhitelist: boolean;
  /** At least one trust-circle contact asserts this. */
  fromTrustCircle: boolean;
  /**
   * At least one degree-2 (extended-network) contact with ≥ MIN_BRIDGES distinct
   * bridges asserts this. Drives the separate 2nd-degree block; never critical.
   */
  fromExtendedNetwork: boolean;
  /** Whether this is a top-of-screen critical authority report. */
  critical: boolean;
}

/** Categorized safety data attached to the account props for rendering. */
export interface SafetyData {
  /** Critical authority reports — rendered at the very top as danger banners. */
  critical: SafetySignal[];
  /** Soft flags + non-critical hard reports — rendered as caution warnings. */
  warnings: SafetySignal[];
  /** Provenance / identity signals. */
  provenance: SafetySignal[];
}
