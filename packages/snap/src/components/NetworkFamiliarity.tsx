/**
 * Network Familiarity UI Component.
 *
 * Displays trusted contacts who have ANY claim about the target address.
 *
 * This surfaces "people you trust who know something about this address,"
 * giving the user a lead to ask those contacts directly.
 *
 * @module components/NetworkFamiliarity
 */

import { Box, Row, Text, Heading } from '@metamask/snaps-sdk/jsx';

import type {
  ClaimContext,
  FamiliarContact,
  NetworkFamiliarity,
} from '../trusted-circle/types';

const MAX_NAMES_PER_GROUP = 3;

/**
 * Returns a copy of each contact carrying only the claims whose placement tier
 * matches `tier`, and drops any contact left with zero claims. A claim with no
 * `tier` (escape-hatch verbatim claim) is treated as `'secondary'`.
 *
 * This is how the predicate-tier whitelist overlays the existing degree-based
 * split: 1-hop contacts keep only their `primary` claims inline, and their
 * `secondary` claims are demoted into the More info surface alongside the 2-hop
 * contacts.
 *
 * @param contacts - The familiar contacts to filter.
 * @param tier - The placement tier to keep.
 * @returns Contacts with only the matching claims (empty when none match).
 */
function contactsByTier(
  contacts: FamiliarContact[],
  tier: 'primary' | 'secondary',
): FamiliarContact[] {
  const result: FamiliarContact[] = [];
  for (const contact of contacts) {
    const claims = contact.claims.filter(
      (c) => (c.tier ?? 'secondary') === tier,
    );
    if (claims.length > 0) {
      result.push({ ...contact, claims });
    }
  }
  return result;
}

/**
 * Renders a claim as a natural-language phrase when its predicate is a
 * first-class registry key (e.g. 'hasTag' -> "Tagged trustworthy"), so the same
 * intent reads consistently regardless of the raw predicate label. Unknown /
 * non-first-class predicates (e.g. "has characteristic") fall back to the
 * verbatim `{predicateLabel} {objectLabel}` form. `trustedFor` and `follow` are
 * intentionally omitted — they are not surfaced as familiarity claims here.
 *
 * @param claim - The claim to phrase.
 * @returns A display phrase for the claim.
 */
function phraseClaim(claim: ClaimContext): string {
  const obj = claim.objectLabel;
  switch (claim.predicateKey) {
    case 'hasTag':
      return `Tagged ${obj}`;
    case 'reportedFor':
      return `Reported for ${obj}`;
    case 'vouchFor':
      return `Vouched for ${obj}`;
    case 'auditedBy':
      return `Audited by ${obj}`;
    case 'evaluatedBy':
      return `Evaluated by ${obj}`;
    case 'createdBy':
      return `Created by ${obj}`;
    case 'sameAs':
      return `Same as ${obj}`;
    default:
      return `${claim.predicateLabel} ${obj}`;
  }
}

/**
 * A set of contacts who all assert the same claim about the address — e.g.
 * everyone who tagged it "trustworthy". Grouping by the rendered phrasing rather
 * than by contact collapses N identical rows into one high-signal line while
 * keeping distinct claims (e.g. a first-class "Tagged trustworthy" vs a verbatim
 * "has characteristic trustworthy") in separate groups so nothing is averaged
 * away.
 */
type ClaimGroup = {
  /** The rendered claim phrase shown as the row label. */
  label: string;
  /** Display labels of the contacts asserting this claim, in input order. */
  contactLabels: string[];
};

/**
 * Groups contacts by the rendered phrasing of the claims they assert about the
 * address. A contact appears in every group matching one of its claims. Group
 * order follows first appearance so the most-claimed signal tends to surface
 * first, and claims with distinct phrasing stay in distinct groups.
 *
 * @param contacts - The familiar contacts to group.
 * @returns Claim groups, each carrying the contact labels that assert it.
 */
function groupByClaim(contacts: FamiliarContact[]): ClaimGroup[] {
  const groups = new Map<string, ClaimGroup>();

  for (const contact of contacts) {
    for (const claim of contact.claims) {
      const label = phraseClaim(claim);
      const existing = groups.get(label);
      if (existing) {
        existing.contactLabels.push(formatLabel(contact.label));
      } else {
        groups.set(label, {
          label,
          contactLabels: [formatLabel(contact.label)],
        });
      }
    }
  }

  return [...groups.values()];
}

/**
 * Joins contact labels for a group's sub-line, truncating with "+N more" past
 * the display cap.
 *
 * @param labels - Already-formatted contact labels.
 * @returns A comma-joined string, truncated when long.
 */
function formatContactNames(labels: string[]): string {
  const shown = labels.slice(0, MAX_NAMES_PER_GROUP);
  const remaining = labels.length - shown.length;
  const joined = shown.join(', ');
  return remaining > 0 ? `${joined} +${remaining} more` : joined;
}

/**
 * Formats a contact's label for display.
 * Truncates full addresses but preserves ENS names.
 *
 * @param label - The contact's label.
 * @returns Formatted label string.
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
 * Props for NetworkFamiliaritySection.
 */
export type NetworkFamiliaritySectionProps = {
  networkFamiliarity: NetworkFamiliarity;
};

/**
 * Displays trusted contacts who have made claims about the target address.
 * Each contact is shown with a summary of their claims.
 *
 * Hidden when no familiar contacts exist (rendering returns null).
 *
 * @param props - Component props with network familiarity data.
 * @param props.networkFamiliarity - Aggregated 1-hop familiarity data.
 * @returns JSX element or null.
 */
export const NetworkFamiliaritySection = ({
  networkFamiliarity,
}: NetworkFamiliaritySectionProps) => {
  // Inline (primary) surface shows ONLY primary-tier claims from direct follows.
  // Secondary-tier claims (e.g. content-negative tags, sameAs) are demoted to the
  // More info surface even though the contact is a direct follow.
  const familiarContacts = contactsByTier(
    networkFamiliarity.familiarContacts,
    'primary',
  );

  if (familiarContacts.length === 0) {
    return null;
  }

  const groups = groupByClaim(familiarContacts);

  return (
    <Box>
      <Heading size="sm">People you follow</Heading>

      {groups.map((group) => {
        const count = group.contactLabels.length;
        const who = count === 1 ? '1 person' : `${count} people`;
        return (
          <Box>
            <Row label={group.label}>
              <Text color="muted">{who}</Text>
            </Row>
            <Text color="muted">{formatContactNames(group.contactLabels)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Displays degree-2 (friend-of-a-friend) contacts who have made claims about the
 * target address. Rendered as a SEPARATE section below the 1-hop "Also Familiar"
 * block — never mixed with direct follows. Each contact shows how many of the
 * viewer's follows bridge to it ("via N of your follows").
 *
 * Hidden when there are no extended contacts (returns null).
 *
 * @param props - Component props.
 * @param props.contacts - Degree-2 familiar contacts.
 * @returns JSX element or null.
 */
const ExtendedFamiliaritySection = ({
  contacts,
}: {
  contacts: FamiliarContact[];
}) => {
  if (contacts.length === 0) {
    return null;
  }

  const groups = groupByClaim(contacts);

  return (
    <Box>
      <Heading size="sm">Friends of people you follow</Heading>

      {groups.map((group) => {
        const count = group.contactLabels.length;
        const who = count === 1 ? '1 contact' : `${count} contacts`;
        return (
          <Box>
            <Row label={group.label}>
              <Text color="muted">{who}</Text>
            </Row>
            <Text color="muted">{formatContactNames(group.contactLabels)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Renders the demoted-secondary slice of DIRECT follows: 1-hop contacts whose
 * claims are secondary-tier (e.g. content-negative tags, `sameAs`). These belong
 * on the More info surface even though the contact is a direct follow, because
 * the predicate tier (secondary) caps placement below the degree tier (1-hop).
 *
 * @param props - Component props.
 * @param props.contacts - Direct follows carrying only their secondary claims.
 * @returns JSX element or null when there are no demoted claims.
 */
const DemotedOneHopSection = ({
  contacts,
}: {
  contacts: FamiliarContact[];
}) => {
  if (contacts.length === 0) {
    return null;
  }

  const groups = groupByClaim(contacts);

  return (
    <Box>
      <Heading size="sm">People you follow</Heading>

      {groups.map((group) => {
        const count = group.contactLabels.length;
        const who = count === 1 ? '1 person' : `${count} people`;
        return (
          <Box>
            <Row label={group.label}>
              <Text color="muted">{who}</Text>
            </Row>
            <Text color="muted">{formatContactNames(group.contactLabels)}</Text>
          </Box>
        );
      })}
    </Box>
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
  if (!networkFamiliarity) {
    return null;
  }
  // Only direct follows with at least one PRIMARY-tier claim anchor the inline
  // surface; a follow whose claims are all secondary is handled by the More info
  // surface instead.
  if (
    contactsByTier(networkFamiliarity.familiarContacts, 'primary').length === 0
  ) {
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
  if (!networkFamiliarity) {
    return null;
  }

  // Demoted direct follows: 1-hop contacts whose claims are secondary-tier. The
  // 2-hop layer is already capped to More info by its degree, so every one of its
  // (whitelisted) claims renders here regardless of predicate tier.
  const demotedOneHop = contactsByTier(
    networkFamiliarity.familiarContacts,
    'secondary',
  );
  const extendedContacts = networkFamiliarity.extendedContacts ?? [];

  if (demotedOneHop.length === 0 && extendedContacts.length === 0) {
    return null;
  }

  return (
    <Box>
      <DemotedOneHopSection contacts={demotedOneHop} />
      <ExtendedFamiliaritySection contacts={extendedContacts} />
    </Box>
  );
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
