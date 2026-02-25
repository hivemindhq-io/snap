/**
 * Shared trust statistics display block.
 *
 * Renders the common trust stats rows (Signal icon, Trustworthy %,
 * Top staker %, Majority, Stakers, advisory summary) used by both
 * Account and Origin components.
 *
 * The single composite icon reflects the worst of four dimensions
 * (trust %, staker count, top-1 concentration, Nakamoto coefficient)
 * so the user gets an honest at-a-glance signal. Total staked is
 * folded into the advisory text for context.
 *
 * @module components/TrustStatsBlock
 */

import { Box, Row, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { stringToDecimal } from '../util';
import { calculateNakamoto } from '../distribution';
import {
  getCompositeIcon,
  getTrustSummary,
  positionsToShares,
  calculateTop1Percent,
  getNakamotoDisplay,
  MIN_STAKERS_FOR_NAKAMOTO,
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
 * Displays trust statistics rows: a standalone composite Signal icon,
 * Trustworthy %, Top staker %, Majority, Stakers count, and advisory
 * summary (which includes total staked for context).
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
  const nakamotoCount = forShares.length >= MIN_STAKERS_FOR_NAKAMOTO
    ? calculateNakamoto(forShares)
    : 0;
  const nakamotoDisplay = getNakamotoDisplay(forShares);

  const compositeIcon = total > 0
    ? getCompositeIcon(trustPercent, totalStakers, topStakerPercent, nakamotoCount)
    : '';
  const trustSummary = total > 0
    ? getTrustSummary(trustPercent, totalStakers, topStakerPercent, total, nakamotoCount)
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
      <Row label="Signal">
        <Text>
          <Bold>{compositeIcon}</Bold>
        </Text>
      </Row>
      <Row label="Trustworthy">
        <Text>
          <Bold>{`${trustPercent.toFixed(0)}%`}</Bold>
        </Text>
      </Row>
      {forShares.length > 0 && (
        <Row label="Top staker">
          <Text>
            <Bold>{`${topStakerPercent.toFixed(0)}%`}</Bold>
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
