/**
 * Cache layer for remote feature configuration.
 *
 * Uses snap_manageState for persistent storage with TTL-based invalidation.
 * Stored under the `_featureConfig` key to avoid collision with
 * trusted-circle address keys (which start with `0x`).
 *
 * @module feature-config/cache
 */

import type { FeatureConfig, CachedFeatureConfig } from './types';

/** Reserved key in the shared snap state object. */
const STATE_KEY = '_featureConfig';

/** Default TTL in seconds when none is provided by the config. */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Checks if a cached config entry is still valid.
 *
 * @param cached - The cached entry with timestamp
 * @param ttlSeconds - TTL from the config payload (overrides default)
 * @returns True if cache is still within its TTL window
 */
function isCacheValid(cached: CachedFeatureConfig, ttlSeconds?: number): boolean {
  const ttl = (ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
  return Date.now() - cached.timestamp < ttl;
}

/**
 * Retrieves the cached feature config from snap state.
 * Returns null if no cache exists or if the TTL has expired.
 *
 * @returns The cached FeatureConfig or null
 */
export async function getFeatureConfigCache(): Promise<FeatureConfig | null> {
  try {
    const state = (await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    })) as Record<string, unknown> | null;

    if (!state) {
      return null;
    }

    const cached = state[STATE_KEY] as CachedFeatureConfig | undefined;
    if (!cached) {
      return null;
    }

    if (!isCacheValid(cached, cached.config.ttl)) {
      return null;
    }

    return cached.config;
  } catch {
    return null;
  }
}

/**
 * Stores a feature config in snap state with the current timestamp.
 *
 * @param config - The FeatureConfig to cache
 */
export async function setFeatureConfigCache(config: FeatureConfig): Promise<void> {
  try {
    const existingState = (await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    })) as Record<string, unknown> | null;

    const entry: CachedFeatureConfig = {
      config,
      timestamp: Date.now(),
    };

    const newState = {
      ...(existingState || {}),
      [STATE_KEY]: entry,
    };

    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: JSON.parse(JSON.stringify(newState)),
      },
    });
  } catch {
    // Cache write failure is non-critical
  }
}
