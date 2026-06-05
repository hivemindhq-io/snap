/**
 * dApp origin block.
 *
 * The dApp origin is rendered with the SAME trust-circle paradigm as the
 * destination address: its safety read surface (scoped to the URL/site claim
 * vocabulary) and network familiarity flow through the shared renderers. There
 * is no longer a bespoke "Trustworthy %", FOR/AGAINST circle, or market-cap
 * block — those have been removed.
 *
 * Two variants compose the shared renderers over the origin payloads. The
 * 'primary' variant shows the critical danger banner only (inline, when the dApp
 * has a critical safety report). The 'more' variant shows everything else:
 * non-critical safety, 1-hop/2-hop familiarity, and a single contextual link
 * (add trust data when no atom exists, or view the dApp on Hive Mind when it
 * does).
 *
 * @module components/Origin
 */

import { Text, Heading, Section, Link } from '@metamask/snaps-sdk/jsx';

import type { SafetyData } from '../safety/types';
import type { NetworkFamiliarity } from '../trusted-circle/types';
import { OriginType, type OriginProps } from '../types';
import { vendor } from '../vendors';
import { renderNetworkInsight } from './NetworkFamiliarity';
import { renderCriticalSafety, renderNonCriticalSafety } from './Safety';

/**
 * Heading for the dApp block, scoped to the hostname when known.
 *
 * @param props - The hostname to display.
 * @param props.hostname - The dApp hostname (e.g. "app.uniswap.org").
 * @returns The dApp heading.
 */
const OriginHeading = ({ hostname }: { hostname: string | undefined }) => (
  <Heading size="sm">{hostname ? `dApp · ${hostname}` : 'dApp'}</Heading>
);

/**
 * The single contextual link for the dApp: "add trust data" when the dApp has
 * no atom yet, or "view on Hive Mind" when an atom exists. Returns null when no
 * link can be built.
 *
 * @param props - Origin props (carries the origin type + hostname/atom).
 * @returns A Link, or null.
 */
const OriginLink = (props: OriginProps) => {
  if (props.originType === OriginType.NoAtom) {
    if (!props.hostname && !props.originUrl) {
      return null;
    }
    const { url } = vendor.originNoAtom(props);
    return (
      <Text>
        <Link href={url}>Be first to add trust data for this dApp ↗</Link>
      </Text>
    );
  }

  if (props.originType === OriginType.HasAtom) {
    const { url } = vendor.viewOriginAtom(props);
    return (
      <Text>
        <Link href={url}>View this dApp on Hive Mind ↗</Link>
      </Text>
    );
  }

  return null;
};

/**
 * Renders the dApp origin block.
 *
 * @param props - Block props.
 * @param props.variant - Which slice to render: the primary critical banner or the more-info remainder.
 * @param props.originProps - Origin props (type + hostname/atom) for the link.
 * @param props.safety - The origin's classified safety data, or null.
 * @param props.familiarity - The origin's network familiarity, or null.
 * @returns The dApp block JSX, or null when there is nothing to show.
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

  // 'more' variant: non-critical safety + familiarity + the contextual link.
  const nonCritical = renderNonCriticalSafety(safety);
  const network = renderNetworkInsight(familiarity);
  const link = OriginLink(originProps);

  if (!nonCritical && !network && !link) {
    return null;
  }

  return (
    <Section>
      <OriginHeading hostname={originProps.hostname} />
      {nonCritical}
      {network}
      {link}
    </Section>
  );
};
