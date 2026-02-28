import { Box, Divider, Button } from '@metamask/snaps-sdk/jsx';
import { AccountProps, AccountType, OriginProps, OriginType } from '../types';
import type { FeatureConfig } from '../feature-config';
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
 * AI Summary visibility is controlled by remote feature config:
 * - ai.enabled must be true
 * - aiAllowed must be true (user passed all gating checks)
 * - Position count must meet ai.gating.minPositionCount threshold
 *
 * Note: Origin voting/creation CTAs and "Add alias" are now inline within
 * their respective sections for better contextual UX.
 */
export const UnifiedFooter = ({
  accountProps,
  originProps,
  featureConfig,
  aiAllowed,
}: {
  accountProps: AccountProps;
  originProps: OriginProps;
  featureConfig: FeatureConfig;
  aiAllowed: boolean;
}) => {
  const hasOriginAtom =
    !shouldSuppressOrigin(originProps.originUrl, originProps.hostname) &&
    (originProps.originType === OriginType.AtomWithoutTrustTriple ||
     originProps.originType === OriginType.AtomWithTrustTriple);

  const minPositions = featureConfig.ai.gating.minPositionCount;

  const showAISummary =
    aiAllowed &&
    accountProps.accountType === AccountType.AtomWithTrustTriple &&
    (() => {
      const forCount = accountProps.triple?.term?.vaults?.[0]?.position_count ?? 0;
      const againstCount = accountProps.triple?.counter_term?.vaults?.[0]?.position_count ?? 0;
      return forCount + againstCount >= minPositions;
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

