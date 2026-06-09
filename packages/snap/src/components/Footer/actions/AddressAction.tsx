import type { AccountProps } from '../../../types';
import { AccountType } from '../../../types';
import { vendor } from '../../../vendors';
import { FooterLink } from '../FooterLink';

/**
 * The single destination-address footer action, Model A: one link per subject.
 *
 * Priority (highest to lowest):
 * - {@link AccountType.NoAtom}: invite the user to add the first claim.
 * - {@link AccountType.AtomWithoutTrustTriple}: prompt to vote on trust.
 * - {@link AccountType.AtomWithTrustTriple} with no existing user position:
 *   prompt to vote on trust.
 * - {@link AccountType.AtomWithTrustTriple} where the user already has a
 *   position: fall back to a plain "see what others say" view link.
 *
 * Collapsing vote + view into a single link keeps the address subject to one
 * footer line.
 *
 * @param props - Account props (type + address/atom/triple).
 * @returns A single footer link for the address, or null.
 */
export const AddressAction = (props: AccountProps) => {
  if (props.accountType === AccountType.NoAtom) {
    const { url } = vendor.noAtom(props);
    return <FooterLink href={url} label="Be the first to add a claim about this address" />;
  }

  if (props.accountType === AccountType.AtomWithoutTrustTriple) {
    const { url } = vendor.atomWithoutTrustTriple(props);
    return <FooterLink href={url} label="Is this address trustworthy? Vote" />;
  }

  // AtomWithTrustTriple: vote when the user has no position yet, otherwise view.
  const { triple, userAddress } = props;
  const hasPosition = userAddress
    ? triple.positions.some(
        (p) => p.account_id?.toLowerCase() === userAddress.toLowerCase(),
      ) ||
      triple.counter_positions.some(
        (p) => p.account_id?.toLowerCase() === userAddress.toLowerCase(),
      )
    : false;

  if (!hasPosition) {
    const { url } = vendor.atomWithTrustTriple(props);
    return <FooterLink href={url} label="Is this address trustworthy? Vote" />;
  }

  const { url } = vendor.viewAtom(props);
  return <FooterLink href={url} label="Address reputation" />;
};
