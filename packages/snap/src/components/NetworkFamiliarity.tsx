/**
 * Network Familiarity UI Component.
 *
 * Displays trusted contacts who have ANY claim about the target address,
 * beyond just the "hasTag trustworthy" triple shown in TrustedCircleSection.
 *
 * This surfaces "people you trust who know something about this address,"
 * giving the user a lead to ask those contacts directly.
 *
 * @module components/NetworkFamiliarity
 */

import { Box, Row, Text, Heading, Section, Bold } from '@metamask/snaps-sdk/jsx';
import type { FamiliarContact, NetworkFamiliarity } from '../trusted-circle/types';

const MAX_DISPLAY_CONTACTS = 3;
const MAX_CLAIMS_PER_CONTACT = 2;

/**
 * Formats a contact's label for display.
 * Truncates full addresses but preserves ENS names.
 *
 * @param label - The contact's label
 * @returns Formatted label string
 */
function formatLabel(label: string): string {
  if (/^0x[a-fA-F0-9]{40}$/u.test(label)) {
    return `${label.slice(0, 6)}...${label.slice(-4)}`;
  }

  if (label.startsWith('caip10:')) {
    const parts = label.split(':');
    const address = parts[parts.length - 1];
    if (address && /^0x[a-fA-F0-9]{40}$/u.test(address)) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  }

  return label;
}

/**
 * Formats claim context into a short readable string.
 * e.g., "has tag: DeFi Protocol"
 *
 * @param contact - The familiar contact with claims
 * @returns Formatted string summarizing their claims
 */
function formatClaimSummary(contact: FamiliarContact): string {
  const displayClaims = contact.claims.slice(0, MAX_CLAIMS_PER_CONTACT);
  const summaries = displayClaims.map(
    (c) => `${c.predicateLabel}: ${c.objectLabel}`,
  );

  const result = summaries.join(', ');
  if (contact.claims.length > MAX_CLAIMS_PER_CONTACT) {
    return `${result} +${contact.claims.length - MAX_CLAIMS_PER_CONTACT} more`;
  }
  return result;
}

/**
 * Props for NetworkFamiliaritySection.
 */
export interface NetworkFamiliaritySectionProps {
  networkFamiliarity: NetworkFamiliarity;
}

/**
 * Displays trusted contacts who have made claims about the target address.
 * Each contact is shown with a summary of their claims.
 *
 * Hidden when no familiar contacts exist (rendering returns null).
 *
 * @param props - Component props with network familiarity data
 * @returns JSX element or null
 */
export const NetworkFamiliaritySection = ({
  networkFamiliarity,
}: NetworkFamiliaritySectionProps) => {
  const { familiarContacts } = networkFamiliarity;

  if (familiarContacts.length === 0) {
    return null;
  }

  const displayContacts = familiarContacts.slice(0, MAX_DISPLAY_CONTACTS);
  const remaining = familiarContacts.length - MAX_DISPLAY_CONTACTS;

  return (
    <Section>
      <Heading size="sm">Also Familiar</Heading>

      {displayContacts.map((contact) => (
        <Row label={formatLabel(contact.label)}>
          <Text color="muted">{formatClaimSummary(contact)}</Text>
        </Row>
      ))}

      {remaining > 0 && (
        <Text color="muted">{`+${remaining} more from your network`}</Text>
      )}
    </Section>
  );
};

/**
 * Displays degree-2 (friend-of-a-friend) contacts who have made claims about the
 * target address. Rendered as a SEPARATE section below the 1-hop "Also Familiar"
 * block — never mixed with direct follows. Each contact shows how many of the
 * viewer's follows bridge to it ("via N of your follows").
 *
 * Hidden when there are no extended contacts (returns null).
 */
const ExtendedFamiliaritySection = ({
  contacts,
}: {
  contacts: FamiliarContact[];
}) => {
  if (contacts.length === 0) {
    return null;
  }

  const displayContacts = contacts.slice(0, MAX_DISPLAY_CONTACTS);
  const remaining = contacts.length - MAX_DISPLAY_CONTACTS;

  return (
    <Section>
      <Heading size="sm">Extended Network</Heading>

      {displayContacts.map((contact) => (
        <Row label={formatLabel(contact.label)}>
          <Text color="muted">
            {`${formatClaimSummary(contact)} · via ${contact.bridgeCount ?? 0} of your follows`}
          </Text>
        </Row>
      ))}

      {remaining > 0 && (
        <Text color="muted">{`+${remaining} more in your extended network`}</Text>
      )}
    </Section>
  );
};

/**
 * Renders ONLY the 1-hop "Also Familiar" block (direct follows with claims).
 * This is the high-value familiarity tier shown inline on the primary insight.
 * Returns null when there are no 1-hop familiar contacts.
 *
 * @param networkFamiliarity - Aggregated familiarity data.
 * @returns JSX element or null.
 */
export const renderOneHopFamiliarity = (
  networkFamiliarity: NetworkFamiliarity | undefined,
) => {
  if (!networkFamiliarity || networkFamiliarity.familiarContacts.length === 0) {
    return null;
  }

  return <NetworkFamiliaritySection networkFamiliarity={networkFamiliarity} />;
};

/**
 * Renders ONLY the degree-2 "Extended Network" block (friend-of-a-friend
 * contacts with claims). This is the lower-weight tier pushed behind the
 * "More info" page. Returns null when there are no extended contacts.
 *
 * @param networkFamiliarity - Aggregated familiarity data.
 * @returns JSX element or null.
 */
export const renderExtendedFamiliarity = (
  networkFamiliarity: NetworkFamiliarity | undefined,
) => {
  const extendedContacts = networkFamiliarity?.extendedContacts;
  if (!extendedContacts || extendedContacts.length === 0) {
    return null;
  }

  return <ExtendedFamiliaritySection contacts={extendedContacts} />;
};

/**
 * Renders the standalone "Your network" insight: the 1-hop "Also Familiar"
 * block plus a separate degree-2 "Extended Network" subsection. Returns null
 * when there is nothing in either tier.
 *
 * Rendered directly in `onTransaction` (the legacy account/Destination card that
 * used to host familiarity is hidden), so this is the visible home for the
 * "WHO in your network knows this address" surface.
 *
 * @param networkFamiliarity - Aggregated 1-hop + 2-hop familiarity data.
 * @returns JSX element or null.
 */
export const renderNetworkInsight = (
  networkFamiliarity: NetworkFamiliarity | undefined,
) => {
  const oneHop = renderOneHopFamiliarity(networkFamiliarity);
  const extended = renderExtendedFamiliarity(networkFamiliarity);

  if (!oneHop && !extended) {
    return null;
  }

  return (
    <Box>
      {oneHop}
      {extended}
    </Box>
  );
};
