/**
 * Shared trust statistics utilities for Account and Origin components.
 *
 * Pure functions and constants used to compute and format trust signals
 * from vault position data. No JSX — see TrustStatsBlock.tsx for the
 * shared display component.
 *
 * @module components/trust-stats
 */

import { chainConfig } from '../config';
import { calculateNakamoto } from '../distribution';

// =============================================================================
// Constants
// =============================================================================

export const MIN_STAKERS_FOR_CONFIDENCE = 3;
export const TOP_STAKER_CONCERN_THRESHOLD = 25;
export const MIN_STAKERS_FOR_NAKAMOTO = 5;
export const NAKAMOTO_WELL_DISTRIBUTED_RATIO = 0.4;
export const NAKAMOTO_GREEN_THRESHOLD = 5;
export const NAKAMOTO_YELLOW_THRESHOLD = 3;

// =============================================================================
// Formatting
// =============================================================================

/**
 * Formats a native-unit market cap value for display with locale separators.
 *
 * @param value - Market cap in native units (already divided by 10^18)
 * @returns Formatted string like "49,375.12 TRUST"
 */
export function formatMarketCap(value: number): string {
  const integerPart = Math.floor(value);
  const fractionalPart = Math.round((value - integerPart) * 100);

  const integerStr = integerPart.toLocaleString();
  const formatted = fractionalPart > 0
    ? `${integerStr}.${fractionalPart.toString().padStart(2, '0')}`
    : integerStr;

  return `${formatted} ${chainConfig.currencySymbol}`;
}

// =============================================================================
// Icons
// =============================================================================

/**
 * Returns a single composite emoji reflecting the weakest trust dimension.
 *
 * Evaluates four independent signals and returns the worst (most cautious)
 * indicator so the user gets an honest at-a-glance risk signal. The advisory
 * text explains *which* dimension triggered the downgrade.
 *
 * Dimensions (each scored 0-2):
 *  - Trust %: 🟢 >= 90%, 🟡 >= 70%, 🔴 < 70%
 *  - Staker count: 🟢 >= 3, 🟡 1-2
 *  - Top-1 concentration: 🟢 < 25%, 🟡 25-74%, 🔴 >= 75%
 *  - Nakamoto (collusion resistance): 🟢 >= 5, 🟡 3-4, 🔴 1-2
 *    Only evaluated when enough stakers exist (>= MIN_STAKERS_FOR_NAKAMOTO).
 *
 * @param trustPercent - Support percentage (0-100)
 * @param totalStakers - Combined FOR + AGAINST staker count
 * @param topStakerPercent - Percentage held by the single largest staker
 * @param nakamotoCount - Minimum entities needed for majority (0 = not computed)
 * @returns '🟢', '🟡', or '🔴'
 */
export function getCompositeIcon(
  trustPercent: number,
  totalStakers: number,
  topStakerPercent: number,
  nakamotoCount: number,
): string {
  const trustLevel = trustPercent >= 90 ? 2 : trustPercent >= 70 ? 1 : 0;
  const stakerLevel = totalStakers >= MIN_STAKERS_FOR_CONFIDENCE ? 2 : 1;
  const concentrationLevel = topStakerPercent >= 75 ? 0 : topStakerPercent >= TOP_STAKER_CONCERN_THRESHOLD ? 1 : 2;

  let worst = Math.min(trustLevel, stakerLevel, concentrationLevel);

  if (nakamotoCount > 0) {
    const nakamotoLevel = nakamotoCount >= NAKAMOTO_GREEN_THRESHOLD ? 2
      : nakamotoCount >= NAKAMOTO_YELLOW_THRESHOLD ? 1
      : 0;
    worst = Math.min(worst, nakamotoLevel);
  }

  if (worst >= 2) return '🟢';
  if (worst >= 1) return '🟡';
  return '🔴';
}

// =============================================================================
// Analysis
// =============================================================================

/**
 * Generates an advisory summary sentence when trust data has concerns,
 * with the total staked amount folded in for context.
 *
 * Returns null only when all signals are healthy (silence = green light).
 *
 * Concerns: disputed (< 90%), sparse (< MIN_STAKERS_FOR_CONFIDENCE),
 * concentrated (>= 25% top staker), collusion-prone (Nakamoto < 3).
 *
 * @param trustPercent - Percentage of support vs total stake
 * @param totalStakers - Combined FOR + AGAINST staker count
 * @param topStakerPercent - Percentage held by the single largest staker
 * @param totalStaked - Total staked amount in native units (already divided by 10^18)
 * @param nakamotoCount - Minimum entities needed for majority (0 = not computed)
 * @returns Advisory string with total staked context, or null if all healthy
 */
export function getTrustSummary(
  trustPercent: number,
  totalStakers: number,
  topStakerPercent: number,
  totalStaked: number,
  nakamotoCount: number,
): string | null {
  const isDisputed = trustPercent < 90;
  const isSparse = totalStakers < MIN_STAKERS_FOR_CONFIDENCE;
  const isConcentrated = topStakerPercent >= TOP_STAKER_CONCERN_THRESHOLD;
  const isCollusionProne = nakamotoCount > 0 && nakamotoCount < NAKAMOTO_YELLOW_THRESHOLD;

  const stakeContext = ` (${formatMarketCap(totalStaked)} total)`;

  if (!isDisputed && !isSparse && !isConcentrated && !isCollusionProne) return null;

  const concerns: string[] = [];
  if (isDisputed) concerns.push('disputed');
  if (isSparse) concerns.push('limited data');
  if (isConcentrated) {
    concerns.push(topStakerPercent > 50 ? 'dominated by one staker' : 'concentrated stake');
  }
  if (isCollusionProne && !isConcentrated) concerns.push('collusion-prone distribution');

  const concern = concerns.length > 0
    ? concerns[0].charAt(0).toUpperCase() + concerns.join(', ').slice(1)
    : 'Concentrated stake distribution';

  return concern + stakeContext;
}

/**
 * Converts position data to shares array for distribution analysis.
 */
export function positionsToShares(
  positions: { shares: string }[],
): number[] {
  return positions.map((p) => parseFloat(p.shares) || 0).filter((s) => s > 0);
}

/**
 * Calculates the percentage held by the single largest position.
 */
export function calculateTop1Percent(shares: number[]): number {
  if (shares.length === 0) return 0;
  const total = shares.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;
  const max = Math.max(...shares);
  return (max / total) * 100;
}

/**
 * Returns a "Majority: N of M stakers" string when concentration is notable.
 * Suppressed when fewer than MIN_STAKERS_FOR_NAKAMOTO stakers or when
 * the ratio of nakamoto/total exceeds NAKAMOTO_WELL_DISTRIBUTED_RATIO
 * (meaning the vault is well-distributed enough that it's unremarkable).
 *
 * @returns Display string or null if suppressed
 */
export function getNakamotoDisplay(shares: number[]): string | null {
  if (shares.length < MIN_STAKERS_FOR_NAKAMOTO) return null;

  const nakamoto = calculateNakamoto(shares);
  if (nakamoto === 0) return null;

  const ratio = nakamoto / shares.length;
  if (ratio > NAKAMOTO_WELL_DISTRIBUTED_RATIO) return null;

  return `${nakamoto} of ${shares.length} stakers`;
}
