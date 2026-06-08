import { FIRST_PARTY_EXTENSION_IDS } from './config';

const SUPPRESSED_ORIGINS = ['metamask', 'localhost'];

/**
 * URL schemes for browser extensions. A transaction originating from any
 * extension is not a third-party dApp site, so the origin block carries no
 * meaningful trust signal and is suppressed entirely.
 */
const EXTENSION_SCHEMES = ['chrome-extension:', 'moz-extension:', 'extension:'];

/**
 * Whether a raw origin string is a browser-extension origin (any extension,
 * first- or third-party). Matches by URL scheme, falling back to a prefix check
 * for non-parseable strings.
 *
 * @param originUrl - The raw transactionOrigin string.
 * @returns True when the origin is a browser-extension URL.
 */
export const isExtensionOrigin = (originUrl: string | undefined): boolean => {
  if (!originUrl) {
    return false;
  }
  try {
    return EXTENSION_SCHEMES.includes(new URL(originUrl).protocol);
  } catch {
    return EXTENSION_SCHEMES.some((scheme) =>
      originUrl.toLowerCase().startsWith(`${scheme}//`),
    );
  }
};

/**
 * Extracts the extension ID (the host segment) from a browser-extension origin.
 * For `chrome-extension://<id>/path`, `new URL().hostname` is the extension ID.
 *
 * @param originUrl - The raw transactionOrigin string.
 * @returns The extension ID, or undefined when not an extension origin.
 */
const getExtensionId = (originUrl: string | undefined): string | undefined => {
  if (!isExtensionOrigin(originUrl) || !originUrl) {
    return undefined;
  }
  try {
    return new URL(originUrl).hostname || undefined;
  } catch {
    const match = originUrl.match(/^[a-z-]+:\/\/([^/]+)/iu);
    return match?.[1];
  }
};

/**
 * Whether the origin is one of OUR OWN (first-party) Hive Mind extensions.
 * Used to show a neutral provenance line instead of a generic dApp block.
 *
 * @param originUrl - The raw transactionOrigin string.
 * @returns True when the origin is a known first-party extension.
 */
export const isFirstPartyExtensionOrigin = (
  originUrl: string | undefined,
): boolean => {
  const id = getExtensionId(originUrl);
  return id !== undefined && FIRST_PARTY_EXTENSION_IDS.includes(id as never);
};

/**
 * Determines whether the origin section should be hidden from the Snap UI.
 * Origins like "metamask" (internal) and "localhost" (local dev) provide no
 * meaningful trust signal, and ANY browser-extension origin (including our own)
 * is not a third-party dApp, so all of these are suppressed entirely.
 *
 * @param originUrl - The raw transactionOrigin string.
 * @param hostname - The extracted hostname (e.g., "localhost" from "http://localhost:8080").
 * @returns True if the origin section should be hidden.
 */
export const shouldSuppressOrigin = (
  originUrl: string | undefined,
  hostname?: string | undefined,
): boolean => {
  if (!originUrl) {
    return true;
  }
  if (isExtensionOrigin(originUrl)) {
    return true;
  }
  if (SUPPRESSED_ORIGINS.includes(originUrl)) {
    return true;
  }
  if (hostname && SUPPRESSED_ORIGINS.includes(hostname)) {
    return true;
  }
  return false;
};

/**
 * Whether the transaction destination is the user's own account — i.e. a
 * self-call. This is the signature of EIP-5792 / ERC-7821 batched executions
 * from a smart account (incl. EIP-7702 delegated EOAs): the `to` address is the
 * user's own wallet and the real counterparties are encoded inside the batch
 * calldata. In that case the destination carries no third-party trust signal,
 * so the address surface is suppressed entirely (mirrors {@link shouldSuppressOrigin}).
 *
 * @param destination - The transaction `to` address.
 * @param userAddress - The transaction `from` address (the user's account).
 * @returns True when `to` and `from` are the same address.
 */
export const isSelfCall = (
  destination: string | undefined,
  userAddress: string | undefined,
): boolean => {
  if (!destination || !userAddress) {
    return false;
  }
  return destination.toLowerCase() === userAddress.toLowerCase();
};

export const addressToCaip10 = (
  // input params formatted to fit MetaMask tx params
  address: string, // `0x${string}`,
  chainId: string, // `eip155:${number}`,
): string => {
  return `caip10:${chainId}:${address}`;
};

/**
 * Canonical web-URL forms for domain / URL atom lookups.
 *
 * Mirror of `canonicalizeWebUrl` in @hivemindhq/core (the Snap cannot import
 * that package — keep the two in sync). Canonical rules: ALWAYS `https://`,
 * lowercase host AND path, strip a leading `www.`, strip trailing slash(es),
 * drop the query string and fragment.
 */
export type WebUrlCanonical = {
  /** Canonical mint/query key, e.g. `https://github.com`. */
  canonical: string;
  /** Scheme-less display form, e.g. `github.com`. */
  display: string;
  /** Bare hostname only (lowercased, no `www.`). */
  hostname: string;
  /** True when the input is a host root (no meaningful path) — a domain. */
  isDomain: boolean;
  /**
   * All historical label forms an atom may have been minted under. Used for
   * backward-compatible reads (`_in`) so legacy bare-hostname atoms resolve
   * alongside the new canonical `https://` form. Ordered canonical-first.
   */
  queryVariants: string[];
};

/**
 * Canonicalize a bare domain or full URL to the Hive Mind canonical web form.
 *
 * @param input - A bare domain or full URL.
 * @returns The canonical forms, or undefined for empty / non-http(s) input.
 */
export const canonicalizeWebUrl = (
  input: string | undefined,
): WebUrlCanonical | undefined => {
  if (!input || typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const working = /^https?:\/\//iu.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(working);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');
  if (!hostname) {
    return undefined;
  }

  const path = url.pathname.replace(/\/+$/u, '').toLowerCase();
  const isDomain = path === '';

  const canonical = `https://${hostname}${path}`;
  const display = `${hostname}${path}`;

  const queryVariants = Array.from(
    new Set([
      canonical, // https://host[/path]
      `${hostname}${path}`, // host[/path]  (legacy bare)
      `http://${hostname}${path}`, // http variant
      `https://www.${hostname}${path}`, // www variant
      `http://www.${hostname}${path}`,
    ]),
  );

  return { canonical, display, hostname, isDomain, queryVariants };
};

/**
 * Converts a string representation of a number to a decimal value
 * accounting for the specified number of decimal places.
 *
 * @param value - The string value to convert
 * @param decimals - The number of decimal places (e.g., 18 for ETH)
 * @returns The decimal representation of the value
 */
export const stringToDecimal = (value: string, decimals: number): number => {
  const num = BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const quotient = num / divisor;
  const remainder = num % divisor;

  // Convert to decimal with precision
  const decimalPart = remainder.toString().padStart(decimals, '0');
  const significantDecimals = decimalPart.slice(0, 6); // Keep 6 decimal places

  return Number(`${quotient}.${significantDecimals}`);
};
