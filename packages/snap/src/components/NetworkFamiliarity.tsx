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

import { Box, Row, Text } from '@metamask/snaps-sdk/jsx';

import type {
  ClaimContext,
  FamiliarContact,
  NetworkFamiliarity,
  SelfClaims,
} from '../trusted-circle/types';
import { AccountLabel, SectionHeading } from './ui';

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
      (claim) => (claim.tier ?? 'secondary') === tier,
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
  /**
   * The contacts asserting this claim, in input order. The raw `accountId` (a
   * checksummed 0x address) and the human `label` are both kept so the renderer
   * can prefer the `Address` primitive (Jazzicon + canonical truncation) and
   * fall back to the ENS/name label only when no hex address is available.
   */
  contacts: { accountId: string; label: string }[];
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
    const entry = { accountId: contact.accountId, label: contact.label };
    for (const claim of contact.claims) {
      const label = phraseClaim(claim);
      const existing = groups.get(label);
      if (existing) {
        existing.contacts.push(entry);
      } else {
        groups.set(label, { label, contacts: [entry] });
      }
    }
  }

  return [...groups.values()];
}

/**
 * Picks the best identifier to render for a contact: the raw checksummed
 * `accountId` so the {@link AccountLabel}/`Address` primitive can draw a
 * Jazzicon + canonical truncation, falling back to a CAIP-10 inner address or
 * the human label (ENS/name) when no bare hex address is available.
 *
 * @param contact - The grouped contact entry.
 * @param contact.accountId - The contact's checksummed wallet address.
 * @param contact.label - The contact's human label (ENS/name) or caip10 string.
 * @returns The string to hand to `AccountLabel`.
 */
function contactIdentifier(contact: {
  accountId: string;
  label: string;
}): string {
  if (/^0x[a-fA-F0-9]{40}$/u.test(contact.accountId)) {
    return contact.accountId;
  }
  if (contact.label.startsWith('caip10:')) {
    const parts = contact.label.split(':');
    const address = parts[parts.length - 1];
    if (address && /^0x[a-fA-F0-9]{40}$/u.test(address)) {
      return address;
    }
  }
  return contact.label;
}

/**
 * Renders one claim group: the claim phrase plus the contacts asserting it.
 *
 * When more than one contact asserts the claim, the count ("N people") is shown
 * in the {@link Row} value as a useful aggregate. For a SINGLE contact the count
 * ("1 person") is redundant with the lone name rendered directly below it, so it
 * is suppressed and the claim phrase is shown as a plain heading-weight label —
 * the {@link ContactList} underneath names the one person.
 *
 * @param props - Props.
 * @param props.claim - The rendered claim phrase (the row label).
 * @param props.contacts - The contacts asserting this claim.
 * @param props.unitPlural - Plural noun for the contacts (e.g. "people").
 * @param props.tooltip - Optional tooltip explaining the claim's provenance.
 * @returns A box with the claim row + contact list.
 */
const ClaimGroupRow = ({
  claim,
  contacts,
  unitPlural,
  tooltip,
}: {
  claim: string;
  contacts: { accountId: string; label: string }[];
  unitPlural: string;
  tooltip?: string;
}) => {
  const count = contacts.length;
  return (
    <Box>
      <Row label={claim} tooltip={tooltip}>
        <Text color="muted">{count > 1 ? `${count} ${unitPlural}` : ' '}</Text>
      </Row>
      <ContactList contacts={contacts} />
    </Box>
  );
};

/**
 * Renders the contacts asserting a claim as a row each, using the `Address`
 * primitive (canonical truncation + saved display name, avatar OFF) for hex
 * accounts and a plain label otherwise. Avatars are suppressed here on purpose:
 * a column of maskicons is noise and can imply reassurance the data doesn't
 * support. Capped at {@link MAX_NAMES_PER_GROUP}, with a "+N more" tail row.
 *
 * @param props - Props.
 * @param props.contacts - The contacts in this claim group.
 * @returns A box of per-contact rows.
 */
const ContactList = ({
  contacts,
}: {
  contacts: { accountId: string; label: string }[];
}) => {
  const shown = contacts.slice(0, MAX_NAMES_PER_GROUP);
  const remaining = contacts.length - shown.length;
  return (
    <Box>
      {shown.map((contact) => (
        <AccountLabel label={contactIdentifier(contact)} />
      ))}
      {remaining > 0 ? <Text color="muted">{`+${remaining} more`}</Text> : null}
    </Box>
  );
};

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
      <SectionHeading>People you follow</SectionHeading>

      {groups.map((group) => (
        <ClaimGroupRow
          claim={group.label}
          contacts={group.contacts}
          unitPlural="people"
        />
      ))}
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
      <SectionHeading>Friends of people you follow</SectionHeading>

      {groups.map((group) => (
        <ClaimGroupRow
          claim={group.label}
          contacts={group.contacts}
          unitPlural="contacts"
          tooltip="Asserted by accounts your follows trust (friend-of-a-friend)."
        />
      ))}
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
      <SectionHeading>People you follow</SectionHeading>

      {groups.map((group) => (
        <ClaimGroupRow
          claim={group.label}
          contacts={group.contacts}
          unitPlural="people"
        />
      ))}
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

/**
 * Renders the "Your take" block — the viewer's OWN staked claims about the
 * subject (the "Self" lane). Surfaced inline on the primary insight so a
 * personal signal ("I tagged this trustworthy") is always shown back to the
 * viewer, independent of their trusted circle and the familiarity whitelist.
 *
 * FOR claims render as the claim phrase with a muted "You" marker; AGAINST
 * claims render with a `warning` row variant and a "You disputed" marker so a
 * dispute reads as a caution rather than an endorsement. The phrasing reuses
 * {@link phraseClaim} so a self claim reads identically to the same claim in the
 * familiarity lanes. Returns null when the viewer has no staked claims.
 *
 * @param selfClaims - The viewer's own claims about the subject, or undefined.
 * @returns JSX element or null.
 */
export const renderSelfClaims = (selfClaims: SelfClaims | undefined) => {
  if (!selfClaims || selfClaims.claims.length === 0) {
    return null;
  }

  return (
    <Box>
      <SectionHeading>Your take</SectionHeading>
      {selfClaims.claims.map((claim) =>
        claim.stance === 'against' ? (
          <Row label={phraseClaim(claim)} variant="warning">
            <Text color="warning">You disputed</Text>
          </Row>
        ) : (
          <Row label={phraseClaim(claim)}>
            <Text color="muted">You</Text>
          </Row>
        ),
      )}
    </Box>
  );
};
