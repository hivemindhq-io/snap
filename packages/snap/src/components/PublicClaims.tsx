/**
 * Public-claims (escape-hatch) lane UI.
 *
 * Renders the stake-weighted "Public claims" lane: ANY claim about the subject,
 * UNFILTERED by the viewer's network. This is a More-info-only surface (never
 * promoted inline) — it exists so a cold-start subject with no network signal
 * still shows what the broader community has staked, clearly labeled as
 * unverified.
 *
 * Agreed claims (not disputed) render as a {@link Card} with the staker count and
 * total stake. Disputed claims render as a `warning` {@link Row} with a
 * {@link Value} showing both sides (FOR on the left, AGAINST on the right). When
 * more claims exist than are shown, a "View all N on Hive Mind" {@link Link}
 * follows a {@link Divider}.
 *
 * Because the More-info surface can render TWO public-claims blocks back to back
 * (one for the destination address, one for the dApp site), the heading is
 * subject-scoped — "This address · Public claims" / "This site · Public claims" —
 * so the two are distinguishable at a glance regardless of how long the hostname
 * is (the subject NOUN, not its value, is what's shown). The shared "unverified"
 * subtitle renders only once (on the first block) to avoid stacking the same
 * caveat twice.
 *
 * @module components/PublicClaims
 */

import {
  Box,
  Card,
  Divider,
  Link,
  Row,
  Text,
  Value,
} from '@metamask/snaps-sdk/jsx';

import { chainConfig } from '../config';
import type { PublicClaim, PublicClaims } from '../public-claims/types';
import { stringToDecimal } from '../util';
import { phraseClaim } from './NetworkFamiliarity';
import { SectionHeading } from './ui';

/**
 * Formats a wei-scale stake string into a compact display amount with the active
 * chain's currency symbol (e.g. "1.2K TRUST", "340 TRUST", "0.05 TRUST").
 * Sub-1 amounts keep two decimals; larger amounts drop to whole numbers or a
 * K-suffix so the lane stays scannable.
 *
 * @param wei - Wei-scale stake string.
 * @returns A display string like "1.2K TRUST".
 */
function formatTrust(wei: string): string {
  let value = 0;
  try {
    value = stringToDecimal(wei, chainConfig.decimalPrecision);
  } catch {
    value = 0;
  }

  const { currencySymbol } = chainConfig;

  let amount: string;
  if (value >= 1000) {
    amount = `${(value / 1000).toFixed(1)}K`;
  } else if (value >= 1) {
    amount = `${Math.round(value)}`;
  } else if (value > 0) {
    amount = value.toFixed(2);
  } else {
    amount = '0';
  }

  return `${amount} ${currencySymbol}`;
}

/**
 * Stakers-count copy, singular/plural aware.
 *
 * @param count - Distinct staker count.
 * @returns The singular or plural staker-count phrase.
 */
function stakersLabel(count: number): string {
  return count === 1 ? '1 staker' : `${count} stakers`;
}

/**
 * Renders a single AGREED (uncontested) public claim as a Card: the natural-
 * language phrase, the staker count as the description, and the total FOR stake
 * as the value.
 *
 * @param props - Props.
 * @param props.claim - The public claim.
 * @returns A Card element.
 */
const AgreedClaim = ({ claim }: { claim: PublicClaim }) => (
  <Card
    title={phraseClaim(claim)}
    description={stakersLabel(claim.forStakers)}
    value={formatTrust(claim.forStake)}
  />
);

/**
 * Renders a single DISPUTED public claim as a warning Row with a two-sided
 * Value: FOR (with its staker count) on the left, AGAINST (with its staker
 * count) on the right, so a contested claim reads as a caution rather than an
 * endorsement.
 *
 * @param props - Props.
 * @param props.claim - The disputed public claim.
 * @returns A warning Row with a Value element.
 */
const DisputedClaim = ({ claim }: { claim: PublicClaim }) => (
  <Row label={phraseClaim(claim)} variant="warning">
    <Value
      extra={`${formatTrust(claim.forStake)} for (${claim.forStakers})`}
      value={`${formatTrust(claim.againstStake)} against (${
        claim.againstStakers
      })`}
    />
  </Row>
);

/**
 * The subject a public-claims block describes. Drives the subject-scoped heading
 * ("This address" / "This site") so two stacked blocks are distinguishable.
 */
export type PublicClaimsSubject = 'address' | 'site';

/**
 * Subject-scoped heading text. The subject noun (not its value) leads the
 * heading so length is fixed regardless of how long a hostname is.
 *
 * @param subject - The subject the block describes.
 * @returns The heading string, e.g. "This address · Public claims".
 */
function headingFor(subject: PublicClaimsSubject): string {
  const lead = subject === 'site' ? 'This site' : 'This address';
  return `${lead} · Public claims`;
}

/**
 * Renders the "Public claims" lane, or null when there is nothing to show.
 *
 * @param publicClaims - The finalized public claims (sorted, top-N), or null.
 * @param options - Rendering options.
 * @param options.subject - The subject described (drives the scoped heading).
 * @param options.viewHref - Optional "View all on Hive Mind" URL (shown only
 * when the true total exceeds the shown count and an href is available).
 * @param options.showSubtitle - Whether to render the shared "unverified"
 * caveat subtitle. Pass `true` for the first rendered block only so the caveat
 * isn't stacked twice.
 * @returns The public-claims lane JSX, or null.
 */
export const renderPublicClaims = (
  publicClaims: PublicClaims | null | undefined,
  options: {
    subject: PublicClaimsSubject;
    viewHref?: string | undefined;
    showSubtitle?: boolean;
  },
) => {
  if (!publicClaims || publicClaims.claims.length === 0) {
    return null;
  }

  const { subject, viewHref, showSubtitle = false } = options;
  const { claims, total } = publicClaims;
  const showViewAll = total > claims.length && Boolean(viewHref);

  return (
    <Box>
      <SectionHeading>{headingFor(subject)}</SectionHeading>
      {showSubtitle ? (
        <Text color="muted">
          Unverified · anyone can post · not vetted by your network
        </Text>
      ) : null}
      {claims.map((claim) =>
        claim.disputed ? (
          <DisputedClaim claim={claim} />
        ) : (
          <AgreedClaim claim={claim} />
        ),
      )}
      {showViewAll ? (
        <Box>
          <Divider />
          <Link
            href={viewHref as string}
          >{`View all ${total} on Hive Mind`}</Link>
        </Box>
      ) : null}
    </Box>
  );
};
