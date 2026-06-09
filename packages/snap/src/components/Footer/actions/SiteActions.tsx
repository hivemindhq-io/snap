import type { OriginProps } from '../../../types';
import { OriginType } from '../../../types';
import { vendor } from '../../../vendors';
import { FooterLink } from '../FooterLink';

/**
 * The single site (dApp origin) footer action, Model A: one link per subject.
 *
 * - {@link OriginType.NoAtom}: invite the user to be the first to add a claim
 *   about the site.
 * - {@link OriginType.HasAtom}: link out to see what others say about the site.
 * - {@link OriginType.NoOrigin}: nothing to link to (returns null).
 *
 * Self-gating: returns null when there is no actionable origin.
 *
 * @param props - Origin props (type + hostname/atom).
 * @returns A single footer link for the site, or null.
 */
export const SiteAction = (props: OriginProps) => {
  if (props.originType === OriginType.NoAtom) {
    // No hostname/url means we can't build a meaningful destination.
    if (!props.hostname && !props.originUrl) {
      return null;
    }
    const { url } = vendor.originNoAtom(props);
    return <FooterLink href={url} label="Be the first to add a claim about this site" />;
  }

  if (props.originType === OriginType.HasAtom) {
    const { url } = vendor.viewOriginAtom(props);
    return <FooterLink href={url} label="Site reputation" />;
  }

  return null;
};
