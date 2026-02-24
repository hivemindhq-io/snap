import {
  Address,
  Row,
  Text,
  Heading,
  Bold,
  Section,
} from '@metamask/snaps-sdk/jsx';
import { AccountType, PropsForAccountType, AlternateTrustData } from '../types';
import { chainConfig } from '../config';
import { TrustedCircleSection } from './TrustedCircle';
import { NetworkFamiliaritySection } from './NetworkFamiliarity';
import { UserPositionSection } from './UserPosition';
import { TrustStatsBlock } from './TrustStatsBlock';

/**
 * Section header for the destination address.
 */
const AddressHeader = () => (
  <Heading size="sm">Destination</Heading>
);

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
  const { address, alias, isContract, alternateTrustData, networkFamiliarity } = params;

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
      {networkFamiliarity ? (
        <NetworkFamiliaritySection networkFamiliarity={networkFamiliarity} />
      ) : null}
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
 * Shows full trust data: Trustworthy %, top staker %, and staker counts.
 */
export const AtomWithTrustTriple = (
  params: PropsForAccountType<AccountType.AtomWithTrustTriple>,
) => {
  const { address, triple, alias, isContract, alternateTrustData, trustedCircle, networkFamiliarity } = params;
  const {
    counter_term: {
      vaults: [counterVault],
    },
    term: {
      vaults: [vault],
    },
    positions,
    counter_positions,
    user_position,
    user_counter_position,
  } = triple;

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
      {networkFamiliarity ? (
        <NetworkFamiliaritySection networkFamiliarity={networkFamiliarity} />
      ) : null}
      <TrustStatsBlock
        supportMarketCap={vault?.market_cap || '0'}
        opposeMarketCap={counterVault?.market_cap || '0'}
        positions={positions}
        counterPositions={counter_positions}
      />
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
