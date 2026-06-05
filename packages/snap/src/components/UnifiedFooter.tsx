import { Box, Divider } from '@metamask/snaps-sdk/jsx';

import type { AccountProps, OriginProps } from '../types';
import { CreateTrustTriple } from './Footer/actions/CreateTrustTriple';
import { StakePrompt } from './Footer/actions/StakePrompt';
import { ViewMore } from './Footer/actions/ViewMore';

/**
 * Unified footer component that renders the destination-address CTAs at the
 * bottom of the insight.
 *
 * The dApp-origin CTA (add trust data / view on Hive Mind) is no longer here —
 * it lives inline in the dApp {@link OriginBlock} "More info" section so the
 * link sits next to the dApp's own trust signals.
 *
 * Each action component is self-gating: it returns null if conditions aren't met.
 * @param options0
 * @param options0.accountProps
 * @param options0.originProps
 */
export const UnifiedFooter = ({
  accountProps,
}: {
  accountProps: AccountProps;
  originProps: OriginProps;
}) => {
  return (
    <Box>
      <Divider />
      <Box>
        {/* ─────────────────────────────────────────────────────────────────
         * Account CTAs - Destination Address Actions
         * ───────────────────────────────────────────────────────────────── */}

        {/* Priority 1: Create trust triple (no atom) */}
        <CreateTrustTriple {...accountProps} />

        {/* Priority 2: Stake on trust triple */}
        <StakePrompt {...accountProps} />

        {/* Always: View more on vendor site */}
        <ViewMore {...accountProps} />
      </Box>
    </Box>
  );
};
