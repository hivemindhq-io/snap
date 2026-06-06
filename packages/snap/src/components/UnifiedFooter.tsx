import { Box, Divider } from '@metamask/snaps-sdk/jsx';

import type { AccountProps, OriginProps } from '../types';
import { AddressAction } from './Footer/actions/AddressAction';
import { SiteAction } from './Footer/actions/SiteActions';

/**
 * Unified footer for the insight panel: all outbound actions live here, grouped
 * by subject, so the cards above stay signals-only (evidence) and every "view /
 * contribute" affordance (action) is consolidated below a single divider.
 *
 * Model A — one link per subject, max two lines:
 * 1. Destination address action ({@link AddressAction}).
 * 2. Site (dApp origin) action ({@link SiteAction}), unless the origin is
 *    suppressed (no origin / metamask / localhost / browser-extension origin).
 *
 * Each action is self-gating and renders at most one link, so the footer never
 * exceeds two lines.
 *
 * @param options0 - Footer props.
 * @param options0.accountProps - Destination-address props for the address action.
 * @param options0.originProps - Origin props for the site action.
 * @param options0.suppressOrigin - When true, the site action is omitted.
 * @returns The unified footer JSX.
 */
export const UnifiedFooter = ({
  accountProps,
  originProps,
  suppressOrigin,
}: {
  accountProps: AccountProps;
  originProps: OriginProps;
  suppressOrigin: boolean;
}) => {
  return (
    <Box>
      <Divider />
      <Box>
        <AddressAction {...accountProps} />
        {suppressOrigin ? null : <SiteAction {...originProps} />}
      </Box>
    </Box>
  );
};
