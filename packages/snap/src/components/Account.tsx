import {
  Address,
  Row,
  Text,
  Value,
  Heading,
  Bold,
  Section,
} from '@metamask/snaps-sdk/jsx';
import { AccountType, PropsForAccountType, AlternateTrustData } from '../types';
import { stringToDecimal } from '../util';
import { chainConfig } from '../config';
import {
  analyzeTrustDistribution,
  TrustDistributionAnalysis,
  SnapColor,
} from '../distribution';
import { TrustedCircleSection } from './TrustedCircle';
import { UserPositionSection } from './UserPosition';

/**
 * Section header for the destination address.
 */
const AddressHeader = () => (
  <Heading size="sm">Destination</Heading>
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
 * The color is used internally for the 4-tier system:
 * - success (green): Well distributed
 * - warning (yellow/orange): Moderate, Concentrated, or Whale dominated
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

  // For display, we only show the FOR distribution since that's what matters for trust
  return {
    label: forDistribution.shortLabel,
    color,
  };
};

/**
 * Displays a note when alternate atom format (CAIP vs 0x) has trust data.
 * Helps users understand there may be additional relevant trust information.
 */
const AlternateTrustNote = ({
  alternateTrustData,
  isContract,
}: {
  alternateTrustData: AlternateTrustData;
  isContract: boolean;
}) => {
  if (!alternateTrustData.hasAlternateTrustData) {
    return null;
  }

  const noteText = alternateTrustData.alternateIsCaip
    ? `Also has data as a contract on ${chainConfig.chainName}`
    : `Also has data as an EOA`;

  return (
    <Text color="default">{noteText}</Text>
  );
};

/**
 * Account display component for addresses with no atom on Intuition.
 * Shows a warning indicating no data exists for this address.
 */
export const NoAtom = (
  params: PropsForAccountType<AccountType.NoAtom>,
) => {
  const { address, isContract, alternateTrustData } = params;
  const accountTypeSyntax = isContract ? 'contract' : 'address';

  return (
    <Section>
      <AddressHeader />
      <Row label="Address">
        <Address address={address as `0x${string}`} />
      </Row>
      <Row label="Status" variant="warning">
        <Text color="warning">
          <Bold>Unknown {accountTypeSyntax}</Bold>
        </Text>
      </Row>
      <Text color="default">No community data on Intuition</Text>
      <AlternateTrustNote
        alternateTrustData={alternateTrustData}
        isContract={isContract}
      />
    </Section>
  );
};

/**
 * Account display component for addresses with an atom but no trust triple.
 * Shows the atom info with an info message about missing trust rating.
 */
export const AtomWithoutTrustTriple = (
  params: PropsForAccountType<AccountType.AtomWithoutTrustTriple>,
) => {
  const { address, account, alias, isContract, alternateTrustData } = params;

  return (
    <Section>
      <AddressHeader />
      <Row label="Address">
        <Address address={address as `0x${string}`} />
      </Row>
      {!!alias && (
        <Row label="Alias">
          <Text><Bold>{alias}</Bold></Text>
        </Row>
      )}
      <Row label="Status">
        <Text color="default">No trust rating yet</Text>
      </Row>
      <Text color="default">Known address, awaiting community votes</Text>
      <AlternateTrustNote
        alternateTrustData={alternateTrustData}
        isContract={isContract}
      />
    </Section>
  );
};

/**
 * Account display component for addresses with an atom and trust triple.
 * Shows full trust data with support/oppose market caps, trust badge,
 * and distribution indicator.
 */
export const AtomWithTrustTriple = (
  params: PropsForAccountType<AccountType.AtomWithTrustTriple>,
) => {
  const { address, triple, alias, isContract, alternateTrustData, trustedCircle } = params;
  const {
    counter_term: {
      vaults: [counterVault],
    },
    term: {
      vaults: [vault],
    },
    positions,
    counter_positions,
    positions_aggregate,
    counter_positions_aggregate,
    user_position,
    user_counter_position,
  } = triple;

  const supportMarketCap = vault?.market_cap || '0';
  const supportMarketCapNative = stringToDecimal(supportMarketCap, 18);
  const opposeMarketCap = counterVault?.market_cap || '0';
  const opposeMarketCapNative = stringToDecimal(opposeMarketCap, 18);

  const { badge, color } = getTrustInfo(supportMarketCapNative, opposeMarketCapNative);

  // Perform distribution analysis
  const forPositions = positionsToShares(positions);
  const againstPositions = positionsToShares(counter_positions);

  const distributionAnalysis = analyzeTrustDistribution(
    supportMarketCapNative,
    opposeMarketCapNative,
    forPositions,
    againstPositions,
    positions_aggregate?.aggregate,
    counter_positions_aggregate?.aggregate,
  );

  const distribution = getDistributionLabel(distributionAnalysis);

  // Check if user has their own position (strongest signal)
  const hasUserPosition = (user_position?.length ?? 0) > 0 || (user_counter_position?.length ?? 0) > 0;

  return (
    <Section>
      <AddressHeader />
      <Row label="Address">
        <Address address={address as `0x${string}`} />
      </Row>
      {!!alias && (
        <Row label="Alias">
          <Text><Bold>{alias}</Bold></Text>
        </Row>
      )}
      {/* Layer 1: User's own position - displayed first as the strongest signal */}
      {hasUserPosition && (
        <UserPositionSection
          userPosition={user_position ?? []}
          userCounterPosition={user_counter_position ?? []}
        />
      )}
      {/* Layer 2: Trust Circle - social proof from people you trust */}
      {trustedCircle ? (
        <TrustedCircleSection
          forContacts={trustedCircle.forContacts}
          againstContacts={trustedCircle.againstContacts}
        />
      ) : null}
      {/* Layer 3: Community context - aggregate metrics */}
      <Row label="Community">
        <Text color={color}><Bold>{badge}</Bold></Text>
      </Row>
      <Row label="Distribution">
        <Text color={distribution.color}><Bold>{distribution.label}</Bold></Text>
      </Row>
      <Row label={`FOR (${positions.length})`}>
        <Value
          value={`${supportMarketCapNative.toFixed(2)} ${chainConfig.currencySymbol}`}
          extra=""
        />
      </Row>
      <Row label={`AGAINST (${counter_positions.length})`}>
        <Value
          value={`${opposeMarketCapNative.toFixed(2)} ${chainConfig.currencySymbol}`}
          extra=""
        />
      </Row>
      <AlternateTrustNote
        alternateTrustData={alternateTrustData}
        isContract={isContract}
      />
    </Section>
  );
};

// Type mapping for account components
export type AccountComponents = {
  [K in AccountType]: (params: PropsForAccountType<K>) => JSX.Element;
};

export const AccountComponents: AccountComponents = {
  [AccountType.NoAtom]: NoAtom,
  [AccountType.AtomWithoutTrustTriple]: AtomWithoutTrustTriple,
  [AccountType.AtomWithTrustTriple]: AtomWithTrustTriple,
};
