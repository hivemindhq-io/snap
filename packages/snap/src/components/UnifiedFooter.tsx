import { Box, Divider, Button } from '@metamask/snaps-sdk/jsx';
import { AccountProps, AccountType, OriginProps, OriginType } from '../types';
import { CreateTrustTriple } from './Footer/actions/CreateTrustTriple';
import { StakePrompt } from './Footer/actions/StakePrompt';
import { CreateAlias } from './Footer/actions/CreateAlias';
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
 * Note: Origin voting/creation CTAs are now inline within the Origin section
 * for better contextual UX. Only "View more" remains in the footer.
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

  const MIN_POSITIONS_FOR_AI_SUMMARY = 3;

  const showAISummary =
    accountProps.accountType === AccountType.AtomWithTrustTriple &&
    (() => {
      const forCount = accountProps.triple?.term?.vaults?.[0]?.position_count ?? 0;
      const againstCount = accountProps.triple?.counter_term?.vaults?.[0]?.position_count ?? 0;
      return forCount + againstCount >= MIN_POSITIONS_FOR_AI_SUMMARY;
    })();

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

        {/* Priority 3: Create alias */}
        <CreateAlias {...accountProps} />

        {/* Always: View more on vendor site */}
        <ViewMore {...accountProps} />

        {/* ─────────────────────────────────────────────────────────────────
         * Origin CTAs - Only "View more" (voting CTAs are inline in Origin section)
         * ───────────────────────────────────────────────────────────────── */}
        {hasOriginAtom && <OriginViewMore {...originProps} />}

        {/* ─────────────────────────────────────────────────────────────────
         * AI Summary - Only shown when there's enough community activity
         * for the AI to synthesize beyond what raw numbers already convey.
         * Requires a trust triple with 3+ total positions (FOR + AGAINST).
         * ───────────────────────────────────────────────────────────────── */}
        {showAISummary && (
          <Button name="ai_summary">AI Summary</Button>
        )}
      </Box>
    </Box>
  );
};

