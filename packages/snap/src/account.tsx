import { type ChainConfig, chainConfig } from './config';
import {
  getListWithHighestStakeQuery,
  getTripleWithPositionsDataQuery,
  graphQLQuery,
  getAddressAtomsQuery,
} from './queries';
import { sumMarketCap } from './term-stats';
import {
  Account,
  AccountType,
  TripleWithPositions,
  AddressClassification,
  AlternateTrustData,
} from './types';
import { addressToCaip10 } from './util';
import { ChainId, Transaction } from '@metamask/snaps-sdk';

export type GetAccountDataResult = {
  account: Account | null;
  triple: TripleWithPositions | null;
  isContract: boolean;
  alias: string | null;
  classification: AddressClassification;
  alternateTrustData: AlternateTrustData;
};

/** Timeout for the contract-status API proxy call. The Snap blocks the
 * onTransaction UI on classification, so keep this tight. */
const CONTRACT_STATUS_API_TIMEOUT_MS = 4000;

/**
 * Multi-chain contract-status check via the Hive Mind API proxy.
 *
 * The proxy fans out `eth_getCode` across Ethereum / Base / Intuition (Alchemy
 * for ETH/Base, keys stay server-side) and applies the canonical classification
 * rule (7702 + smart-account aware). Returns:
 *   - `true`  : real contract on at least one chain
 *   - `false` : EOA / 7702 / smart-account on all answered chains
 *   - `null`  : API unreachable or every chain RPC failed (caller falls back)
 */
const fetchContractStatusFromApi = async (
  destinationAddress: string,
): Promise<boolean | null> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CONTRACT_STATUS_API_TIMEOUT_MS,
  );

  try {
    const url = `${chainConfig.hivemindApiUrl}/addresses/${destinationAddress}/contract-status`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      isContract: boolean | null;
      contractChainId: number | null;
    };

    return data.isContract;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Classifies an address as EOA, contract, or unknown.
 * Tracks certainty level so we can handle uncertain cases appropriately.
 *
 * For empty-calldata transactions we first ask the Hive Mind API's multi-chain
 * contract-status proxy (Ethereum / Base / Intuition via Alchemy). On any API
 * failure we fall back to a direct `eth_getCode` against the configured
 * Intuition chain, preserving the prior single-chain behavior.
 *
 * The transaction's chain is irrelevant for trust lookups - we always resolve
 * against our configured chain because that's where trust data lives.
 */
const classifyAddress = async (
  destinationAddress: string,
  transactionData: string,
): Promise<AddressClassification> => {
  // If transaction has data, it's definitely a contract interaction
  if (transactionData !== '0x') {
    return { type: 'contract', certainty: 'definite' };
  }

  // Empty calldata: prefer the multi-chain API proxy (covers ETH/Base/Intuition).
  // A definite true/false from the API wins; null means "API couldn't decide"
  // and we fall through to the direct Intuition RPC below.
  const apiResult = await fetchContractStatusFromApi(destinationAddress);
  if (apiResult === true) {
    return { type: 'contract', certainty: 'definite' };
  }
  if (apiResult === false) {
    return { type: 'eoa', certainty: 'definite' };
  }

  // API unavailable/undecided — fall back to direct Intuition eth_getCode.
  // Transaction data is empty, but could still be a contract receiving tokens.
  try {
    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [destinationAddress, 'latest'],
        id: 1,
      }),
    });

    if (!response.ok) {
      return { type: 'unknown', certainty: 'uncertain', reason: 'eth_getCode_failed' };
    }

    const data = await response.json();
    const codeResponse = data.result;

    if (codeResponse === '0x' || codeResponse === null) {
      return { type: 'eoa', certainty: 'definite' };
    } else {
      return { type: 'contract', certainty: 'definite' };
    }
  } catch {
    return { type: 'unknown', certainty: 'uncertain', reason: 'eth_getCode_failed' };
  }
};

/**
 * Calculates the total market cap of a trust triple (support + counter)
 * by summing across ALL curves on each side. Returns 0n if triple is null
 * or has no vault data.
 *
 * See `term-stats.ts` for why we aggregate across curves instead of reading
 * `vaults[0]` (curve_id=1).
 */
const getTrustMarketCap = (triple: TripleWithPositions | null): bigint => {
  if (!triple) return 0n;
  const supportCap = BigInt(sumMarketCap(triple.term?.vaults));
  const counterCap = BigInt(sumMarketCap(triple.counter_term?.vaults));
  return supportCap + counterCap;
};

/**
 * Selects the primary atom based on classification and trust signal.
 * For uncertain classifications, uses whichever format has higher trust stake.
 */
const selectPrimaryAtom = (
  classification: AddressClassification,
  plainAtom: Account | null,
  caipAtom: Account | null,
  plainTrustTriple: TripleWithPositions | null,
  caipTrustTriple: TripleWithPositions | null,
): {
  primary: Account | null;
  primaryTriple: TripleWithPositions | null;
  alternate: Account | null;
  alternateTriple: TripleWithPositions | null;
  usedCaip: boolean;
} => {
  // Neither exists
  if (!caipAtom && !plainAtom) {
    return {
      primary: null,
      primaryTriple: null,
      alternate: null,
      alternateTriple: null,
      usedCaip: false,
    };
  }

  // Only one format exists
  if (!caipAtom) {
    return {
      primary: plainAtom,
      primaryTriple: plainTrustTriple,
      alternate: null,
      alternateTriple: null,
      usedCaip: false,
    };
  }
  if (!plainAtom) {
    return {
      primary: caipAtom,
      primaryTriple: caipTrustTriple,
      alternate: null,
      alternateTriple: null,
      usedCaip: true,
    };
  }

  // Both exist - selection depends on classification
  if (classification.certainty === 'definite') {
    if (classification.type === 'contract') {
      // Definite contract: use CAIP as primary
      return {
        primary: caipAtom,
        primaryTriple: caipTrustTriple,
        alternate: plainAtom,
        alternateTriple: plainTrustTriple,
        usedCaip: true,
      };
    } else {
      // Definite EOA: use plain as primary
      return {
        primary: plainAtom,
        primaryTriple: plainTrustTriple,
        alternate: caipAtom,
        alternateTriple: caipTrustTriple,
        usedCaip: false,
      };
    }
  }

  // Uncertain classification: compare trust signal, use higher market cap
  const caipMarketCap = getTrustMarketCap(caipTrustTriple);
  const plainMarketCap = getTrustMarketCap(plainTrustTriple);

  if (caipMarketCap >= plainMarketCap) {
    return {
      primary: caipAtom,
      primaryTriple: caipTrustTriple,
      alternate: plainAtom,
      alternateTriple: plainTrustTriple,
      usedCaip: true,
    };
  } else {
    return {
      primary: plainAtom,
      primaryTriple: plainTrustTriple,
      alternate: caipAtom,
      alternateTriple: caipTrustTriple,
      usedCaip: false,
    };
  }
};

export const getAccountData = async (
  transaction: Transaction,
  chainId: ChainId,
  userAddress?: string,
): Promise<GetAccountDataResult> => {
  const { to: destinationAddress, data: transactionData } = transaction;
  const caipAddress = addressToCaip10(destinationAddress, chainId);

  // Step 1: Classify the address with certainty tracking
  // Uses the configured Intuition chain's RPC (transaction chain is irrelevant)
  const classification = await classifyAddress(
    destinationAddress,
    transactionData,
  );

  // Derive isContract from classification (for backwards compatibility)
  const isContract =
    classification.type === 'contract' ||
    (classification.certainty === 'uncertain'); // Default to contract when uncertain

  // Step 2: Query both atom formats
  try {
    const [atomsResponse] = await Promise.all([
      graphQLQuery(getAddressAtomsQuery, {
        plainAddress: destinationAddress,
        caipAddress: caipAddress,
      }),
    ]);
    const { plainAtoms, caipAtoms } = atomsResponse.data;
    const plainAtom = plainAtoms?.[0] as Account | undefined;
    const caipAtom = caipAtoms?.[0] as Account | undefined;

    // If neither atom exists, return early
    if (!plainAtom && !caipAtom) {
      return {
        account: null,
        triple: null,
        isContract,
        alias: null,
        classification,
        alternateTrustData: { hasAlternateTrustData: false },
      };
    }

    // Step 3: Query trust triples for BOTH atom formats (if they exist)
    const { hasTagAtomId, trustworthyAtomId, hasAliasAtomId } =
      chainConfig as ChainConfig;

    // Build parallel queries for trust data
    const trustQueries: Promise<any>[] = [];
    const queryKeys: ('plain' | 'caip')[] = [];

    // Use empty string if userAddress is undefined (GraphQL will match nothing)
    const userAddressParam = userAddress || '';

    if (plainAtom) {
      trustQueries.push(
        graphQLQuery(getTripleWithPositionsDataQuery, {
          subjectId: plainAtom.term_id,
          predicateId: hasTagAtomId,
          objectId: trustworthyAtomId,
          userAddress: userAddressParam,
        }),
      );
      queryKeys.push('plain');
    }

    if (caipAtom) {
      trustQueries.push(
        graphQLQuery(getTripleWithPositionsDataQuery, {
          subjectId: caipAtom.term_id,
          predicateId: hasTagAtomId,
          objectId: trustworthyAtomId,
          userAddress: userAddressParam,
        }),
      );
      queryKeys.push('caip');
    }

    const trustResponses = await Promise.all(trustQueries);

    // Map responses back to their keys
    const trustResults: { plain?: TripleWithPositions; caip?: TripleWithPositions } = {};
    queryKeys.forEach((key, idx) => {
      trustResults[key] = trustResponses[idx].data.triples[0] || null;
    });

    // Step 4: Select primary atom based on classification and trust signal
    const selection = selectPrimaryAtom(
      classification,
      plainAtom || null,
      caipAtom || null,
      trustResults.plain || null,
      trustResults.caip || null,
    );

    // Step 5: Check if alternate has significant trust data
    const alternateMarketCap = getTrustMarketCap(selection.alternateTriple);
    const alternateTrustData: AlternateTrustData = {
      hasAlternateTrustData: alternateMarketCap > 0n,
      alternateAtomId: selection.alternate?.term_id,
      alternateMarketCap: alternateMarketCap.toString(),
      alternateIsCaip: !selection.usedCaip, // If we used CAIP, alternate is plain (and vice versa)
    };

    // Step 6: Query alias for the primary atom
    let alias: string | null = null;
    if (selection.primary) {
      const aliasResponse = await graphQLQuery(getListWithHighestStakeQuery, {
        subjectId: selection.primary.term_id,
        predicateId: hasAliasAtomId,
      });
      const aliasTriple = aliasResponse.data.triples[0];
      alias = aliasTriple?.object?.label || null;
    }

    return {
      account: selection.primary,
      triple: selection.primaryTriple,
      isContract,
      alias,
      classification,
      alternateTrustData,
    };
  } catch (error: any) {
    throw error;
  }
};

export const getAccountType = (
  accountData: GetAccountDataResult,
): AccountType => {
  const { account, triple } = accountData;

  // Since we're now using atoms directly, check if we have atom data
  if (!account) {
    return AccountType.NoAtom;
  }

  if (triple === null) {
    return AccountType.AtomWithoutTrustTriple;
  }

  return AccountType.AtomWithTrustTriple;
};
