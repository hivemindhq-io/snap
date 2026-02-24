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

import { Row, Text, Heading, Section, Bold } from '@metamask/snaps-sdk/jsx';
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
