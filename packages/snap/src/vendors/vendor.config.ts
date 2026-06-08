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

import { chainConfig, type ChainConfig } from '../config';
import type {
  AccountType,
  PropsForAccountType,
  OriginType,
  PropsForOriginType,
} from '../types';
import { addressToCaip10 } from '../util';

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURATION - Customize these values for your explorer
 * ═══════════════════════════════════════════════════════════════════════════ */

const VENDOR_NAME = 'Hive Mind Explorer';

const EXPLORER_ORIGINS: Record<number, string> = {
  // Intuition Mainnet
  1155: 'https://explorer.hivemindhq.io',
  // Intuition Testnet
  13579: 'https://testnet.explorer.hivemindhq.io',
};

// Get the base URL for the current chain (fallback to mainnet if chain not configured)
const FALLBACK_URL = 'https://explorer.hivemindhq.io';
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
type OriginPropsWithAtom = PropsForOriginType<OriginType.HasAtom>;

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
    props: PropsForAccountType<AccountType.AtomWithoutTrustTriple>,
  ) => UrlResult;

  /** Generate URL when trust triple exists (for staking) */
  atomWithTrustTriple: (
    props: PropsForAccountType<AccountType.AtomWithTrustTriple>,
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

  /** Generate URL for viewing origin atom details */
  viewOriginAtom: (props: OriginPropsWithAtom) => UrlResult;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ADDRESS RESOLUTION
 *
 * Contracts are chain-specific (same address can be different contracts on
 * different chains), so they get CAIP-10 format: caip10:eip155:{chainId}:0x...
 * EOAs are the same human across all chains, so they stay as plain 0x.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resolves the address to use in outbound URLs.
 * Contracts use CAIP-10 (chain-specific identity), EOAs use plain 0x.
 * @param params
 * @param params.address
 * @param params.isContract
 * @param params.chainId
 */
const resolveAddressForUrl = (params: {
  address: string;
  isContract: boolean;
  chainId: string;
}): string => {
  const resolved = params.isContract
    ? addressToCaip10(params.address, params.chainId)
    : params.address;

  console.log('[resolveAddressForUrl] url address decision', {
    address: params.address,
    isContract: params.isContract,
    chainId: params.chainId,
    resolved,
    format: params.isContract ? 'caip10' : 'plain',
  });

  return resolved;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * URL BUILDERS - Customize these functions for your explorer's URL structure
 * ═══════════════════════════════════════════════════════════════════════════ */

export const vendorConfig: VendorConfig = {
  name: VENDOR_NAME,

  // ─────────────────────────────────────────────────────────────────────────
  // Address URL Builders
  //
  // These use semantic address routes: /address/{address}?action={action}
  //
  // The Explorer handles all state detection and adapts the flow accordingly:
  // - No atom: Modal creates atom + trust triple in one flow
  // - Atom, no triple: Modal creates trust triple
  // - Triple exists: Modal goes directly to staking
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * No atom exists for this address.
   * Link to address page with ?action=trust to open create claim modal.
   * Contracts use CAIP-10 format; EOAs use plain 0x.
   * @param params
   */
  noAtom: (params) => {
    const resolvedAddress = resolveAddressForUrl(params);

    const url = new URL(`/address/${resolvedAddress}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * Atom exists but no trust triple.
   * Link to address page with ?action=trust.
   * Contracts use CAIP-10 format; EOAs use plain 0x.
   * @param params
   */
  atomWithoutTrustTriple: (params) => {
    const resolvedAddress = resolveAddressForUrl(params);

    const url = new URL(`/address/${resolvedAddress}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * Trust triple exists.
   * Link to address page with ?action=trust.
   * Contracts use CAIP-10 format; EOAs use plain 0x.
   * @param params
   */
  atomWithTrustTriple: (params) => {
    const resolvedAddress = resolveAddressForUrl(params);

    const url = new URL(`/address/${resolvedAddress}`, baseUrl);
    url.searchParams.set('action', 'trust');

    return { url: url.toString() };
  },

  /**
   * View address details page.
   * Contracts use CAIP-10 format; EOAs use plain 0x.
   * @param params
   */
  viewAtom: (params) => {
    const resolvedAddress = resolveAddressForUrl(params);

    return { url: new URL(`/address/${resolvedAddress}`, baseUrl).toString() };
  },

  /**
   * Create an alias for an address.
   * Link to address page with ?action=alias.
   * Contracts use CAIP-10 format; EOAs use plain 0x.
   * @param params
   */
  createAlias: (params) => {
    const resolvedAddress = resolveAddressForUrl(params);

    const url = new URL(`/address/${resolvedAddress}`, baseUrl);
    url.searchParams.set('action', 'alias');

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
   * Link to the domain page with ?action=trust-claim to open the sentiment
   * chooser ("Trustworthy" / "Suspicious") in the create-claim modal.
   *
   * Uses hostname (e.g., "app.uniswap.org") not normalized domain.
   * This ensures subdomain-level precision for trust signals.
   *
   * The Explorer will:
   * 1. Open CreateClaimModal in sentiment-choice mode (no atom needed yet)
   * 2. User picks Trustworthy or Suspicious ([hostname] → hasTag → [sentiment])
   * 3. Modal creates the subject/object atoms (if missing) + triple in one flow
   * @param params
   */
  originNoAtom: (params) => {
    const { hostname } = params;

    // Fallback to base URL if no hostname available
    if (!hostname) {
      return { url: baseUrl };
    }

    const url = new URL(`/domain/${encodeURIComponent(hostname)}`, baseUrl);
    url.searchParams.set('action', 'trust-claim');

    return { url: url.toString() };
  },

  /**
   * View origin atom details page.
   * Uses hostname for subdomain-level precision.
   * @param params
   */
  viewOriginAtom: (params) => {
    const { hostname, origin } = params;

    // Prefer hostname (what the user is actually visiting)
    // Fall back to origin atom's data if hostname not available
    const domainToUse = hostname || origin?.data || origin?.label;
    if (!domainToUse) {
      throw new Error('viewOriginAtom: no hostname or origin data');
    }

    return {
      url: new URL(
        `/domain/${encodeURIComponent(domainToUse)}`,
        baseUrl,
      ).toString(),
    };
  },
};

export default vendorConfig;

// https://beta.explorer.hivemindhq.io/snap/action?intent=complete_trust_triple&address=0x7ef8a5469e15a78e325f8e14e7a5233e455fceae&chain_id=eip155%3A1155
// no atom = https://beta.explorer.hivemindhq.io/snap/action?intent=complete_trust_triple&address=0x7ef8a5469e15a78e325f8e14e7a5233e455fceae&chain_id=eip155%3A1155
