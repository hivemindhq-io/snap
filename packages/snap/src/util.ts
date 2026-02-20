const SUPPRESSED_ORIGINS = ['metamask', 'localhost'];

/**
 * Determines whether the origin section should be hidden from the Snap UI.
 * Origins like "metamask" (internal) and "localhost" (local dev) provide
 * no meaningful trust signal, so we suppress them entirely.
 *
 * @param originUrl - The raw transactionOrigin string
 * @param hostname - The extracted hostname (e.g., "localhost" from "http://localhost:8080")
 * @returns true if the origin section should be hidden
 */
export const shouldSuppressOrigin = (
  originUrl: string | undefined,
  hostname?: string | undefined,
): boolean => {
  if (!originUrl) return true;
  if (SUPPRESSED_ORIGINS.includes(originUrl)) return true;
  if (hostname && SUPPRESSED_ORIGINS.includes(hostname)) return true;
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
