import { Box, Divider } from '@metamask/snaps-sdk/jsx';
import { AccountProps, OriginProps, OriginType } from '../types';
import { CreateTrustTriple } from './Footer/actions/CreateTrustTriple';
import { StakePrompt } from './Footer/actions/StakePrompt';
import { ViewMore } from './Footer/actions/ViewMore';
import { OriginViewMore } from './OriginFooter/actions/OriginViewMore';
import { shouldSuppressOrigin } from '../util';

/**
 * Unified footer component that renders all CTAs at the bottom.
 * Combines account (destination address) and origin (dApp) CTAs.
 *
 * Structure:
 * 1. Divider for visual separation
 * 2. Account CTAs (address-related actions)
 * 3. Origin "View more" link (dApp-related - voting CTAs are inline in Origin section)
 *
 * Each action component is self-gating: it returns null if conditions aren't met.
 *
 * Note: Origin voting/creation CTAs and "Add alias" are now inline within
 * their respective sections for better contextual UX.
 */
export const UnifiedFooter = ({
  accountProps,
  originProps,
}: {
  accountProps: AccountProps;
  originProps: OriginProps;
}) => {
  const hasOriginAtom =
    !shouldSuppressOrigin(originProps.originUrl, originProps.hostname) &&
    (originProps.originType === OriginType.AtomWithoutTrustTriple ||
     originProps.originType === OriginType.AtomWithTrustTriple);

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

        {/* ─────────────────────────────────────────────────────────────────
         * Origin CTAs - Only "View more" (voting CTAs are inline in Origin section)
         * ───────────────────────────────────────────────────────────────── */}
        {hasOriginAtom && <OriginViewMore {...originProps} />}
      </Box>
    </Box>
  );
};
