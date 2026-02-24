import {
  Address,
  Box,
  Row,
  Text,
  Heading,
  Bold,
  Section,
} from '@metamask/snaps-sdk/jsx';
import { AccountType, PropsForAccountType, AlternateTrustData } from '../types';
import { stringToDecimal } from '../util';
import { chainConfig } from '../config';
import { TrustedCircleSection } from './TrustedCircle';
import { NetworkFamiliaritySection } from './NetworkFamiliarity';
import { UserPositionSection } from './UserPosition';

const MIN_STAKERS_FOR_CONFIDENCE = 3;
const TOP_STAKER_CONCERN_THRESHOLD = 25;

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
 * Section header for the destination address.
 */
const AddressHeader = () => (
  <Heading size="sm">Destination</Heading>
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
 * Converts position data to shares array for distribution analysis.
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
  const { address, account, alias, isContract, alternateTrustData, networkFamiliarity } = params;

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

  const supportMarketCap = vault?.market_cap || '0';
  const supportMarketCapNative = stringToDecimal(supportMarketCap, 18);
  const opposeMarketCap = counterVault?.market_cap || '0';
  const opposeMarketCapNative = stringToDecimal(opposeMarketCap, 18);

  const total = supportMarketCapNative + opposeMarketCapNative;
  const trustPercent = total > 0 ? (supportMarketCapNative / total) * 100 : 0;

  const forCount = positions.length;
  const againstCount = counter_positions.length;
  const totalStakers = forCount + againstCount;

  const forShares = positionsToShares(positions);
  const topStakerPercent = calculateTop1Percent(forShares);

  const trustIcon = total > 0
    ? getTrustworthyIcon(trustPercent)
    : '';
  const topStakerIcon = forShares.length > 0
    ? getTopStakerIcon(topStakerPercent)
    : '';
  const trustSummary = total > 0
    ? getTrustSummary(trustPercent, totalStakers, topStakerPercent)
    : null;

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
