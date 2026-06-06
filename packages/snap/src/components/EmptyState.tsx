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

import { Section, Text } from '@metamask/snaps-sdk/jsx';

import { isFirstPartyExtensionOrigin } from '../util';

/**
 * The neutral empty-state notice: an honest status line and a negative-leaning
 * contribute nudge. The nudge leads with the protective outcome (warn others
 * about scams) and keeps the action open (flag or vouch) without accusing the
 * specific address. It motivates the footer CTA below; it is not a button.
 *
 * @returns The empty-state notice JSX.
 */
export const EmptyStateNotice = () => (
  <Section>
    <Text>No community signals on this address yet — not an endorsement.</Text>
    <Text>
      Spotted a scam — or know it&apos;s safe? Add the first claim to warn
      others.
    </Text>
  </Section>
);

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
