/**
 * User Position UI Component.
 *
 * Displays the user's own trust/distrust position on the current
 * address/origin trust triple. This is the strongest signal available
 * and should be displayed prominently.
 *
 * @module components/UserPosition
 */

import { Row, Text, Heading, Section, Bold } from '@metamask/snaps-sdk/jsx';
import type { UserPositionData } from '../types';
import { chainConfig } from '../config';

/**
 * Formats a shares value for display.
 * Converts from wei (18 decimals) to human-readable format.
 *
 * @param shares - The shares value as a string (in wei)
 * @returns Formatted string like "0.98 TRUST"
 */
function formatShares(shares: string): string {
  const sharesNum = BigInt(shares);
  const decimals = chainConfig.decimalPrecision;
  const divisor = BigInt(10 ** decimals);

  const integerPart = sharesNum / divisor;
  const fractionalPart = (sharesNum % divisor) * 100n / divisor;

  const integerStr = Number(integerPart).toLocaleString();
  const formatted = fractionalPart > 0
    ? `${integerStr}.${fractionalPart.toString().padStart(2, '0')}`
    : integerStr;

  return `${formatted} ${chainConfig.currencySymbol}`;
}

/**
 * Props for UserPositionSection component.
 */
export interface UserPositionSectionProps {
  /** User's position on the FOR side (trusts) */
  userPosition?: UserPositionData[];
  /** User's position on the AGAINST side (distrusts) */
  userCounterPosition?: UserPositionData[];
}

/**
 * Displays the user's own position on the current trust triple.
 *
 * This is the most important trust signal - the user's own prior judgment.
 * Shows FOR (trust) and AGAINST (distrust) positions with stake amounts.
 * Hides entirely if user has no position.
 *
 * @param props - Component props with user position data
 * @returns JSX element or null
 */
export const UserPositionSection = ({
  userPosition,
  userCounterPosition,
}: UserPositionSectionProps) => {
  // Get first position from each array (user should only have one per side)
  const forPosition = userPosition?.[0];
  const againstPosition = userCounterPosition?.[0];

  // Hide section entirely if user has no position
  if (!forPosition && !againstPosition) {
    return null;
  }

  return (
    <Section>
      <Heading size="sm">Your Position</Heading>

      {forPosition ? (
        <Row label="You TRUST">
          <Text color="success">
            <Bold>{formatShares(forPosition.shares)}</Bold>
          </Text>
        </Row>
      ) : null}

      {againstPosition ? (
        <Row label="You DISTRUST">
          <Text color="warning">
            <Bold>{formatShares(againstPosition.shares)}</Bold>
          </Text>
        </Row>
      ) : null}
    </Section>
  );
};
