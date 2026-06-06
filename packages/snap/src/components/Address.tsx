/**
 * Destination-address subject card.
 *
 * Groups ALL destination-address signals under a single labeled section so the
 * user can tell at a glance that everything inside refers to the address they
 * are interacting with (not the dApp origin, which lives in its own
 * {@link OriginBlock} card). The section header reads "Address · {alias}" when
 * an on-chain alias/ENS name is known, falling back to a truncated hex address.
 *
 * Two variants compose the shared safety/familiarity renderers over the address
 * payloads. The 'primary' variant shows the high-value tier inline on the
 * primary insight (critical reports, 1st-degree flags/provenance, and the 1-hop
 * "People you follow" block). The 'more' variant shows the lower-weight tier
 * pushed behind "More info" (2nd-degree flags/provenance and the
 * "Friends of people you follow" block). Each renderer is bare (no Section of
 * its own) so this single Section is the only card chrome.
 *
 * @module components/Address
 */

import { Box, Heading, Section, Address } from '@metamask/snaps-sdk/jsx';

import type { SafetyData } from '../safety/types';
import type { NetworkFamiliarity } from '../trusted-circle/types';
import type { AccountProps } from '../types';
import {
  renderOneHopFamiliarity,
  renderExtendedFamiliarity,
} from './NetworkFamiliarity';
import { renderPrimarySafety, renderExtendedSafety } from './Safety';
import { isHexAddress } from './ui';

/**
 * Heading for the address card: a plain "Destination" label (`md` subject
 * heading — no glyph) above the destination rendered with the
 * {@link Address} primitive for canonical truncation + any saved display name.
 * The avatar is intentionally OFF to keep the surface calm; the single
 * "Destination" label is enough to identify the subject. Falls back to a plain
 * alias/address heading when the destination isn't a bare hex address the
 * primitive can resolve.
 *
 * @param props - Props.
 * @param props.accountProps - Account props for the label.
 * @returns The address heading.
 */
const AddressHeading = ({ accountProps }: { accountProps: AccountProps }) => {
  if (isHexAddress(accountProps.address)) {
    return (
      <Box>
        <Heading size="md">Destination</Heading>
        <Address address={accountProps.address} displayName avatar={false} />
      </Box>
    );
  }
  const alias = accountProps.alias?.trim();
  return (
    <Heading size="md">
      {alias ? `Destination · ${alias}` : 'Destination'}
    </Heading>
  );
};

/**
 * Renders the destination-address subject card.
 *
 * @param props - Block props.
 * @param props.variant - Which slice to render: the inline primary tier or the more-info remainder.
 * @param props.accountProps - Account props (alias + address) for the header.
 * @param props.safety - The address's classified safety data, or undefined.
 * @param props.familiarity - The address's network familiarity, or undefined.
 * @returns The address card JSX, or null when there is nothing to show.
 */
export const AddressBlock = ({
  variant,
  accountProps,
  safety,
  familiarity,
}: {
  variant: 'primary' | 'more';
  accountProps: AccountProps;
  safety: SafetyData | undefined;
  familiarity: NetworkFamiliarity | undefined;
}) => {
  if (variant === 'primary') {
    const primarySafety = renderPrimarySafety(safety);
    const oneHop = renderOneHopFamiliarity(familiarity);
    if (!primarySafety && !oneHop) {
      return null;
    }
    return (
      <Section>
        <AddressHeading accountProps={accountProps} />
        {primarySafety}
        {oneHop}
      </Section>
    );
  }

  // 'more' variant: 2nd-degree safety + 2nd-degree familiarity.
  const extendedSafety = renderExtendedSafety(safety);
  const extendedFamiliarity = renderExtendedFamiliarity(familiarity);
  if (!extendedSafety && !extendedFamiliarity) {
    return null;
  }
  return (
    <Section>
      <AddressHeading accountProps={accountProps} />
      {extendedSafety}
      {extendedFamiliarity}
    </Section>
  );
};
