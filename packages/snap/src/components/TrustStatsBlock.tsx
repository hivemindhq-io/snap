/**
 * Trust signal display block.
 *
 * Renders a color-coded headline ("Widely Trusted", "Community Concern",
 * etc.) followed by 1-2 lines of verifiable on-chain facts. Used by both
 * Account and Origin components.
 *
 * The color is determined by the FOR/AGAINST ratio (95/85/70 thresholds)
 * and can be downgraded by distribution concerns (whale domination or
 * thin participation). Every number shown is directly verifiable on-chain.
 *
 * @module components/TrustStatsBlock
 */

import { Box, Row, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { stringToDecimal } from '../util';
import {
  positionsToShares,
  determineTrustTier,
  TIER_EMOJI,
} from './trust-stats';

/**
 * Props for the TrustStatsBlock component.
 * Accepts raw vault/position data and handles all computation internally.
 */
export interface TrustStatsBlockProps {
  /** FOR vault market cap as a string (in wei) */
  supportMarketCap: string;
  /** AGAINST vault market cap as a string (in wei) */
  opposeMarketCap: string;
  /** FOR positions with shares data */
  positions: { shares: string }[];
  /** AGAINST positions with shares data */
  counterPositions: { shares: string }[];
}

/**
 * Displays a trust tier headline with supporting fact lines.
 *
 * Replaces the previous 6-row stats block (Signal/Trustworthy%/Top staker/
 * Majority/Stakers/advisory) with a single cohesive signal: color + headline
 * + evidence. The color is the opinion; the facts are the proof.
 *
 * @param props - Raw vault and position data
 * @returns Trust tier JSX block
 */
export const TrustStatsBlock = ({
  supportMarketCap,
  opposeMarketCap,
  positions,
  counterPositions,
}: TrustStatsBlockProps) => {
  const supportNative = stringToDecimal(supportMarketCap, 18);
  const opposeNative = stringToDecimal(opposeMarketCap, 18);
  const forShares = positionsToShares(positions);
  const againstCount = counterPositions.length;

  const tier = determineTrustTier(supportNative, opposeNative, forShares, againstCount);
  const emoji = TIER_EMOJI[tier.color];

  return (
    <Box>
      <Row label="Trust Signal">
        <Text>
          <Bold>{`${emoji} ${tier.headline}`}</Bold>
        </Text>
      </Row>
      {tier.facts.map((fact, i) => (
        <Text key={`tier-fact-${i}`} color="alternative">{fact}</Text>
      ))}
    </Box>
  );
};
