/**
 * Public-claims (escape-hatch) lane.
 *
 * Surfaces ANY stake-weighted claim about a subject (address or domain),
 * unfiltered by the viewer's network, shown only behind the "More info" click.
 *
 * @module public-claims
 */

export { getPublicClaims, finalizePublicClaims } from './service';
export type { PublicClaim, PublicClaims } from './types';
