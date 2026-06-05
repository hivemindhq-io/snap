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

import {
  Box,
  Row,
  Text,
  Heading,
  Section,
  Bold,
  type JSXElement,
} from '@metamask/snaps-sdk/jsx';

import type {
  SafetyData,
  SafetySignal,
  SafetyAuthor,
  SafetySource,
} from '../safety/types';

const MAX_AUTHORS = 3;

/** Display order + heading for each attribution tier (Option 2 sub-rows). */
const SOURCE_TIERS: { source: SafetySource; label: string }[] = [
  { source: 'authority', label: 'Authority' },
  { source: 'follow', label: 'Your follows' },
  { source: 'extended', label: 'Extended network' },
];

/**
 * Formats the attribution authors into a short readable string.
 * Authors are shown by their on-chain identity (ENS name, else truncated
 * hex address), e.g. "alice.eth, 0x1234...5678 +2 more".
 * @param authors
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

/**
 * Largest number of the viewer's follows that bridge to any single degree-2
 * author in a group — the "via N follows" path strength for the extended tier.
 * @param authors
 */
function maxVia(authors: SafetyAuthor[]): number {
  let max = 0;
  for (const author of authors) {
    if (author.via) {
      max = Math.max(max, author.via.length);
    }
  }
  return max;
}

/**
 * Option 2 attribution: one labeled sub-row per source tier (Authority / Your
 * follows / Extended network), so a whitelisted authority, a 1-hop follow, and
 * a friend-of-a-friend are never conflated into one flat list. Tiers with no
 * authors are omitted. The extended tier carries a "via N follows" suffix to
 * keep the transitive nature explicit. `color` matches the parent claim's tone.
 *
 * @param signal - The classified safety signal.
 * @param color - Text color for the value lines ('error' | 'warning' | 'muted').
 * @returns A Box of per-tier Text lines, or null when there are no authors.
 */
function attributionRows(
  signal: SafetySignal,
  color: 'error' | 'warning' | 'muted',
): JSXElement | null {
  const tiers = SOURCE_TIERS.map((tier) => ({
    tier,
    authors: signal.attributedAuthors.filter(
      (author) => author.source === tier.source,
    ),
  })).filter((entry) => entry.authors.length > 0);

  if (tiers.length === 0) {
    return null;
  }

  return (
    <Box>
      {tiers.map(({ tier, authors }) => {
        const bridges = maxVia(authors);
        const suffix =
          tier.source === 'extended' && bridges > 0
            ? ` · via ${bridges} of your follows`
            : '';
        return (
          <Text color={color}>
            <Bold>{tier.label}:</Bold> {formatAuthors(authors)}
            {suffix}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Whether a signal's only attribution is the extended network (degree-2) — i.e.
 * no whitelisted authority and no 1-hop trust-circle author backs it. These
 * render in a separate, lower-weight 2nd-degree block.
 * @param signal
 */
function isExtendedOnly(signal: SafetySignal): boolean {
  return (
    signal.fromExtendedNetwork &&
    !signal.fromWhitelist &&
    !signal.fromTrustCircle
  );
}

/**
 * Counts the distinct bridges backing a degree-2 signal: the largest number of
 * the viewer's follows reaching any single degree-2 author on it. This is the
 * 2-hop "path strength" — stake is never consulted.
 * @param signal
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
 * @param signal
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
 * @param options0
 * @param options0.signals
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
          {attributionRows(signal, 'error') ?? <Text color="error"> </Text>}
        </Row>
      ))}
    </Section>
  );
};

/**
 * Soft flags + non-critical hard reports — rendered as caution rows.
 * @param options0
 * @param options0.signals
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
          {attributionRows(signal, 'warning') ?? <Text color="warning"> </Text>}
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
 * @param options0
 * @param options0.signals
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
 * @param options0
 * @param options0.signals
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
 * @param options0
 * @param options0.signals
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
 * Splits a SafetyData into its primary (1st-degree / whitelist) and extended
 * (2nd-degree-only) signal groups, so the primary and extended renderers
 * partition the same data consistently. Primary warnings are the hard-lane
 * (non-critical) reports plus any soft signal also backed by a 1-hop/whitelist
 * author; extended warnings are the soft signals whose only attribution is the
 * extended network (degree-2).
 *
 * @param safety - Categorized safety data.
 * @returns The primary/extended signal groups.
 */
function splitSafety(safety: SafetyData) {
  const { critical, warnings, provenance } = safety;
  return {
    critical,
    primaryWarnings: warnings.filter(
      (signal) => signal.lane !== 'soft' || !isExtendedOnly(signal),
    ),
    extendedWarnings: warnings.filter(
      (signal) => signal.lane === 'soft' && isExtendedOnly(signal),
    ),
    primaryProvenance: provenance.filter((signal) => !isExtendedOnly(signal)),
    extendedProvenance: provenance.filter((signal) => isExtendedOnly(signal)),
  };
}

/**
 * Renders the PRIMARY safety block: critical authority reports, 1st-degree /
 * whitelist warnings, and 1st-degree provenance. This is the high-value tier
 * shown inline on the primary insight. Returns null when there is nothing.
 *
 * @param safety - Categorized safety data.
 * @returns JSX element or null.
 */
export const renderPrimarySafety = (safety: SafetyData | undefined) => {
  if (!safety) {
    return null;
  }
  const { critical, primaryWarnings, primaryProvenance } = splitSafety(safety);
  if (
    critical.length === 0 &&
    primaryWarnings.length === 0 &&
    primaryProvenance.length === 0
  ) {
    return null;
  }

  return (
    <Box>
      <CriticalReports signals={critical} />
      <SafetyWarnings signals={primaryWarnings} />
      <Provenance signals={primaryProvenance} />
    </Box>
  );
};

/**
 * Renders the EXTENDED safety block: 2nd-degree-only warnings and 2nd-degree
 * provenance. This is the lower-weight, friend-of-a-friend tier pushed behind
 * the "More info" page. Returns null when there is nothing.
 *
 * @param safety - Categorized safety data.
 * @returns JSX element or null.
 */
export const renderExtendedSafety = (safety: SafetyData | undefined) => {
  if (!safety) {
    return null;
  }
  const { extendedWarnings, extendedProvenance } = splitSafety(safety);
  if (extendedWarnings.length === 0 && extendedProvenance.length === 0) {
    return null;
  }

  return (
    <Box>
      <ExtendedWarnings signals={extendedWarnings} />
      <ExtendedProvenance signals={extendedProvenance} />
    </Box>
  );
};

/**
 * Renders ONLY the critical authority reports (the danger banner). Used by the
 * dApp-origin surface, which shows critical reports inline on the primary view
 * and pushes everything else behind "More info". Returns null when there are no
 * critical reports.
 *
 * @param safety - Categorized safety data.
 * @returns JSX element or null.
 */
export const renderCriticalSafety = (safety: SafetyData | undefined) => {
  if (!safety || safety.critical.length === 0) {
    return null;
  }

  return (
    <Box>
      <CriticalReports signals={safety.critical} />
    </Box>
  );
};

/**
 * Renders the NON-CRITICAL safety block: every warning and provenance signal
 * EXCEPT the critical danger banner — 1st-degree warnings + provenance and the
 * 2nd-degree (extended-network) warnings + provenance, partitioned exactly like
 * {@link renderPrimarySafety} / {@link renderExtendedSafety}. Used by the
 * dApp-origin "More info" surface (critical reports are shown inline up top).
 * Returns null when there is nothing non-critical.
 *
 * @param safety - Categorized safety data.
 * @returns JSX element or null.
 */
export const renderNonCriticalSafety = (safety: SafetyData | undefined) => {
  if (!safety) {
    return null;
  }
  const {
    primaryWarnings,
    extendedWarnings,
    primaryProvenance,
    extendedProvenance,
  } = splitSafety(safety);
  if (
    primaryWarnings.length === 0 &&
    extendedWarnings.length === 0 &&
    primaryProvenance.length === 0 &&
    extendedProvenance.length === 0
  ) {
    return null;
  }

  return (
    <Box>
      <SafetyWarnings signals={primaryWarnings} />
      <Provenance signals={primaryProvenance} />
      <ExtendedWarnings signals={extendedWarnings} />
      <ExtendedProvenance signals={extendedProvenance} />
    </Box>
  );
};

/**
 * Renders the full safety insight block (primary + extended), or null when
 * there is nothing to show. Thin wrapper retained for back-compat; the
 * interactive insight uses the split renderers directly.
 *
 * @param safety - Categorized safety data.
 * @returns JSX element or null.
 */
export const renderSafetyInsight = (safety: SafetyData | undefined) => {
  const primary = renderPrimarySafety(safety);
  const extended = renderExtendedSafety(safety);
  if (!primary && !extended) {
    return null;
  }

  return (
    <Box>
      {primary}
      {extended}
    </Box>
  );
};
