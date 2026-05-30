/**
 * Safety read-surface UI components.
 *
 * Renders the classified safety signals (docs/claim-surface-spec.md §5):
 *  - critical authority reports as danger banners at the very top,
 *  - soft flags + non-critical hard reports as caution rows,
 *  - provenance / identity signals as informational rows.
 *
 * This block is rendered ABOVE the existing account/origin insight sections in
 * onTransaction, so safety overrides reputation visually.
 *
 * @module components/Safety
 */

import { Box, Row, Text, Heading, Section, Bold } from '@metamask/snaps-sdk/jsx';
import type { SafetyData, SafetySignal, SafetyAuthor } from '../safety/types';

const MAX_AUTHORS = 3;

/**
 * Formats the attribution authors into a short readable string.
 * Authors are shown by their on-chain identity (ENS name, else truncated
 * hex address), e.g. "alice.eth, 0x1234...5678 +2 more".
 */
function formatAuthors(authors: SafetyAuthor[]): string {
  if (authors.length === 0) {
    return '';
  }
  const shown = authors.slice(0, MAX_AUTHORS).map((a) => a.label);
  if (authors.length > MAX_AUTHORS) {
    return `${shown.join(', ')} +${authors.length - MAX_AUTHORS} more`;
  }
  return shown.join(', ');
}

/** Builds the "via …" attribution suffix for a signal. */
function attribution(signal: SafetySignal): string {
  const authors = formatAuthors(signal.attributedAuthors);
  if (!authors) {
    return '';
  }
  return signal.fromWhitelist ? `Flagged by ${authors}` : `From your circle: ${authors}`;
}

/**
 * Whether a signal's only attribution is the extended network (degree-2) — i.e.
 * no whitelisted authority and no 1-hop trust-circle author backs it. These
 * render in a separate, lower-weight 2nd-degree block.
 */
function isExtendedOnly(signal: SafetySignal): boolean {
  return (
    signal.fromExtendedNetwork && !signal.fromWhitelist && !signal.fromTrustCircle
  );
}

/**
 * Counts the distinct bridges backing a degree-2 signal: the largest number of
 * the viewer's follows reaching any single degree-2 author on it. This is the
 * 2-hop "path strength" — stake is never consulted.
 */
function maxBridgeCount(signal: SafetySignal): number {
  let max = 0;
  for (const author of signal.attributedAuthors) {
    if (author.degree === 2 && author.via) {
      max = Math.max(max, author.via.length);
    }
  }
  return max;
}

/**
 * Bridge-aware attribution for a 2nd-degree signal. Makes the transitive nature
 * legible ("accounts your follows trust") rather than implying a direct
 * endorsement.
 */
function extendedAttribution(signal: SafetySignal): string {
  const bridges = maxBridgeCount(signal);
  return bridges > 0
    ? `From your extended network · via ${bridges} of your follows`
    : 'From your extended network';
}

/**
 * Critical authority reports — rendered as a prominent error-styled section.
 * (The SDK `Banner` component is not available in this snaps-sdk version, so we
 * use a `Section` with error-variant rows to convey the danger.)
 */
const CriticalReports = ({ signals }: { signals: SafetySignal[] }) => {
  if (signals.length === 0) {
    return null;
  }
  return (
    <Section>
      <Heading size="sm">⚠️ Safety Warning</Heading>
      {signals.map((signal) => (
        <Row label={`Reported: ${signal.objectLabel}`} variant="critical">
          <Text color="error">
            <Bold>{attribution(signal)}</Bold>
          </Text>
        </Row>
      ))}
    </Section>
  );
};

/**
 * Soft flags + non-critical hard reports — rendered as caution rows.
 */
const SafetyWarnings = ({ signals }: { signals: SafetySignal[] }) => {
  if (signals.length === 0) {
    return null;
  }
  return (
    <Section>
      <Heading size="sm">Safety Flags</Heading>
      {signals.map((signal) => (
        <Row label={signal.objectLabel} variant="warning">
          <Text color="warning">{attribution(signal)}</Text>
        </Row>
      ))}
    </Section>
  );
};

/**
 * 2nd-degree (extended-network) soft warnings — rendered in their OWN section,
 * BELOW the 1st-degree warnings and never in the critical banner. Each row is
 * gated upstream by MIN_BRIDGES and labeled with the bridge count to make the
 * transitive (friend-of-a-friend) nature explicit.
 */
const ExtendedWarnings = ({ signals }: { signals: SafetySignal[] }) => {
  if (signals.length === 0) {
    return null;
  }
  return (
    <Section>
      <Heading size="sm">Extended Network Flags · 2nd-degree</Heading>
      {signals.map((signal) => (
        <Row label={signal.objectLabel} variant="warning">
          <Text color="warning">{extendedAttribution(signal)}</Text>
        </Row>
      ))}
    </Section>
  );
};

/**
 * Provenance / identity signals — rendered as informational rows.
 */
const Provenance = ({ signals }: { signals: SafetySignal[] }) => {
  if (signals.length === 0) {
    return null;
  }
  return (
    <Section>
      <Heading size="sm">Provenance</Heading>
      {signals.map((signal) => (
        <Row label={signal.predicateLabel}>
          <Text color="muted">
            {signal.objectLabel}
            {signal.attributedAuthors.length > 0
              ? ` — ${formatAuthors(signal.attributedAuthors)}`
              : ''}
          </Text>
        </Row>
      ))}
    </Section>
  );
};

/**
 * 2nd-degree (extended-network) provenance — enrichment only, in its own block
 * below the 1st-degree provenance. Never changes whether a 1st-degree row shows.
 */
const ExtendedProvenance = ({ signals }: { signals: SafetySignal[] }) => {
  if (signals.length === 0) {
    return null;
  }
  return (
    <Section>
      <Heading size="sm">Extended Network · 2nd-degree</Heading>
      {signals.map((signal) => (
        <Row label={signal.predicateLabel}>
          <Text color="muted">
            {signal.objectLabel} — {extendedAttribution(signal)}
          </Text>
        </Row>
      ))}
    </Section>
  );
};

/**
 * Renders the full safety insight block, or null when there is nothing to show.
 *
 * @param safety - Categorized safety data
 * @returns JSX element or null
 */
export const renderSafetyInsight = (safety: SafetyData | undefined) => {
  if (!safety) {
    return null;
  }
  const { critical, warnings, provenance } = safety;
  if (critical.length === 0 && warnings.length === 0 && provenance.length === 0) {
    return null;
  }

  // Split the soft lane: 2nd-degree-only signals render in their own block below
  // the 1st-degree warnings. Hard-lane (non-critical reports) and any signal
  // also backed by a 1-hop/whitelist author stay in the primary warnings block.
  const primaryWarnings = warnings.filter(
    (s) => s.lane !== 'soft' || !isExtendedOnly(s),
  );
  const extendedWarnings = warnings.filter(
    (s) => s.lane === 'soft' && isExtendedOnly(s),
  );
  const primaryProvenance = provenance.filter((s) => !isExtendedOnly(s));
  const extendedProvenance = provenance.filter((s) => isExtendedOnly(s));

  return (
    <Box>
      <CriticalReports signals={critical} />
      <SafetyWarnings signals={primaryWarnings} />
      <ExtendedWarnings signals={extendedWarnings} />
      <Provenance signals={primaryProvenance} />
      <ExtendedProvenance signals={extendedProvenance} />
    </Box>
  );
};
