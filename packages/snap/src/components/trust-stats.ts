/**
 * Shared trust statistics utilities for Account and Origin components.
 *
 * Provides the tier-based trust signal system: a single color-coded headline
 * backed by 1-2 lines of verifiable on-chain facts. Pure functions and
 * constants — see TrustStatsBlock.tsx for the display component.
 *
 * @module components/trust-stats
 */

import { chainConfig } from '../config';

// =============================================================================
// Constants
// =============================================================================

/** FOR/AGAINST ratio thresholds for base tier color. */
export const TRUST_RATIO_GREEN = 95;
export const TRUST_RATIO_YELLOW = 85;
export const TRUST_RATIO_ORANGE = 70;

/** Top staker share (%) that triggers a one-tier downgrade. */
export const WHALE_THRESHOLD = 75;

/** Total staker count at or below which triggers a one-tier downgrade. */
export const THIN_PARTICIPATION = 3;

/** Below this staker count the claim is Grey ("Minimal Data"). */
export const MIN_STAKERS_FOR_DATA = 2;

// =============================================================================
// Types
// =============================================================================

export type TierColor = 'green' | 'yellow' | 'orange' | 'red' | 'grey';

/**
 * The computed trust tier for a claim.
 *
 * @property color - One of green/yellow/orange/red/grey
 * @property headline - Short label (e.g. "Widely Trusted")
 * @property facts - 1-2 plain-English lines of verifiable evidence
 */
export interface TrustTier {
  color: TierColor;
  headline: string;
  facts: string[];
}

export const TIER_EMOJI: Record<TierColor, string> = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
  grey: '⚪',
};

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
// Helpers (kept for internal use)
// =============================================================================

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

// =============================================================================
// Tier determination
// =============================================================================

const COLOR_ORDER: TierColor[] = ['green', 'yellow', 'orange', 'red'];

/**
 * Drops a tier color by `steps` positions toward red.
 * Cannot go past red; grey is never an input here.
 */
function downgrade(color: TierColor, steps: number): TierColor {
  const idx = COLOR_ORDER.indexOf(color);
  if (idx === -1) return color;
  return COLOR_ORDER[Math.min(idx + steps, COLOR_ORDER.length - 1)] as TierColor;
}

/**
 * Determines the trust tier for a claim based on ratio, participation,
 * and distribution. Returns a color, headline, and verifiable fact lines.
 *
 * Algorithm:
 *   1. Grey edge cases (no stake or <= 1 staker)
 *   2. Base color from FOR/AGAINST ratio (95/85/70 thresholds)
 *   3. Distribution downgrades: whale (top staker >= 75%) or thin
 *      participation (<= 3 stakers) each drop the color one tier
 *
 * @param supportMarketCap - FOR market cap in native units
 * @param opposeMarketCap - AGAINST market cap in native units
 * @param forShares - Parsed share amounts for FOR positions
 * @param againstCount - Number of AGAINST positions
 * @returns Tier with color, headline, and fact strings
 */
export function determineTrustTier(
  supportMarketCap: number,
  opposeMarketCap: number,
  forShares: number[],
  againstCount: number,
): TrustTier {
  const total = supportMarketCap + opposeMarketCap;
  const forCount = forShares.length;
  const totalStakers = forCount + againstCount;
  const totalFormatted = formatMarketCap(total);

  // --- Step 1: Grey edge cases ---

  if (total <= 0) {
    return {
      color: 'grey',
      headline: 'No Stakes Yet',
      facts: ['No one has rated this yet'],
    };
  }

  if (totalStakers <= 1) {
    return {
      color: 'grey',
      headline: 'Minimal Data',
      facts: [`Only ${totalStakers} backer · ${totalFormatted} total`],
    };
  }

  // --- Step 2: Base color from ratio ---

  const ratio = (supportMarketCap / total) * 100;
  const opposePercent = 100 - ratio;

  let baseColor: TierColor;
  if (ratio >= TRUST_RATIO_GREEN) baseColor = 'green';
  else if (ratio >= TRUST_RATIO_YELLOW) baseColor = 'yellow';
  else if (ratio >= TRUST_RATIO_ORANGE) baseColor = 'orange';
  else baseColor = 'red';

  // --- Step 3: Distribution downgrades ---

  const topStakerPercent = calculateTop1Percent(forShares);
  const isWhale = topStakerPercent >= WHALE_THRESHOLD;
  const isThin = totalStakers <= THIN_PARTICIPATION;

  let downgrades = 0;
  if (isWhale) downgrades++;
  if (isThin) downgrades++;

  const finalColor = downgrade(baseColor, downgrades);

  // --- Headline & facts ---

  return buildTierOutput(
    finalColor,
    ratio,
    opposePercent,
    forCount,
    againstCount,
    totalStakers,
    totalFormatted,
    topStakerPercent,
    isWhale,
    isThin,
    baseColor !== finalColor,
  );
}

/**
 * Constructs the headline and fact lines for a given final tier color.
 *
 * Uses two headline tracks:
 *   - **Sentiment** (ratio-based): "Widely Trusted", "Mostly Positive",
 *     "Mixed Opinions", "Community Concern" — real opposition exists.
 *   - **Confidence** (downgrade-based, no real opposition): "Positive, Few
 *     Signals", "Positive, Low Confidence", "Low Confidence" — the data
 *     is thin or whale-dominated, but nobody actually disagrees.
 *
 * The track is chosen by: if `wasDowngraded` AND the base ratio was strongly
 * positive (>= TRUST_RATIO_YELLOW, meaning little/no opposition), headlines
 * describe a *confidence* problem, not a *sentiment* problem.
 */
function buildTierOutput(
  color: TierColor,
  ratio: number,
  opposePercent: number,
  forCount: number,
  againstCount: number,
  totalStakers: number,
  totalFormatted: string,
  topStakerPercent: number,
  isWhale: boolean,
  isThin: boolean,
  wasDowngraded: boolean,
): TrustTier {
  const ratioStr = `${ratio.toFixed(0)}%`;
  const opposeStr = `${opposePercent.toFixed(0)}%`;

  const isConfidenceTrack = wasDowngraded && ratio >= TRUST_RATIO_YELLOW;

  switch (color) {
    case 'green':
      return {
        color,
        headline: 'Widely Trusted',
        facts: [
          `${ratioStr} positive · ${totalStakers} backers · ${totalFormatted} total`,
        ],
      };

    case 'yellow': {
      const facts = [
        `${ratioStr} positive · ${totalStakers} backers · ${totalFormatted} total`,
      ];
      if (isConfidenceTrack) {
        const headline = 'Positive, Few Signals';
        if (isWhale) facts.push(`1 backer holds ${topStakerPercent.toFixed(0)}% of stake`);
        else if (isThin) facts.push('Very few backers');
        return { color, headline, facts };
      }
      if (againstCount > 0) {
        facts.push(`${opposeStr} opposition from ${againstCount} backer${againstCount > 1 ? 's' : ''}`);
      }
      return { color, headline: 'Mostly Positive', facts };
    }

    case 'orange': {
      if (isConfidenceTrack) {
        const facts = [
          `${ratioStr} positive · ${totalStakers} backers · ${totalFormatted} total`,
        ];
        if (isWhale) facts.push(`1 backer holds ${topStakerPercent.toFixed(0)}% of stake`);
        if (isThin) facts.push('Very few backers');
        return { color, headline: 'Low Confidence', facts };
      }
      const facts: string[] = [];
      if (againstCount > 0) {
        facts.push(`${ratioStr} positive · ${opposeStr} oppose`);
        facts.push(`${forCount} FOR · ${againstCount} AGAINST · ${totalFormatted} total`);
      } else {
        facts.push(`${ratioStr} positive · ${totalStakers} backers · ${totalFormatted} total`);
      }
      return { color, headline: 'Mixed Opinions', facts };
    }

    case 'red': {
      if (isConfidenceTrack) {
        const facts = [
          `${ratioStr} positive · ${totalStakers} backers · ${totalFormatted} total`,
        ];
        if (isWhale) facts.push(`1 backer holds ${topStakerPercent.toFixed(0)}% of stake`);
        if (isThin) facts.push('Very few backers');
        return { color, headline: 'Low Confidence', facts };
      }
      const facts = [
        `Only ${ratioStr} positive · ${opposeStr} oppose`,
        `${forCount} FOR · ${againstCount} AGAINST · ${totalFormatted} total`,
      ];
      return { color, headline: 'Community Concern', facts };
    }

    default:
      return { color, headline: 'No Data', facts: [] };
  }
}
