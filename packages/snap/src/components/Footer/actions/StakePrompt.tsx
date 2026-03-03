import { Button } from '@metamask/snaps-sdk/jsx';
import { AccountProps, AccountType } from '../../../types';
import { vendor } from '../../../vendors';
import { FooterLink } from '../FooterLink';

/**
 * CTA to stake on a trust triple.
 *
 * Renders when:
 * - AccountType.AtomWithoutTrustTriple (prompt to complete the triple via vendor link)
 * - AccountType.AtomWithTrustTriple AND user has no existing position (interactive in-snap staking)
 *
 * Returns null when:
 * - AccountType.NoAtom
 * - User already has a position on the trust triple
 */
export const StakePrompt = (props: AccountProps) => {
  if (props.accountType === AccountType.NoAtom) {
    return null;
  }

  // Atom exists but no trust triple - link to vendor site to create it
  if (props.accountType === AccountType.AtomWithoutTrustTriple) {
    const { url } = vendor.atomWithoutTrustTriple(props);
    return (
      <FooterLink
        href={url}
        label="Is this address trustworthy? Vote"
      />
    );
  }

  // Trust triple exists - offer in-snap staking via interactive button
  if (props.accountType === AccountType.AtomWithTrustTriple) {
    const { triple, userAddress } = props;

    const hasPosition = userAddress ? (
      triple.positions.some(p => p.account_id?.toLowerCase() === userAddress.toLowerCase()) ||
      triple.counter_positions.some(p => p.account_id?.toLowerCase() === userAddress.toLowerCase())
    ) : false;

    if (hasPosition) {
      return null;
    }

    return (
      <Button name="stake_on_triple">Is this address trustworthy? Vote</Button>
    );
  }

  return null;
};

