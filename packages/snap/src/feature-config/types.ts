/**
 * Types for remote feature configuration.
 *
 * The snap fetches feature flags from the hivemind API and caches them
 * locally via snap_manageState. These types define the wire format
 * (what the API returns) and the cache envelope (what we persist).
 *
 * @module feature-config/types
 */

/** AI gating parameters that control who can access AI features. */
export interface AIGating {
  /** Minimum native TRUST balance in wei (string for bigint safety). "0" = no balance gate. */
  minNativeBalance: string;
  /** Minimum combined FOR + AGAINST positions required to show AI Summary. */
  minPositionCount: number;
}

/** AI feature configuration block. */
export interface AIConfig {
  /** Master kill switch. When false, all AI features are hidden. */
  enabled: boolean;
  /** Gating parameters applied when AI is enabled. */
  gating: AIGating;
}

/** Shape returned by GET /config/snap on the hivemind API. */
export interface FeatureConfig {
  ai: AIConfig;
  /** Cache TTL in seconds. The snap re-fetches after this period. */
  ttl: number;
}

/** Wrapper stored in snap_manageState with a timestamp for TTL validation. */
export interface CachedFeatureConfig {
  config: FeatureConfig;
  /** Unix timestamp (ms) when this cache entry was written. */
  timestamp: number;
}
