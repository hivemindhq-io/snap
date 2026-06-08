import { getOriginAtomQuery, graphQLQuery } from './queries';
import type { Origin } from './types';
import { OriginType } from './types';
import { canonicalizeWebUrl } from './util';

export type GetOriginDataResult = {
  origin: Origin | null;
  hostname: string | undefined;
};

/**
 * Extracts the hostname from a URL string.
 * Returns undefined if the URL is invalid or not provided.
 *
 * @param originUrl - The full origin URL (e.g., "https://app.uniswap.org")
 * @returns The hostname (e.g., "app.uniswap.org") or undefined
 */
const extractHostname = (originUrl: string | undefined): string | undefined => {
  if (!originUrl) {
    return undefined;
  }

  try {
    const url = new URL(originUrl);
    return url.hostname;
  } catch {
    // If URL parsing fails, try to extract hostname manually
    // Handle cases like "app.uniswap.org" without protocol
    const match = originUrl.match(/^(?:https?:\/\/)?([^\/]+)/);
    return match?.[1];
  }
};

/**
 * Resolves the origin (dApp URL) atom from Intuition's knowledge graph.
 *
 * The origin no longer carries a bespoke trust triple — its safety + network
 * familiarity flow through the same pipeline as the destination address (see
 * onTransaction.tsx). This only needs to resolve the atom.
 *
 * @param transactionOrigin - The origin URL from the transaction
 * @returns Origin data including the resolved atom (or null) and hostname
 */
export const getOriginData = async (
  transactionOrigin: string | undefined,
): Promise<GetOriginDataResult> => {
  const hostname = extractHostname(transactionOrigin);

  // If no origin URL provided, return empty result
  if (!transactionOrigin || !hostname) {
    return {
      origin: null,
      hostname: undefined,
    };
  }

  try {
    // Match the canonical `https://` form AND legacy variants (bare hostname,
    // http, www) in a single query so atoms minted under any historical form
    // still resolve. See canonicalizeWebUrl.
    const canon = canonicalizeWebUrl(transactionOrigin);
    const labels = canon?.queryVariants ?? [transactionOrigin, hostname];

    const atomResponse = await graphQLQuery(getOriginAtomQuery, {
      labels,
    });

    const originAtom = atomResponse.data.atoms?.[0] as Origin | undefined;

    return {
      origin: originAtom ?? null,
      hostname,
    };
  } catch {
    // Don't fail the transaction insight on origin fetch errors
    return {
      origin: null,
      hostname,
    };
  }
};

/**
 * Determines the OriginType based on the fetched data.
 * Mirrors the getAccountType pattern.
 *
 * @param originData - The resolved origin data.
 * @param transactionOrigin - The raw origin URL from the transaction.
 * @returns The classified origin type.
 */
export const getOriginType = (
  originData: GetOriginDataResult,
  transactionOrigin: string | undefined,
): OriginType => {
  // No origin URL provided at all
  if (!transactionOrigin) {
    return OriginType.NoOrigin;
  }

  // Origin URL provided but no atom exists
  if (!originData.origin) {
    return OriginType.NoAtom;
  }

  // Atom exists
  return OriginType.HasAtom;
};
