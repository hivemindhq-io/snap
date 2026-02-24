import {
  Row,
  Text,
  Heading,
  Section,
  Bold,
  Link,
} from '@metamask/snaps-sdk/jsx';
import { OriginType, PropsForOriginType } from '../types';
import { TrustedCircleSection } from './TrustedCircle';
import { UserPositionSection } from './UserPosition';
import { TrustStatsBlock } from './TrustStatsBlock';
import { vendor } from '../vendors';

/**
 * Section header for the dApp origin.
 */
const OriginHeader = () => (
  <Heading size="sm">dApp Origin</Heading>
);

/**
 * Origin display when no transaction origin was provided.
 * This can happen for direct RPC calls or certain wallet interactions.
 * Returns null to hide the section entirely.
 */
export const NoOrigin = (
  params: PropsForOriginType<OriginType.NoOrigin>,
) => {
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
      <TrustStatsBlock
        supportMarketCap={supportVault?.market_cap || '0'}
        opposeMarketCap={counterVault?.market_cap || '0'}
        positions={triple.positions || []}
        counterPositions={triple.counter_positions || []}
      />
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
