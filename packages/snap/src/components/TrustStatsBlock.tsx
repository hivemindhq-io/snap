/**
 * Shared trust statistics display block.
 *
 * Renders the common trust stats rows (Trustworthy %, Top staker,
 * Majority, Total staked, Stakers, summary) used by both Account
 * and Origin components.
 *
 * @module components/TrustStatsBlock
 */

import { Box, Row, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { stringToDecimal } from '../util';
import {
  formatMarketCap,
  getTrustworthyIcon,
  getTopStakerIcon,
  getTrustSummary,
  positionsToShares,
  calculateTop1Percent,
  getNakamotoDisplay,
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
 * Displays trust statistics rows: Trustworthy %, Top staker, Majority,
 * Total staked, Stakers count, and advisory summary.
 *
 * When total staked is zero, shows a "No stakes yet" fallback.
 *
 * @param props - Raw vault and position data
 * @returns Trust stats JSX block
 */
export const TrustStatsBlock = ({
  supportMarketCap,
  opposeMarketCap,
  positions,
  counterPositions,
}: TrustStatsBlockProps) => {
  const supportMarketCapNative = stringToDecimal(supportMarketCap, 18);
  const opposeMarketCapNative = stringToDecimal(opposeMarketCap, 18);

  const total = supportMarketCapNative + opposeMarketCapNative;
  const trustPercent = total > 0 ? (supportMarketCapNative / total) * 100 : 0;

  const forCount = positions.length;
  const againstCount = counterPositions.length;
  const totalStakers = forCount + againstCount;

  const forShares = positionsToShares(positions);
  const topStakerPercent = calculateTop1Percent(forShares);
  const nakamotoDisplay = getNakamotoDisplay(forShares);

  const trustIcon = total > 0
    ? getTrustworthyIcon(trustPercent)
    : '';
  const topStakerIcon = forShares.length > 0
    ? getTopStakerIcon(topStakerPercent)
    : '';
  const trustSummary = total > 0
    ? getTrustSummary(trustPercent, totalStakers, topStakerPercent)
    : null;

  if (total <= 0) {
    return (
      <Row label="Trustworthy">
        <Text color="muted"><Bold>No stakes yet</Bold></Text>
      </Row>
    );
  }

  return (
    <Box>
      <Row label="Trustworthy">
        <Text>
          <Bold>{`${trustIcon} ${trustPercent.toFixed(0)}%`}</Bold>
        </Text>
      </Row>
      {forShares.length > 0 && (
        <Row label="Top staker">
          <Text>
            <Bold>{topStakerIcon ? `${topStakerIcon} ${topStakerPercent.toFixed(0)}%` : `${topStakerPercent.toFixed(0)}%`}</Bold>
          </Text>
        </Row>
      )}
      {nakamotoDisplay !== null ? (
        <Row label="Majority">
          <Text>
            <Bold>{nakamotoDisplay}</Bold>
          </Text>
        </Row>
      ) : null}
      <Row label="Total staked">
        <Text>
          <Bold>{formatMarketCap(total)}</Bold>
        </Text>
      </Row>
      <Row label="Stakers">
        <Text>
          <Bold>{`${forCount} FOR · ${againstCount} AGAINST`}</Bold>
        </Text>
      </Row>
      {trustSummary ? (
        <Text color="alternative">{trustSummary}</Text>
      ) : null}
    </Box>
  );
};
