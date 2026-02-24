import {
  Box,
  Row,
  Text,
  Heading,
  Section,
  Bold,
  Link,
} from '@metamask/snaps-sdk/jsx';
import { OriginType, PropsForOriginType } from '../types';
import { stringToDecimal } from '../util';
import { chainConfig } from '../config';
import { calculateNakamoto } from '../distribution';
import { TrustedCircleSection } from './TrustedCircle';
import { UserPositionSection } from './UserPosition';
import { vendor } from '../vendors';

const MIN_STAKERS_FOR_CONFIDENCE = 3;
const TOP_STAKER_CONCERN_THRESHOLD = 25;
const MIN_STAKERS_FOR_NAKAMOTO = 5;
const NAKAMOTO_WELL_DISTRIBUTED_RATIO = 0.4;

/**
 * Formats a native-unit market cap value for display with locale separators.
 *
 * @param value - Market cap in native units (already divided by 10^18)
 * @returns Formatted string like "49,375.12 TRUST"
 */
const formatMarketCap = (value: number): string => {
  const integerPart = Math.floor(value);
  const fractionalPart = Math.round((value - integerPart) * 100);

  const integerStr = integerPart.toLocaleString();
  const formatted = fractionalPart > 0
    ? `${integerStr}.${fractionalPart.toString().padStart(2, '0')}`
    : integerStr;

  return `${formatted} ${chainConfig.currencySymbol}`;
};

/**
 * Section header for the dApp origin.
 */
const OriginHeader = () => (
  <Heading size="sm">dApp Origin</Heading>
);

/**
 * Returns an emoji icon based purely on the trustworthy percentage.
 */
const getTrustworthyIcon = (trustPercent: number): string => {
  if (trustPercent >= 90) return '🟢';
  if (trustPercent >= 70) return '🟡';
  return '🔴';
};

/**
 * Returns an emoji icon for the "Top staker" concentration percentage.
 */
const getTopStakerIcon = (topStakerPercent: number): string => {
  if (topStakerPercent >= TOP_STAKER_CONCERN_THRESHOLD) return '🟡';
  return '';
};

/**
 * Generates an advisory summary sentence when trust data has concerns.
 * Returns null when all signals are healthy (silence = green light).
 *
 * Concerns: disputed (< 90%), sparse (< MIN_STAKERS_FOR_CONFIDENCE), concentrated (>= 25% top staker)
 */
const getTrustSummary = (
  trustPercent: number,
  totalStakers: number,
  topStakerPercent: number,
): string | null => {
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
};

/**
 * Converts position data to shares array for top-staker analysis.
 */
const positionsToShares = (
  positions: { shares: string }[],
): number[] => {
  return positions.map((p) => parseFloat(p.shares) || 0).filter((s) => s > 0);
};

/**
 * Calculates the percentage held by the single largest position.
 */
const calculateTop1Percent = (shares: number[]): number => {
  if (shares.length === 0) return 0;
  const total = shares.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;
  const max = Math.max(...shares);
  return (max / total) * 100;
};

/**
 * Returns a "Majority: N of M stakers" string when concentration is notable.
 * Suppressed when fewer than MIN_STAKERS_FOR_NAKAMOTO stakers or when
 * the ratio of nakamoto/total exceeds NAKAMOTO_WELL_DISTRIBUTED_RATIO
 * (meaning the vault is well-distributed enough that it's unremarkable).
 *
 * @returns Display string or null if suppressed
 */
const getNakamotoDisplay = (shares: number[]): string | null => {
  if (shares.length < MIN_STAKERS_FOR_NAKAMOTO) return null;

  const nakamoto = calculateNakamoto(shares);
  if (nakamoto === 0) return null;

  const ratio = nakamoto / shares.length;
  if (ratio > NAKAMOTO_WELL_DISTRIBUTED_RATIO) return null;

  return `${nakamoto} of ${shares.length} stakers`;
};

/**
 * Origin display when no transaction origin was provided.
 * This can happen for direct RPC calls or certain wallet interactions.
 * Returns null to hide the section entirely.
 */
export const NoOrigin = (
  params: PropsForOriginType<OriginType.NoOrigin>,
) => {
  // Don't render anything if no origin - this is not an error state
  return null;
};

/**
 * Origin display when the origin URL has no atom on Intuition.
 * Shows a warning that the dApp is unknown to the community,
 * with an inline CTA to add trust data.
 */
export const OriginNoAtom = (
  params: PropsForOriginType<OriginType.NoAtom>,
) => {
  const { hostname, originUrl } = params;

  // Generate URL for adding this dApp to the knowledge graph
  const hasOriginUrl = hostname || originUrl;
  const addDappUrl = hasOriginUrl ? vendor.originNoAtom(params).url : null;

  return (
    <Section>
      <OriginHeader />
      <Row label="From">
        <Text><Bold>{hostname || 'Unknown'}</Bold></Text>
      </Row>
      <Row label="Status" variant="warning">
        <Text color="warning"><Bold>Unknown dApp</Bold></Text>
      </Row>
      <Text color="default">No community data. Proceed with caution.</Text>
      {addDappUrl ? (
        <Text>
          <Link href={addDappUrl}>Be first to add trust data for this dApp ↗</Link>
        </Text>
      ) : null}
    </Section>
  );
};

/**
 * Origin display when atom exists but no trust triple.
 * The dApp is known but hasn't been rated for trustworthiness,
 * with an inline CTA to create the trust triple.
 */
export const OriginAtomWithoutTrustTriple = (
  params: PropsForOriginType<OriginType.AtomWithoutTrustTriple>,
) => {
  const { hostname, origin } = params;

  // Generate URL for creating trust triple for this dApp
  const voteUrl = vendor.originAtomWithoutTrustTriple(params).url;

  return (
    <Section>
      <OriginHeader />
      <Row label="From">
        <Text><Bold>{hostname || origin?.label || 'Unknown'}</Bold></Text>
      </Row>
      <Row label="Status">
        <Text color="default">No trust rating yet</Text>
      </Row>
      <Text color="default">Known dApp, awaiting community votes.</Text>
      <Text>
        <Link href={voteUrl}>Be first to vote on this dApp ↗</Link>
      </Text>
    </Section>
  );
};

/**
 * Origin display when atom and trust triple both exist.
 * Shows Trustworthy %, top staker %, and staker counts.
 */
export const OriginAtomWithTrustTriple = (
  params: PropsForOriginType<OriginType.AtomWithTrustTriple>,
) => {
  const { hostname, origin, triple, trustedCircle } = params;

  const supportVault = triple.term?.vaults?.[0];
  const counterVault = triple.counter_term?.vaults?.[0];

  const supportMarketCap = supportVault?.market_cap || '0';
  const supportMarketCapNative = stringToDecimal(supportMarketCap, 18);
  const opposeMarketCap = counterVault?.market_cap || '0';
  const opposeMarketCapNative = stringToDecimal(opposeMarketCap, 18);

  const forCount = triple.positions?.length || 0;
  const againstCount = triple.counter_positions?.length || 0;
  const totalStakers = forCount + againstCount;

  const total = supportMarketCapNative + opposeMarketCapNative;
  const trustPercent = total > 0 ? (supportMarketCapNative / total) * 100 : 0;

  const forShares = positionsToShares(triple.positions || []);
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

  const { user_position, user_counter_position } = triple;
  const hasUserPosition = (user_position?.length ?? 0) > 0 || (user_counter_position?.length ?? 0) > 0;

  return (
    <Section>
      <OriginHeader />
      <Row label="From">
        <Text><Bold>{hostname || origin?.label || 'Unknown'}</Bold></Text>
      </Row>
      {hasUserPosition && (
        <UserPositionSection
          userPosition={user_position ?? []}
          userCounterPosition={user_counter_position ?? []}
        />
      )}
      {trustedCircle ? (
        <TrustedCircleSection
          forContacts={trustedCircle.forContacts}
          againstContacts={trustedCircle.againstContacts}
        />
      ) : null}
      {total > 0 ? (
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
      ) : (
        <Row label="Trustworthy">
          <Text color="muted"><Bold>No stakes yet</Bold></Text>
        </Row>
      )}
      <Text>
        <Link href={vendor.originAtomWithTrustTriple(params).url}>Vote on this dApp ↗</Link>
      </Text>
    </Section>
  );
};

// Type mapping for origin components - mirrors AccountComponents pattern
export type OriginComponents = {
  [K in OriginType]: (params: PropsForOriginType<K>) => JSX.Element | null;
};

export const OriginComponents: OriginComponents = {
  [OriginType.NoOrigin]: NoOrigin,
  [OriginType.NoAtom]: OriginNoAtom,
  [OriginType.AtomWithoutTrustTriple]: OriginAtomWithoutTrustTriple,
  [OriginType.AtomWithTrustTriple]: OriginAtomWithTrustTriple,
};
