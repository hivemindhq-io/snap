/**
 * Feature config service.
 *
 * Provides getFeatureConfig() which checks the local cache first,
 * fetches from the hivemind API on miss, and falls back to safe
 * defaults (AI disabled) on any failure.
 *
 * @module feature-config/service
 */

import { chainConfig } from '../config';
import type { FeatureConfig } from './types';
import { getFeatureConfigCache, setFeatureConfigCache } from './cache';

/** Safe defaults returned when the API is unreachable or the cache is empty. */
const DEFAULTS: FeatureConfig = {
  ai: {
    enabled: false,
    gating: {
      minNativeBalance: '0',
      minPositionCount: 3,
    },
  },
  ttl: 300,
};

/**
 * Retrieves the current feature configuration.
 *
 * Resolution order:
 * 1. Local cache (snap_manageState) if within TTL
 * 2. Fresh fetch from hivemind API
 * 3. Safe defaults (AI disabled)
 *
 * @returns The active FeatureConfig
 */
export async function getFeatureConfig(): Promise<FeatureConfig> {
  const cached = await getFeatureConfigCache();
  if (cached) {
    return cached;
  }

  try {
    const url = `${chainConfig.hivemindApiUrl}/config/snap`;
    const response = await fetch(url);

    if (!response.ok) {
      return DEFAULTS;
    }

    const config: FeatureConfig = await response.json();
    await setFeatureConfigCache(config);
    return config;
  } catch {
    return DEFAULTS;
  }
}
