/**
 * Empty-state UI for the transaction-insight panel.
 *
 * When Hive Mind has nothing on the destination address (and no dApp-origin
 * signal to show), the panel must read as an honest "we have nothing here" —
 * never as a clean bill of health. This renders a neutral status line plus a
 * negative-leaning (scam-protection) nudge that motivates the existing footer
 * CTA sitting directly below it. No checkmarks, no color, no "verified".
 *
 * It also renders a muted provenance line when the transaction was initiated
 * from our own (first-party) Hive Mind extension, since the dApp-origin block is
 * suppressed for extension origins.
 *
 * @module components/EmptyState
 */

import { Section, Text, Heading, Row } from '@metamask/snaps-sdk/jsx';

import type { AddressClassification } from '../types';
import { isFirstPartyExtensionOrigin } from '../util';

/**
 * Human label for an address classification, used in the empty state so the
 * user still learns what KIND of destination they are interacting with even
 * when Hive Mind has no community signals. Softened ("Likely smart contract")
 * when classification is uncertain so we never overclaim.
 *
 * @param classification - The address classification result.
 * @returns A short label, or null when the type is unknown/uncertain.
 */
const accountTypeLabel = (
  classification: AddressClassification | undefined,
): string | null => {
  if (!classification) {
    return null;
  }
  if (classification.type === 'contract') {
    return 'Smart contract';
  }
  if (classification.type === 'eoa') {
    return 'Wallet (EOA)';
  }
  return 'Likely smart contract';
};

/**
 * The neutral empty-state notice: an honest status line and a negative-leaning
 * contribute nudge. The nudge leads with the protective outcome (warn others
 * about scams) and keeps the action open (flag or vouch) without accusing the
 * specific address. It motivates the footer CTA below; it is not a button.
 *
 * When the destination's classification is known, an "Account type" row is
 * shown so the user still learns whether they are interacting with a smart
 * contract or a regular wallet even with zero community signals.
 *
 * When `hasPublicClaims` is true the broader community HAS staked claims about
 * this subject — the viewer's network just hasn't weighed in — so the headline
 * sentence is corrected from the misleading "no community signals" to
 * "no one in your network has weighed in", which the escape-hatch "More info"
 * button (rendered by the caller) then opens into the Public claims lane.
 *
 * @param props - Props.
 * @param props.classification - The destination's address classification, if known.
 * @param props.hasPublicClaims - Whether public (out-of-network) claims exist.
 * @returns The empty-state notice JSX.
 */
export const EmptyStateNotice = ({
  classification,
  hasPublicClaims = false,
}: {
  classification?: AddressClassification | undefined;
  hasPublicClaims?: boolean;
}) => {
  const typeLabel = accountTypeLabel(classification);
  return (
    <Section>
      <Heading size="md">No signals yet</Heading>
      {typeLabel ? (
        <Row label="Account type">
          <Text color="muted">{typeLabel}</Text>
        </Row>
      ) : null}
      <Text>
        {hasPublicClaims
          ? 'No one in your network has weighed in yet — not an endorsement.'
          : 'No community signals on this address yet — not an endorsement.'}
      </Text>
      <Text>
        Spotted a scam — or know it&apos;s safe? Add the first claim to warn
        others.
      </Text>
    </Section>
  );
};

/**
 * Muted provenance line shown when the transaction originated from our own
 * Hive Mind extension. Returns null for any other origin.
 *
 * @param originUrl - The raw transaction origin string.
 * @returns The provenance JSX, or null.
 */
export const renderFirstPartyProvenance = (originUrl: string | undefined) => {
  if (!isFirstPartyExtensionOrigin(originUrl)) {
    return null;
  }
  return (
    <Text color="muted">
      Transaction initiated from the Hive Mind extension.
    </Text>
  );
};
