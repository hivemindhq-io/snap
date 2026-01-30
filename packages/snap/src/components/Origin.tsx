import {
  Row,
  Text,
  Heading,
  Section,
  Bold,
  Value,
  Link,
} from '@metamask/snaps-sdk/jsx';
import { OriginType, PropsForOriginType } from '../types';
import { stringToDecimal } from '../util';
import { chainConfig } from '../config';
import {
  analyzeTrustDistribution,
  TrustDistributionAnalysis,
  SnapColor,
} from '../distribution';
import { TrustedCircleSection } from './TrustedCircle';
import { UserPositionSection } from './UserPosition';
import { vendor } from '../vendors';

/**
 * Section header for the dApp origin.
 */
const OriginHeader = () => (
  <Heading size="sm">dApp Origin</Heading>
);

/**
 * Returns a trust badge string and color based on trust ratio.
 */
const getTrustInfo = (
  supportMarketCap: number,
  opposeMarketCap: number,
): { badge: string; color: 'success' | 'warning' | 'muted' } => {
  const total = supportMarketCap + opposeMarketCap;
  if (total === 0) return { badge: 'No Stakes', color: 'muted' };

  const trustRatio = (supportMarketCap / total) * 100;
  if (trustRatio >= 70) return { badge: 'Trusted', color: 'success' };
  if (trustRatio >= 30) return { badge: 'Mixed', color: 'warning' };
  return { badge: 'Untrusted', color: 'warning' };
};

/**
 * Converts position data to shares array for distribution analysis.
 */
const positionsToShares = (
  positions: { shares: string }[],
): { shares: number }[] => {
  return positions.map((p) => ({
    shares: parseFloat(p.shares) || 0,
  }));
};

/**
 * Returns distribution indicator label.
 */
const getDistributionLabel = (
  analysis: TrustDistributionAnalysis,
): { label: string; color: SnapColor } => {
  const { forDistribution } = analysis;

  // Ensure color is valid (fallback to 'default' if somehow invalid)
  const validColors: SnapColor[] = ['success', 'warning', 'muted', 'default'];
  const color: SnapColor = validColors.includes(forDistribution.snapColor as SnapColor)
    ? forDistribution.snapColor
    : 'default';

  return {
    label: forDistribution.shortLabel,
    color,
  };
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
      {addDappUrl && (
        <Text>
          <Link href={addDappUrl}>Be first to add trust data for this dApp ↗</Link>
        </Text>
      )}
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
 * Shows full trust data with support/oppose market caps, trust badge,
 * and distribution indicator.
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

  const supportCount = triple.positions?.length || 0;
  const opposeCount = triple.counter_positions?.length || 0;

  const { badge, color } = getTrustInfo(supportMarketCapNative, opposeMarketCapNative);

  // Perform distribution analysis
  const forPositions = positionsToShares(triple.positions || []);
  const againstPositions = positionsToShares(triple.counter_positions || []);

  const distributionAnalysis = analyzeTrustDistribution(
    supportMarketCapNative,
    opposeMarketCapNative,
    forPositions,
    againstPositions,
  );

  const distribution = getDistributionLabel(distributionAnalysis);

  // Check if user has their own position (strongest signal)
  const { user_position, user_counter_position } = triple;
  const hasUserPosition = (user_position?.length ?? 0) > 0 || (user_counter_position?.length ?? 0) > 0;

  return (
    <Section>
      <OriginHeader />
      <Row label="From">
        <Text><Bold>{hostname || origin?.label || 'Unknown'}</Bold></Text>
      </Row>
      {/* User's own position - displayed first as the strongest signal */}
      {hasUserPosition && (
        <UserPositionSection
          userPosition={user_position ?? []}
          userCounterPosition={user_counter_position ?? []}
        />
      )}
      <Row label="Community">
        <Text color={color}><Bold>{badge}</Bold></Text>
      </Row>
      <Row label="Distribution">
        <Text color={distribution.color}><Bold>{distribution.label}</Bold></Text>
      </Row>
      <Row label={`FOR (${supportCount})`}>
        <Value
          value={`${supportMarketCapNative.toFixed(2)} ${chainConfig.currencySymbol}`}
          extra=""
        />
      </Row>
      <Row label={`AGAINST (${opposeCount})`}>
        <Value
          value={`${opposeMarketCapNative.toFixed(2)} ${chainConfig.currencySymbol}`}
          extra=""
        />
      </Row>
      {trustedCircle ? (
        <TrustedCircleSection
          forContacts={trustedCircle.forContacts}
          againstContacts={trustedCircle.againstContacts}
        />
      ) : null}
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
