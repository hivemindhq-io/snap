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
 * Returns an emoji icon based purely on the trustworthy percentage.
 */
export function getTrustworthyIcon(trustPercent: number): string {
  if (trustPercent >= 90) return '🟢';
  if (trustPercent >= 70) return '🟡';
  return '🔴';
}

/**
 * Returns an emoji icon for the "Top staker" concentration percentage.
 */
export function getTopStakerIcon(topStakerPercent: number): string {
  if (topStakerPercent >= TOP_STAKER_CONCERN_THRESHOLD) return '🟡';
  return '';
}

// =============================================================================
// Analysis
// =============================================================================

/**
 * Generates an advisory summary sentence when trust data has concerns.
 * Returns null when all signals are healthy (silence = green light).
 *
 * Concerns: disputed (< 90%), sparse (< MIN_STAKERS_FOR_CONFIDENCE), concentrated (>= 25% top staker)
 */
export function getTrustSummary(
  trustPercent: number,
  totalStakers: number,
  topStakerPercent: number,
): string | null {
  const isDisputed = trustPercent < 90;
  const isSparse = totalStakers < MIN_STAKERS_FOR_CONFIDENCE;
  const isConcentrated = topStakerPercent >= TOP_STAKER_CONCERN_THRESHOLD;

  if (!isDisputed && !isSparse && !isConcentrated) return null;

  if (isDisputed && isSparse && isConcentrated) return 'Disputed, limited, and concentrated';
  if (isDisputed && isSparse) return 'Disputed with limited data';
  if (isDisputed && isConcentrated) return 'Disputed and dominated by one staker';
  if (isSparse && isConcentrated) return 'Limited data, dominated by one staker';
  if (isDisputed) return 'Trustworthiness is actively disputed';
  if (isSparse) return 'Limited trust data available';
  if (isConcentrated) return 'Trust signal dominated by one staker';

  return null;
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
