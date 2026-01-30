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

// Get the base URL for the current chain
const baseUrl = EXPLORER_ORIGINS[chainConfig.chainId];

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
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * No atom exists for this origin URL (unknown dApp).
   * Link to create an atom + trust triple for the dApp.
   *
   * Uses the hostname/originUrl to create the atom.
   */
  originNoAtom: (params) => {
    const { originUrl, hostname } = params;
    // Use hostname if available, fall back to originUrl
    const urlToUse = hostname || originUrl || '';

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'complete_trust_triple');
    url.searchParams.set('origin_url', urlToUse);

    return { url: url.toString() };
  },

  /**
   * Origin atom exists but no trust triple.
   * Link to create the trust triple for the dApp.
   */
  originAtomWithoutTrustTriple: (params) => {
    const { origin } = params;
    if (!origin) throw new Error('originAtomWithoutTrustTriple: origin not found');

    const { term_id: atomId } = origin;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'create_trust_triple');
    url.searchParams.set('atom_id', atomId);

    return { url: url.toString() };
  },

  /**
   * Origin trust triple exists.
   * Link to stake on the dApp's trust triple.
   */
  originAtomWithTrustTriple: (params) => {
    const { triple } = params;
    if (!triple) throw new Error('originAtomWithTrustTriple: triple not found');

    const { term_id: tripleId } = triple;

    const url = new URL('/snap/action', baseUrl);
    url.searchParams.set('intent', 'stake_trust_triple');
    url.searchParams.set('triple_id', tripleId);

    return { url: url.toString() };
  },

  /**
   * View origin atom details page.
   */
  viewOriginAtom: (params) => {
    const { origin } = params;
    if (!origin) throw new Error('viewOriginAtom: origin not found');

    const { term_id: atomId } = origin;

    return { url: new URL(`/atoms/${atomId}`, baseUrl).toString() };
  },
};

export default vendorConfig;

