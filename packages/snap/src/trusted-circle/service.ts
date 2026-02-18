/**
 * Trusted Circle Service.
 *
 * Fetches and manages the user's trusted circle (accounts they trust)
 * and cross-references with positions on triples.
 *
 * @module trusted-circle/service
 */

import { graphQLQuery, getUserTrustedCircleQuery, getAtomsForAddressesQuery } from '../queries';
import { chainConfig, ChainConfig } from '../config';
import { getTrustedCircleCache, setTrustedCircleCache } from './cache';
import type { TrustedContact, TrustedCirclePositions } from './types';

/**
 * Response shape from the trusted circle GraphQL query.
 * Note: Path is positions → term → triple (not positions → triple directly).
 */
interface TrustedCircleQueryResponse {
  data: {
    positions: {
      term: {
        triple: {
          subject_id: string;
          subject: {
            label: string;
            data: string;
          };
        };
      };
    }[];
  };
}

/**
 * Checks if a string is a valid EVM address.
 */
function isEvmAddress(value: string | null | undefined): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/i.test(value);
}

/**
 * Fetches the user's trusted circle from GraphQL.
 * These are accounts the user has staked FOR on trust triples.
 *
 * @param userAddress - The user's wallet address
 * @returns Array of trusted contacts
 */
async function fetchTrustedCircleFromAPI(
  userAddress: string,
): Promise<TrustedContact[]> {
  const { hasTagAtomId, trustworthyAtomId } = chainConfig as ChainConfig;


  const response = (await graphQLQuery(getUserTrustedCircleQuery, {
    userAddress,
    predicateId: hasTagAtomId,
    objectId: trustworthyAtomId,
  })) as TrustedCircleQueryResponse;

  const positions = response?.data?.positions || [];


  // Extract unique contacts (user might have multiple positions on same triple)
  // IMPORTANT: Use the wallet address for matching against positions.
  // For ENS-resolved atoms: label = "smilingkylan.eth", data = "0xCF806..."
  // For plain address atoms: label = "0xb14f...", data = "0xb14f..."
  const contactMap = new Map<string, TrustedContact>();

  for (const position of positions) {
    const triple = position.term?.triple;
    if (!triple) continue; // Skip positions that aren't on triples

    const { subject } = triple;
    if (!subject) continue;

    // Extract wallet address: prefer data if it's an EVM address, else try label
    const walletAddress = isEvmAddress(subject.data)
      ? subject.data
      : isEvmAddress(subject.label)
        ? subject.label
        : null;

    if (!walletAddress) continue;

    const normalizedAddress = walletAddress.toLowerCase();
    if (!contactMap.has(normalizedAddress)) {
      contactMap.set(normalizedAddress, {
        accountId: walletAddress,
        label: subject.label || walletAddress, // Keep ENS name for display
      });
    }
  }

  const contacts = Array.from(contactMap.values());

  return contacts;
}

/**
 * Gets the user's trusted circle, using cache when available.
 *
 * @param userAddress - The user's wallet address
 * @returns Array of trusted contacts (may be empty)
 */
export async function getTrustedCircle(
  userAddress: string,
): Promise<TrustedContact[]> {
  // Try cache first
  const cached = await getTrustedCircleCache(userAddress);
  if (cached !== null) {
    return cached;
  }

  // Cache miss or expired, fetch fresh data
  const contacts = await fetchTrustedCircleFromAPI(userAddress);

  // Store in cache for next time
  await setTrustedCircleCache(userAddress, contacts);

  return contacts;
}

/**
 * Position data from a triple query.
 */
interface PositionWithAccount {
  account_id: string;
  shares?: string;
  account?: {
    id: string;
    label: string;
  };
}

/**
 * Filters positions to only include trusted contacts.
 * Cross-references the user's trusted circle with positions on a triple.
 * Excludes the user's own address since their position is shown separately.
 *
 * @param trustedCircle - The user's trusted contacts
 * @param forPositions - Positions staking FOR
 * @param againstPositions - Positions staking AGAINST
 * @param userAddress - The current user's address to exclude from results
 * @returns Trusted contacts with their stance (FOR/AGAINST)
 */
export function getTrustedContactsWithPositions(
  trustedCircle: TrustedContact[],
  forPositions: PositionWithAccount[],
  againstPositions: PositionWithAccount[],
  userAddress?: string,
): TrustedCirclePositions {
  const normalizedUserAddress = userAddress?.toLowerCase();

  // Create a Set for O(1) lookup of trusted account IDs
  const trustedIds = new Set(
    trustedCircle.map((c) => c.accountId.toLowerCase()),
  );

  // Also create a map for quick label lookup
  const trustedLabels = new Map(
    trustedCircle.map((c) => [c.accountId.toLowerCase(), c.label]),
  );

  // Filter FOR positions to trusted contacts, excluding the user's own position
  const forContacts: TrustedContact[] = [];
  for (const position of forPositions) {
    const accountId = position.account_id?.toLowerCase();
    if (accountId === normalizedUserAddress) continue;
    const isTrusted = accountId && trustedIds.has(accountId);
    if (isTrusted) {
      forContacts.push({
        accountId: position.account_id,
        label:
          trustedLabels.get(accountId) ||
          position.account?.label ||
          formatAddress(position.account_id),
        shares: position.shares || '0',
      });
    }
  }

  // Filter AGAINST positions to trusted contacts, excluding the user's own position
  const againstContacts: TrustedContact[] = [];
  for (const position of againstPositions) {
    const accountId = position.account_id?.toLowerCase();
    if (accountId === normalizedUserAddress) continue;
    const isTrusted = accountId && trustedIds.has(accountId);
    if (isTrusted) {
      againstContacts.push({
        accountId: position.account_id,
        label:
          trustedLabels.get(accountId) ||
          position.account?.label ||
          formatAddress(position.account_id),
        shares: position.shares || '0',
      });
    }
  }

  // Sort by shares (highest stake first)
  forContacts.sort((a, b) => {
    const sharesA = BigInt(a.shares ?? '0');
    const sharesB = BigInt(b.shares ?? '0');
    if (sharesB > sharesA) return 1;
    if (sharesB < sharesA) return -1;
    return 0;
  });

  againstContacts.sort((a, b) => {
    const sharesA = BigInt(a.shares ?? '0');
    const sharesB = BigInt(b.shares ?? '0');
    if (sharesB > sharesA) return 1;
    if (sharesB < sharesA) return -1;
    return 0;
  });


  return { forContacts, againstContacts };
}

/**
 * Formats an address for display (first 6 + last 4 chars).
 *
 * @param address - Full address string
 * @returns Truncated address like "0x1234...5678"
 */
function formatAddress(address: string): string {
  if (!address || address.length < 12) {
    return address || 'Unknown';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Response shape from the atoms for addresses query.
 */
interface AtomsForAddressesResponse {
  data: {
    atoms: {
      term_id: string;
      label: string;
      data: string;
      image: string | null;
    }[];
  };
}

/**
 * Enriches trusted contacts with resolved labels (ENS names, etc.).
 * The Intuition backend resolves ENS names automatically, so we just need
 * to fetch the atom data for the addresses.
 *
 * @param positions - The trusted circle positions to enrich
 * @returns Enriched positions with resolved labels
 */
export async function enrichContactLabels(
  positions: TrustedCirclePositions,
): Promise<TrustedCirclePositions> {
  // Collect all unique addresses from both FOR and AGAINST contacts
  const allContacts = [...positions.forContacts, ...positions.againstContacts];
  if (allContacts.length === 0) {
    return positions;
  }

  // Collect unique addresses (both lowercase for query flexibility)
  const addresses = [...new Set(allContacts.map(c => c.accountId))];
  const lowercaseAddresses = addresses.map(a => a.toLowerCase());

  // Query for all addresses in one batch
  const allAddresses = [...addresses, ...lowercaseAddresses];

  try {
    const response = (await graphQLQuery(getAtomsForAddressesQuery, {
      addresses: allAddresses,
    })) as AtomsForAddressesResponse;

    const atoms = response?.data?.atoms || [];

    // Build a map of address -> resolved label
    // Priority: atom with ENS-like label > atom with address label > original address
    const labelMap = new Map<string, string>();

    for (const atom of atoms) {
      // The atom's data or label contains the address
      const addressFromData = atom.data?.toLowerCase();
      const addressFromLabel = atom.label?.toLowerCase();

      // Check if this atom's label is a resolved name (not an address)
      const isResolvedName = atom.label && !/^0x[a-fA-F0-9]{40}$/iu.test(atom.label);

      // Map both possible address sources to the label
      if (addressFromData && isResolvedName) {
        // Prefer resolved name over existing entry
        labelMap.set(addressFromData, atom.label);
      }
      if (addressFromLabel && isResolvedName && addressFromLabel !== addressFromData) {
        labelMap.set(addressFromLabel, atom.label);
      }
    }


    // Update contacts with resolved labels
    const enrichContact = (contact: TrustedContact): TrustedContact => {
      const normalizedAddress = contact.accountId.toLowerCase();
      const resolvedLabel = labelMap.get(normalizedAddress);

      if (resolvedLabel) {
        return { ...contact, label: resolvedLabel };
      }

      // Fallback to formatted address if no resolved name
      if (/^0x[a-fA-F0-9]{40}$/iu.test(contact.label)) {
        return { ...contact, label: formatAddress(contact.label) };
      }

      return contact;
    };

    return {
      forContacts: positions.forContacts.map(enrichContact),
      againstContacts: positions.againstContacts.map(enrichContact),
    };
  } catch (error) {
    // If enrichment fails, return original positions with formatted addresses
    console.error('[TrustedCircle] Label enrichment failed:', error);

    const formatContact = (contact: TrustedContact): TrustedContact => ({
      ...contact,
      label: /^0x[a-fA-F0-9]{40}$/iu.test(contact.label)
        ? formatAddress(contact.label)
        : contact.label,
    });

    return {
      forContacts: positions.forContacts.map(formatContact),
      againstContacts: positions.againstContacts.map(formatContact),
    };
  }
}
