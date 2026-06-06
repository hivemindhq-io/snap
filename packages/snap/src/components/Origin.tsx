/**
 * Site (dApp origin) block.
 *
 * The site is rendered with the SAME trust-circle paradigm as the destination
 * address: its safety read surface (scoped to the URL/site claim vocabulary) and
 * network familiarity flow through the shared renderers. There is no longer a
 * bespoke "Trustworthy %", FOR/AGAINST circle, or market-cap block — those have
 * been removed.
 *
 * The block is signals-only (evidence): it renders nothing but trust signals.
 * All outbound "view / contribute" actions live in the {@link UnifiedFooter}
 * (grouped by subject), so an origin with no signals produces no box at all.
 *
 * Two variants compose the shared renderers over the origin payloads. The
 * 'primary' variant shows the critical danger banner only (inline, when the site
 * has a critical safety report). The 'more' variant shows everything else:
 * non-critical safety and 1-hop/2-hop familiarity.
 *
 * @module components/Origin
 */

import { Box, Text, Section, Heading } from '@metamask/snaps-sdk/jsx';

import type { SafetyData } from '../safety/types';
import type { NetworkFamiliarity } from '../trusted-circle/types';
import { OriginType, type OriginProps } from '../types';
import { renderNetworkInsight } from './NetworkFamiliarity';
import { renderCriticalSafety, renderNonCriticalSafety } from './Safety';

/**
 * Heading for the site block: a plain "Site" role label (`md` subject heading —
 * no glyph) above the hostname, mirroring the {@link AddressBlock} two-tier
 * "Destination" + address header. Splitting the label and hostname onto separate
 * lines keeps the role marker parallel to the address card and avoids the
 * single-line "Site · {long.host.name}" wrapping that orphaned the "Site ·"
 * prefix. Falls back to the bare "Site" label when no hostname is known.
 *
 * @param props - The hostname to display.
 * @param props.hostname - The site hostname (e.g. "app.uniswap.org").
 * @returns The site heading.
 */
const OriginHeading = ({ hostname }: { hostname: string | undefined }) => {
  if (!hostname) {
    return <Heading size="md">Site</Heading>;
  }
  return (
    <Box>
      <Heading size="md">Site</Heading>
      <Text>{hostname}</Text>
    </Box>
  );
};

/**
 * Renders the site (dApp origin) block. Signals-only: no contextual link (those
 * live in the {@link UnifiedFooter}).
 *
 * @param props - Block props.
 * @param props.variant - Which slice to render: the primary critical banner or the more-info remainder.
 * @param props.originProps - Origin props (type + hostname/atom) for the heading.
 * @param props.safety - The origin's classified safety data, or null.
 * @param props.familiarity - The origin's network familiarity, or null.
 * @returns The site block JSX, or null when there are no signals to show.
 */
export const OriginBlock = ({
  variant,
  originProps,
  safety,
  familiarity,
}: {
  variant: 'primary' | 'more';
  originProps: OriginProps;
  safety: SafetyData | undefined;
  familiarity: NetworkFamiliarity | undefined;
}) => {
  if (originProps.originType === OriginType.NoOrigin) {
    return null;
  }

  if (variant === 'primary') {
    const critical = renderCriticalSafety(safety);
    if (!critical) {
      return null;
    }
    return (
      <Section>
        <OriginHeading hostname={originProps.hostname} />
        {critical}
      </Section>
    );
  }

  // 'more' variant: non-critical safety + familiarity (signals only).
  const nonCritical = renderNonCriticalSafety(safety);
  const network = renderNetworkInsight(familiarity);

  if (!nonCritical && !network) {
    return null;
  }

  return (
    <Section>
      <OriginHeading hostname={originProps.hostname} />
      {nonCritical}
      {network}
    </Section>
  );
};
