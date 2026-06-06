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

export const addressToCaip10 = (
  // input params formatted to fit MetaMask tx params
  address: string, // `0x${string}`,
  chainId: string, // `eip155:${number}`,
): string => {
  return `caip10:${chainId}:${address}`;
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
