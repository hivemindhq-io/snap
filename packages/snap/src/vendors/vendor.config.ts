/**
 * VENDOR CONFIGURATION - Reference Implementation
 *
 * This is a complete working example for Hive Mind Explorer.
 * To customize for your own explorer:
 *
 *   1. Copy this file:
 *      cp vendor.config.example.ts vendor.config.ts
 *
 *   2. Edit vendor.config.ts with your explorer's URLs and patterns
 *
 *   3. The vendor.config.ts file is git-ignored, so your customizations
 *      won't conflict with upstream changes.
 *
 * You have FULL CONTROL over URL generation. Modify paths, query params,
 * or use completely different URL structures for your explorer.
 */

import { AccountType, PropsForAccountType, OriginType, PropsForOriginType } from '../types';
import { chainConfig, type ChainConfig } from '../config';
import { addressToCaip10 } from '../util';

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURATION - Customize these values for your explorer
 * ═══════════════════════════════════════════════════════════════════════════ */

const VENDOR_NAME = 'Hive Mind Explorer';

const EXPLORER_ORIGINS: Record<number, string> = {
  // Intuition Mainnet
  1155: 'https://beta.explorer.hivemindhq.io',
  // Intuition Testnet
  13579: 'https://testnet.explorer.hivemindhq.io',
};

// Get the base URL for the current chain (fallback to mainnet if chain not configured)
const FALLBACK_URL = 'https://beta.explorer.hivemindhq.io';
const baseUrl: string = EXPLORER_ORIGINS[chainConfig.chainId] ?? FALLBACK_URL;

/* ═══════════════════════════════════════════════════════════════════════════
 * TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

type UrlResult = { url: string };

/** Props for actions that require an atom to exist */
type PropsWithAtom =
  | PropsForAccountType<AccountType.AtomWithoutTrustTriple>
  | PropsForAccountType<AccountType.AtomWithTrustTriple>;

/** Props for origin actions that require an origin atom to exist */
type OriginPropsWithAtom =
  | PropsForOriginType<OriginType.AtomWithoutTrustTriple>
  | PropsForOriginType<OriginType.AtomWithTrustTriple>;

export type VendorConfig = {
  name: string;
  logo?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Destination Address Actions
  // ─────────────────────────────────────────────────────────────────────────

  /** Generate URL when no atom exists for the address */
  noAtom: (props: PropsForAccountType<AccountType.NoAtom>) => UrlResult;

  /** Generate URL when atom exists but no trust triple */
  atomWithoutTrustTriple: (
    props: PropsForAccountType<AccountType.AtomWithoutTrustTriple>
  ) => UrlResult;

  /** Generate URL when trust triple exists (for staking) */
  atomWithTrustTriple: (
    props: PropsForAccountType<AccountType.AtomWithTrustTriple>
  ) => UrlResult;

  /** Generate URL for viewing atom details */
  viewAtom: (props: PropsWithAtom) => UrlResult;

  /** Generate URL for creating an alias */
  createAlias: (props: PropsWithAtom) => UrlResult;

  // ─────────────────────────────────────────────────────────────────────────
  // dApp Origin Actions
  // ─────────────────────────────────────────────────────────────────────────

  /** Generate URL when no atom exists for the origin URL (unknown dApp) */
  originNoAtom: (props: PropsForOriginType<OriginType.NoAtom>) => UrlResult;

  /** Generate URL when origin atom exists but no trust triple */
  originAtomWithoutTrustTriple: (
    props: PropsForOriginType<OriginType.AtomWithoutTrustTriple>
  ) => UrlResult;

  /** Generate URL when origin trust triple exists (for staking) */
  originAtomWithTrustTriple: (
    props: PropsForOriginType<OriginType.AtomWithTrustTriple>
  ) => UrlResult;

  /** Generate URL for viewing origin atom details */
  viewOriginAtom: (props: OriginPropsWithAtom) => UrlResult;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * URL BUILDERS - Customize these functions for your explorer's URL structure
 * ═══════════════════════════════════════════════════════════════════════════ */

export const vendorConfig: VendorConfig = {
  name: VENDOR_NAME,

  /**
   * No atom exists for this address.
   * Link to create an atom + trust triple.
   *
   * Slim API: Only send address + chain_id.
   * Explorer derives hasTagAtomId + trustworthyAtomId from its config.
   */
  noAtom: (params) => {
    const { address, chainId, isContract } = params;
    const addressToUse = isContract ? addressToCaip10(address, chainId) : address;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'complete_trust_triple');
    url.searchParams.set('address', addressToUse);
    url.searchParams.set('chain_id', chainId);

    return { url: url.toString() };
  },

  /**
   * Atom exists but no trust triple.
   * Link to create the trust triple.
   *
   * Slim API: Only send atom_id.
   * Explorer derives hasTagAtomId + trustworthyAtomId from its config.
   */
  atomWithoutTrustTriple: (params) => {
    const { account } = params;
    if (!account) throw new Error('atomWithoutTrustTriple: account not found');

    const { term_id: atomId } = account;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'create_trust_triple');
    url.searchParams.set('atom_id', atomId);

    return { url: url.toString() };
  },

  /**
   * Trust triple exists.
   * Link to stake on it.
   *
   * Slim API: Only send triple_id.
   * User will stake on the triple page.
   */
  atomWithTrustTriple: (params) => {
    const { triple } = params;
    if (!triple) throw new Error('atomWithTrustTriple: triple not found');

    const { term_id: tripleId } = triple;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'stake_trust_triple');
    url.searchParams.set('triple_id', tripleId);

    return { url: url.toString() };
  },

  /**
   * View atom details page.
   */
  viewAtom: (params) => {
    const { account } = params;
    if (!account) throw new Error('viewAtom: account not found');

    const { term_id: atomId } = account;

    return { url: new URL(`/atoms/${atomId}`, baseUrl).toString() };
  },

  /**
   * Create an alias for an atom.
   */
  createAlias: (params) => {
    const { account } = params;
    if (!account) throw new Error('createAlias: account not found');

    const { term_id: atomId } = account;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'create_alias');
    url.searchParams.set('subject_id', atomId);

    return { url: url.toString() };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // dApp Origin URL Builders
  //
  // These use semantic domain routes: /domain/{hostname}?action={action}
  //
  // IMPORTANT: We link to the specific hostname (e.g., "app.uniswap.org")
  // NOT the root domain (e.g., "uniswap.org"). This ensures:
  // - Users vote on the specific dApp they're experiencing
  // - Subdomain-level granularity for trust signals
  // - Shared hosting domains (github.io) are handled correctly
  //
  // The Explorer handles all state detection and adapts the flow accordingly.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * No atom exists for this origin URL (unknown dApp).
   * Link to domain page with ?action=trust to open create claim modal.
   *
   * Uses hostname (e.g., "app.uniswap.org") not normalized domain.
   * This ensures subdomain-level precision for trust signals.
   *
   * The Explorer will:
   * 1. Detect no atom exists
   * 2. Open CreateClaimModal with subjectData (hostname)
   * 3. Modal creates atom + trust triple in one flow
   */
  originNoAtom: (params) => {
    const { hostname } = params;

    // Fallback to base URL if no hostname available
    if (!hostname) {
      return { url: baseUrl };
    }

    const url = new URL(`/domain/${encodeURIComponent(hostname)}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * Origin atom exists but no trust triple.
   * Link to domain page with ?action=trust.
   *
   * Uses hostname for consistency with subdomain-level precision.
   *
   * The Explorer will:
   * 1. Detect atom exists but no trust triple
   * 2. Open CreateClaimModal with preselectedType='trust'
   * 3. Modal creates trust triple
   */
  originAtomWithoutTrustTriple: (params) => {
    const { hostname, origin } = params;

    // Prefer hostname (what the user is actually visiting)
    // Fall back to origin atom's data if hostname not available
    const domainToUse = hostname || origin?.data || origin?.label;
    if (!domainToUse) throw new Error('originAtomWithoutTrustTriple: no hostname or origin data');

    const url = new URL(`/domain/${encodeURIComponent(domainToUse)}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * Origin trust triple exists.
   * Link to domain page with ?action=trust.
   *
   * Uses hostname for consistency with subdomain-level precision.
   *
   * The Explorer will:
   * 1. Detect trust triple exists
   * 2. Open CreateClaimModal with existingTripleId
   * 3. User goes directly to staking step
   */
  originAtomWithTrustTriple: (params) => {
    const { hostname, origin } = params;

    // Prefer hostname (what the user is actually visiting)
    // Fall back to origin atom's data if hostname not available
    const domainToUse = hostname || origin?.data || origin?.label;
    if (!domainToUse) throw new Error('originAtomWithTrustTriple: no hostname or origin data');

    const url = new URL(`/domain/${encodeURIComponent(domainToUse)}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * View origin atom details page.
   * Uses hostname for subdomain-level precision.
   */
  viewOriginAtom: (params) => {
    const { hostname, origin } = params;

    // Prefer hostname (what the user is actually visiting)
    // Fall back to origin atom's data if hostname not available
    const domainToUse = hostname || origin?.data || origin?.label;
    if (!domainToUse) throw new Error('viewOriginAtom: no hostname or origin data');

    return { url: new URL(`/domain/${encodeURIComponent(domainToUse)}`, baseUrl).toString() };
  },
};

export default vendorConfig;

