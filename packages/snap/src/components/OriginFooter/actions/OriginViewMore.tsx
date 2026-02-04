import { OriginProps, OriginType } from '../../../types';
import { vendor } from '../../../vendors';
import { FooterLink } from '../../Footer/FooterLink';

/**
 * CTA to view more details about the dApp origin on the vendor site.
 *
 * Renders when origin atom exists.
 * Returns null when: NoOrigin, NoAtom (nothing to view), or MetaMask origin
 */
export const OriginViewMore = (props: OriginProps) => {
  // Self-gate: only render when origin atom exists and is not MetaMask
  if (
    props.originType === OriginType.NoOrigin ||
    props.originType === OriginType.NoAtom ||
    props.originUrl === 'metamask'
  ) {
    return null;
  }

  const { url } = vendor.viewOriginAtom(props);

  return (
    <FooterLink
      href={url}
      label="View more about this dApp"
    />
  );
};

