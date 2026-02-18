/**
 * Distribution Analysis Utilities for Trust Triple Data
 *
 * Calculates distribution metrics (Gini coefficient, concentration) and maps
 * them to color-coded status indicators. The color is calculated internally
 * but only exposed as a status - the UI decides how to display it.
 *
 * @module distribution
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Position data with shares for distribution analysis.
 * Shares should be numeric (already converted from BigInt strings).
 */
export interface PositionWithShares {
  shares: number;
  account_id?: string;
}

/**
 * Aggregate position data from GraphQL.
 */
export interface PositionAggregate {
  count: number;
  sum: { shares: number };
  avg: { shares: number };
}

/**
 * Distribution status levels (4-tier system).
 * Colors are mapped internally but the component receives the status.
 */
export type DistributionStatus =
  | 'well-distributed' // Green  - Healthy, many participants, no dominance
  | 'moderate' // Yellow - Some concentration, but acceptable
  | 'concentrated' // Orange - High concentration, few control majority
  | 'whale-dominated'; // Red    - Single whale or extreme concentration

/**
 * MetaMask Snap color tokens.
 * Maps to the Snap SDK Text component color prop values.
 * Available: 'default', 'alternative', 'muted', 'error', 'success', 'warning'.
 */
export type SnapColor = 'default' | 'alternative' | 'muted' | 'error' | 'success' | 'warning';

/**
 * Color mapping for each distribution status.
 * Uses MetaMask Snap's limited color palette.
 */
export const DISTRIBUTION_SNAP_COLORS: Record<DistributionStatus, SnapColor> = {
  'well-distributed': 'success', // Green
  moderate: 'warning', // Yellow/Amber
  concentrated: 'warning', // Orange (closest available)
  'whale-dominated': 'error', // Red
} as const;

/**
 * Hex colors for SVG rendering (if needed for custom UI).
 */
export const DISTRIBUTION_HEX_COLORS: Record<DistributionStatus, string> = {
  'well-distributed': '#22c55e', // Green-500
  moderate: '#eab308', // Yellow-500
  concentrated: '#f97316', // Orange-500
  'whale-dominated': '#ef4444', // Red-500
} as const;

/**
 * Human-readable labels for each status.
 */
export const DISTRIBUTION_LABELS: Record<DistributionStatus, string> = {
  'well-distributed': 'Well Distributed',
  moderate: 'Moderate',
  concentrated: 'Concentrated',
  'whale-dominated': 'Whale Dominated',
} as const;

/**
 * Short labels for compact display.
 */
export const DISTRIBUTION_SHORT_LABELS: Record<DistributionStatus, string> = {
  'well-distributed': '🟢 Distributed',
  moderate: '🟡 Moderate',
  concentrated: '⚠️ Concentrated',
  'whale-dominated': '⛔️ Whale',
} as const;

/**
 * Full analysis result for a vault's distribution.
 */
export interface DistributionAnalysis {
  /** Gini coefficient (0 = perfect equality, 1 = perfect inequality) */
  gini: number;

  /** Nakamoto coefficient (min stakers to control 51%) */
  nakamoto: number;

  /** Percentage held by top staker (0-100) */
  top1Percent: number;

  /** Percentage held by top 3 stakers (0-100) */
  top3Percent: number;

  /** Total number of stakers with non-zero positions */
  stakerCount: number;

  /** Total shares across all stakers */
  totalShares: number;

  /** Calculated distribution status */
  status: DistributionStatus;

  /** Snap SDK color for the status */
  snapColor: SnapColor;

  /** Hex color for SVG/custom rendering */
  hexColor: string;

  /** Human-readable label */
  label: string;

  /** Short label for compact display */
  shortLabel: string;
}

// =============================================================================
// Gini Coefficient Calculation
// =============================================================================

/**
 * Calculates the Gini coefficient for a set of values.
 *
 * The Gini coefficient measures inequality in a distribution:
 * - 0 = perfect equality (everyone has the same)
 * - 1 = perfect inequality (one person has everything)
 *
 * Uses the relative mean absolute difference formula:
 * G = (Σᵢ Σⱼ |xᵢ - xⱼ|) / (2 × n² × μ)
 *
 * @param values - Array of numeric values (stake amounts)
 * @returns Gini coefficient between 0 and 1
 *
 * @example
 * calculateGini([100, 100, 100]) // Returns 0 (perfect equality)
 * calculateGini([0, 0, 300])     // Returns 0.67 (high inequality)
 * calculateGini([300])           // Returns 0 (single value = no inequality)
 */
export function calculateGini(values: number[]): number {
  // Filter out zero values and handle edge cases
  const nonZeroValues = values.filter((v) => v > 0);
  const n = nonZeroValues.length;

  // Edge cases
  if (n === 0) return 0; // No data
  if (n === 1) return 0; // Single staker = no inequality comparison possible

  const mean = nonZeroValues.reduce((sum, v) => sum + v, 0) / n;
  if (mean === 0) return 0; // All zeros

  // Calculate sum of absolute differences
  let sumDifferences = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const valI = nonZeroValues[i];
      const valJ = nonZeroValues[j];
      if (valI !== undefined && valJ !== undefined) {
        sumDifferences += Math.abs(valI - valJ);
      }
    }
  }

  // Gini = sum of differences / (2 * n² * mean)
  const gini = sumDifferences / (2 * n * n * mean);

  // Clamp to [0, 1] to handle floating point errors
  return Math.max(0, Math.min(1, gini));
}

// =============================================================================
// Nakamoto Coefficient Calculation
// =============================================================================

/**
 * Calculates the Nakamoto coefficient for a set of values.
 *
 * The Nakamoto coefficient is the minimum number of entities
 * required to control 51% of the total.
 *
 * @param values - Array of numeric values (stake amounts)
 * @returns Nakamoto coefficient (integer >= 1, or 0 if no stakes)
 *
 * @example
 * calculateNakamoto([90, 5, 5])     // Returns 1 (top holder has majority)
 * calculateNakamoto([30, 25, 25, 20]) // Returns 2 (top 2 needed for 51%)
 */
export function calculateNakamoto(values: number[]): number {
  const nonZeroValues = values.filter((v) => v > 0);

  if (nonZeroValues.length === 0) return 0;

  const total = nonZeroValues.reduce((sum, v) => sum + v, 0);
  const threshold = total * 0.51;

  // Sort descending
  const sorted = [...nonZeroValues].sort((a, b) => b - a);

  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    const value = sorted[i];
    if (value === undefined) continue;
    cumulative += value;
    if (cumulative >= threshold) {
      return i + 1;
    }
  }

  return sorted.length;
}

// =============================================================================
// Top-N Concentration
// =============================================================================

/**
 * Calculates the percentage held by top N stakers.
 *
 * @param values - Array of numeric values (stake amounts), sorted descending
 * @param n - Number of top stakers to consider
 * @returns Percentage (0-100) held by top N
 */
export function calculateTopNPercent(values: number[], n: number): number {
  const nonZeroValues = values.filter((v) => v > 0);

  if (nonZeroValues.length === 0) return 0;

  const total = nonZeroValues.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  // Sort descending and take top N
  const sorted = [...nonZeroValues].sort((a, b) => b - a);
  const topN = sorted.slice(0, n);
  const topNSum = topN.reduce((sum, v) => sum + v, 0);

  return (topNSum / total) * 100;
}

// =============================================================================
// Distribution Status Determination
// =============================================================================

/**
 * Thresholds for determining distribution status.
 *
 * Uses a combination of Gini coefficient and top-1 concentration
 * to determine the overall health of distribution.
 */
export const DISTRIBUTION_THRESHOLDS = {
  // Gini thresholds
  gini: {
    wellDistributed: 0.35, // Below this = green
    moderate: 0.55, // Below this = yellow
    concentrated: 0.75, // Below this = orange, above = red
  },

  // Top-1 concentration thresholds (as percentage 0-100)
  top1: {
    wellDistributed: 30, // Below 30% = healthy
    moderate: 50, // Below 50% = acceptable
    concentrated: 80, // Below 80% = concerning, above = whale
  },

  // Minimum stakers for meaningful distribution analysis
  minStakersForAnalysis: 3,
} as const;

/**
 * Determines distribution status from Gini and concentration metrics.
 *
 * Priority:
 * 1. If top staker holds >=80%, always "whale-dominated" (red)
 * 2. If 0 stakers, "well-distributed" (neutral — UI shows "No Stakes" separately)
 * 3. If <3 stakers, "concentrated" (1 staker is caught by step 1; 2 stakers
 *    that survive step 1 always have top1 in [50%,80%) — always concentrated)
 * 4. Otherwise, use Gini coefficient thresholds
 *
 * @param gini - Gini coefficient (0-1)
 * @param top1Percent - Percentage held by top staker (0-100)
 * @param stakerCount - Total number of stakers
 * @returns Distribution status
 */
export function determineStatus(
  gini: number,
  top1Percent: number,
  stakerCount: number,
): DistributionStatus {
  const {
    gini: giniThresholds,
    top1: top1Thresholds,
    minStakersForAnalysis,
  } = DISTRIBUTION_THRESHOLDS;

  // Whale check takes priority — any staker count
  if (top1Percent >= top1Thresholds.concentrated) {
    return 'whale-dominated';
  }

  // No stakes = neutral (will show "No Stakes" elsewhere)
  if (stakerCount === 0) {
    return 'well-distributed';
  }

  // Too few stakers for Gini-based analysis.
  // 1 staker is always caught by the whale check above (top1 = 100%).
  // 2 stakers that reach here have top1 in [50%, 80%) — always concentrated.
  if (stakerCount < minStakersForAnalysis) {
    return 'concentrated';
  }

  // Use Gini for nuanced assessment
  if (gini <= giniThresholds.wellDistributed) {
    return 'well-distributed';
  }

  if (gini <= giniThresholds.moderate) {
    return 'moderate';
  }

  if (gini <= giniThresholds.concentrated) {
    return 'concentrated';
  }

  return 'whale-dominated';
}

// =============================================================================
// Main Analysis Functions
// =============================================================================

/**
 * Performs full distribution analysis on an array of share values.
 *
 * @param shares - Array of share amounts (numbers)
 * @returns Complete distribution analysis with status and colors
 *
 * @example
 * const analysis = analyzeShareDistribution([1424, 95, 0.01]);
 * console.log(analysis.status); // 'whale-dominated'
 * console.log(analysis.snapColor); // 'error'
 */
export function analyzeShareDistribution(shares: number[]): DistributionAnalysis {
  const nonZeroShares = shares.filter((v) => v > 0);
  const stakerCount = nonZeroShares.length;
  const totalShares = nonZeroShares.reduce((sum, v) => sum + v, 0);

  // Handle empty case
  if (stakerCount === 0) {
    const status: DistributionStatus = 'well-distributed';
    return {
      gini: 0,
      nakamoto: 0,
      top1Percent: 0,
      top3Percent: 0,
      stakerCount: 0,
      totalShares: 0,
      status,
      snapColor: DISTRIBUTION_SNAP_COLORS[status],
      hexColor: DISTRIBUTION_HEX_COLORS[status],
      label: 'No Stakes',
      shortLabel: 'None',
    };
  }

  // Calculate metrics
  const gini = calculateGini(nonZeroShares);
  const nakamoto = calculateNakamoto(nonZeroShares);
  const top1Percent = calculateTopNPercent(nonZeroShares, 1);
  const top3Percent = calculateTopNPercent(nonZeroShares, 3);

  // Determine status
  const status = determineStatus(gini, top1Percent, stakerCount);

  return {
    gini,
    nakamoto,
    top1Percent,
    top3Percent,
    stakerCount,
    totalShares,
    status,
    snapColor: DISTRIBUTION_SNAP_COLORS[status],
    hexColor: DISTRIBUTION_HEX_COLORS[status],
    label: DISTRIBUTION_LABELS[status],
    shortLabel: DISTRIBUTION_SHORT_LABELS[status],
  };
}

/**
 * Analyzes distribution from positions with shares data.
 *
 * @param positions - Array of position objects with shares
 * @returns Complete distribution analysis
 */
export function analyzePositionDistribution(
  positions: PositionWithShares[],
): DistributionAnalysis {
  const shares = positions.map((p) => p.shares).filter((s) => !isNaN(s) && s > 0);
  return analyzeShareDistribution(shares);
}

/**
 * Estimates distribution from aggregate data when individual positions aren't available.
 *
 * This is an approximation using count, sum, and average to estimate
 * concentration. Less accurate than full position data but works with
 * existing query structure.
 *
 * @param aggregate - Aggregate position data from GraphQL
 * @returns Estimated distribution analysis
 */
export function estimateDistributionFromAggregate(
  aggregate: PositionAggregate | null | undefined,
): DistributionAnalysis {
  if (!aggregate || aggregate.count === 0) {
    return analyzeShareDistribution([]);
  }

  const { count, sum, avg } = aggregate;
  const totalShares = sum?.shares || 0;
  const avgShares = avg?.shares || 0;

  if (count === 0 || totalShares === 0) {
    return analyzeShareDistribution([]);
  }

  // With only count and average, we can't calculate true Gini
  // But we can make a reasonable estimate:
  // - If count = 1, it's a single holder (whale-dominated if significant)
  // - Low count + high total = likely concentrated
  // - High count + moderate total = likely distributed

  // For a rough estimate, we'll assume a power-law distribution
  // and estimate top1 concentration based on count
  let estimatedTop1Percent: number;

  if (count === 1) {
    estimatedTop1Percent = 100;
  } else if (count === 2) {
    // With 2 stakers, assume 70/30 split as estimate
    estimatedTop1Percent = 70;
  } else if (count <= 5) {
    // Power law estimate: top holder has ~50% with few stakers
    estimatedTop1Percent = 100 / Math.sqrt(count);
  } else {
    // More stakers, assume more distributed (~30-40%)
    estimatedTop1Percent = Math.max(20, 100 / Math.pow(count, 0.7));
  }

  // Estimate Gini from count (very rough)
  // Single staker = 0 (no inequality to measure)
  // Few stakers = higher estimated Gini
  let estimatedGini: number;
  if (count === 1) {
    estimatedGini = 0; // Single holder, no comparison
  } else if (count === 2) {
    estimatedGini = 0.5;
  } else if (count <= 5) {
    estimatedGini = 0.6;
  } else if (count <= 10) {
    estimatedGini = 0.5;
  } else {
    estimatedGini = 0.4;
  }

  const status = determineStatus(estimatedGini, estimatedTop1Percent, count);

  return {
    gini: estimatedGini,
    nakamoto: count === 1 ? 1 : Math.ceil(count * 0.3), // Rough estimate
    top1Percent: estimatedTop1Percent,
    top3Percent: Math.min(100, estimatedTop1Percent * 1.3), // Rough estimate
    stakerCount: count,
    totalShares,
    status,
    snapColor: DISTRIBUTION_SNAP_COLORS[status],
    hexColor: DISTRIBUTION_HEX_COLORS[status],
    label: DISTRIBUTION_LABELS[status],
    shortLabel: DISTRIBUTION_SHORT_LABELS[status],
  };
}

// =============================================================================
// Combined Trust + Distribution Analysis
// =============================================================================

/**
 * Trust ratio classification (existing behavior).
 */
export type TrustLevel = 'trusted' | 'mixed' | 'untrusted' | 'no-stakes';

/**
 * Combined trust and distribution analysis for a triple.
 */
export interface TrustDistributionAnalysis {
  /** Overall trust level based on FOR/AGAINST ratio */
  trustLevel: TrustLevel;

  /** Trust ratio as percentage (0-100, where 100 = all FOR) */
  trustRatio: number;

  /** Distribution analysis for FOR (support) vault */
  forDistribution: DistributionAnalysis;

  /** Distribution analysis for AGAINST (counter) vault */
  againstDistribution: DistributionAnalysis;

  /** Combined distribution status (uses the "worse" of the two) */
  overallDistribution: DistributionStatus;

  /** Snap color for overall distribution */
  overallSnapColor: SnapColor;
}

/**
 * Determines trust level from support/oppose market caps.
 * Mirrors existing getTrustInfo logic.
 */
export function determineTrustLevel(
  supportMarketCap: number,
  opposeMarketCap: number,
): { level: TrustLevel; ratio: number } {
  const total = supportMarketCap + opposeMarketCap;

  if (total === 0) {
    return { level: 'no-stakes', ratio: 50 };
  }

  const trustRatio = (supportMarketCap / total) * 100;

  if (trustRatio >= 90) {
    return { level: 'trusted', ratio: trustRatio };
  }
  if (trustRatio >= 70) {
    return { level: 'mixed', ratio: trustRatio };
  }
  return { level: 'untrusted', ratio: trustRatio };
}

/**
 * Gets the "worse" distribution status between two.
 * Used to combine FOR and AGAINST distribution into overall status.
 */
function getWorseDistribution(
  a: DistributionStatus,
  b: DistributionStatus,
): DistributionStatus {
  const order: DistributionStatus[] = [
    'well-distributed',
    'moderate',
    'concentrated',
    'whale-dominated',
  ];

  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);

  return aIndex >= bIndex ? a : b;
}

/**
 * Performs combined trust and distribution analysis for a triple.
 *
 * @param supportMarketCap - FOR vault market cap (as number)
 * @param opposeMarketCap - AGAINST vault market cap (as number)
 * @param forPositions - Positions with shares for FOR vault (optional)
 * @param againstPositions - Positions with shares for AGAINST vault (optional)
 * @param forAggregate - Aggregate data for FOR vault (fallback if no positions)
 * @param againstAggregate - Aggregate data for AGAINST vault (fallback if no positions)
 * @returns Combined trust and distribution analysis
 */
export function analyzeTrustDistribution(
  supportMarketCap: number,
  opposeMarketCap: number,
  forPositions?: PositionWithShares[],
  againstPositions?: PositionWithShares[],
  forAggregate?: PositionAggregate | null,
  againstAggregate?: PositionAggregate | null,
): TrustDistributionAnalysis {
  // Trust level
  const { level: trustLevel, ratio: trustRatio } = determineTrustLevel(
    supportMarketCap,
    opposeMarketCap,
  );

  // Distribution analysis - prefer positions if available, fall back to aggregate
  const forDistribution =
    forPositions && forPositions.length > 0
      ? analyzePositionDistribution(forPositions)
      : estimateDistributionFromAggregate(forAggregate);

  const againstDistribution =
    againstPositions && againstPositions.length > 0
      ? analyzePositionDistribution(againstPositions)
      : estimateDistributionFromAggregate(againstAggregate);

  // Overall distribution is the "worse" of the two
  const overallDistribution = getWorseDistribution(
    forDistribution.status,
    againstDistribution.status,
  );

  return {
    trustLevel,
    trustRatio,
    forDistribution,
    againstDistribution,
    overallDistribution,
    overallSnapColor: DISTRIBUTION_SNAP_COLORS[overallDistribution],
  };
}

