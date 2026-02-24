import { ChainId } from '@metamask/snaps-sdk';
import type { TrustedCirclePositions, NetworkFamiliarity } from './trusted-circle/types';

export type Account = {
  id: string;
  data: string;
  label: string;
  image?: string;
  alias?: string;
  term_id: string;
};

/**
 * User's position data from a trust triple query.
 * Represents the user's own stake on a triple.
 */
export type UserPositionData = {
  account_id: string;
  shares: string;
};

// ============================================================================
// Address Classification Types
// ============================================================================

/**
 * Reasons why address classification may be uncertain.
 * Used to track why we couldn't definitively determine if address is EOA or contract.
 */
export type ClassificationFailureReason = 'eth_getCode_failed';

/**
 * Classification result indicating whether an address is an EOA or contract.
 * Includes certainty level to handle cases where eth_getCode fails.
 *
 * - definite EOA: eth_getCode returned 0x (no bytecode)
 * - definite contract: transaction has data OR eth_getCode returned bytecode
 * - uncertain: eth_getCode failed, we don't know for sure
 */
export type AddressClassification =
  | { type: 'eoa'; certainty: 'definite' }
  | { type: 'contract'; certainty: 'definite' }
  | { type: 'unknown'; certainty: 'uncertain'; reason: ClassificationFailureReason };

/**
 * Alternate trust data info - used when the non-primary atom format
 * has trust data that might be relevant to the user.
 */
export type AlternateTrustData = {
  /** Whether alternate format has any trust triple with non-zero market cap */
  hasAlternateTrustData: boolean;
  /** The atom ID of the alternate format (for View More link) */
  alternateAtomId?: string | undefined;
  /** Total market cap of the alternate trust triple (support + counter) */
  alternateMarketCap?: string | undefined;
  /** Whether the alternate is the CAIP format (true) or plain 0x (false) */
  alternateIsCaip?: boolean | undefined;
};

export type TripleWithPositions = {
  term_id: string;
  subject_id: string;
  predicate_id: string;
  object_id: string;
  creator_id: string;
  counter_term_id: string;
  term: {
    vaults: {
      term_id: string;
      market_cap: string;
      position_count: number;
      curve_id: string;
    }[];
  };
  counter_term: {
    vaults: {
      term_id: string;
      market_cap: string;
      position_count: number;
      curve_id: string;
    }[];
  };
  triple_term: {
    term_id: string;
    counter_term_id: string;
    total_market_cap: string;
    total_position_count: string;
  };
  triple_vault: {
    term_id: string;
    counter_term_id: string;
    curve_id: string;
    position_count: string;
    market_cap: string;
  };
  positions_aggregate: {
    aggregate: {
      count: number;
      sum: { shares: number };
      avg: { shares: number };
    };
  };
  counter_positions_aggregate: {
    aggregate: {
      count: number;
      sum: { shares: number };
      avg: { shares: number };
    };
  };
  positions: {
    id: string;
    account_id: string;
    term_id: string;
    curve_id: string;
    shares: string;
    account?: {
      id: string;
      label: string;
    };
  }[];
  counter_positions: {
    id: string;
    account_id: string;
    term_id: string;
    curve_id: string;
    shares: string;
    account?: {
      id: string;
      label: string;
    };
  }[];
  /** User's own position on this triple (FOR side) */
  user_position?: UserPositionData[];
  /** User's own counter-position on this triple (AGAINST side) */
  user_counter_position?: UserPositionData[];
};

// AccountType enum
export enum AccountType {
  NoAtom = 'NoAtom',
  AtomWithoutTrustTriple = 'AtomWithoutTrustTriple',
  AtomWithTrustTriple = 'AtomWithTrustTriple',
}

/** Common props shared across all account states */
type BaseAccountProps = {
  chainId: ChainId;
  /** The destination address of the transaction */
  address: string;
  /** The connected user's wallet address (for checking existing positions) */
  userAddress?: string;
  alias: string | null;
  /** Whether the address is a contract (derived from classification) */
  isContract: boolean;
  transactionOrigin?: string;
  /** Classification result with certainty level */
  classification: AddressClassification;
  /** Info about trust data in alternate atom format (CAIP vs 0x) */
  alternateTrustData: AlternateTrustData;
  /** Trusted contacts who have positions on this address's trust triple */
  trustedCircle?: TrustedCirclePositions;
  /** Trusted contacts who have ANY claim about this address (de-duped from trustedCircle) */
  networkFamiliarity?: NetworkFamiliarity;
};

// Discriminated union types for proper AccountProps typing
export type AccountProps =
  | (BaseAccountProps & {
      accountType: AccountType.NoAtom;
      account: null;
      triple: null;
    })
  | (BaseAccountProps & {
      accountType: AccountType.AtomWithoutTrustTriple;
      account: Account;
      triple: null;
    })
  | (BaseAccountProps & {
      accountType: AccountType.AtomWithTrustTriple;
      account: Account;
      triple: TripleWithPositions;
    });

// Helper type to extract props for a specific account type
export type PropsForAccountType<T extends AccountType> = Extract<
  AccountProps,
  { accountType: T }
>;

// ============================================================================
// Origin Types (for transaction origin URL trust signals)
// ============================================================================

/**
 * Represents an origin (dApp URL) atom from Intuition.
 * Similar structure to Account but for URLs.
 */
export type Origin = {
  id: string;
  data: string;
  label: string;
  image?: string;
  term_id: string;
};

/**
 * Trust triple data for an origin URL.
 * Simplified version of TripleWithPositions for display purposes.
 */
export type OriginTriple = {
  term_id: string;
  term: {
    vaults: {
      term_id: string;
      market_cap: string;
      position_count: number;
    }[];
  };
  counter_term: {
    vaults: {
      term_id: string;
      market_cap: string;
      position_count: number;
    }[];
  };
  positions: { id: string; shares: string; account_id: string }[];
  counter_positions: { id: string; shares: string; account_id: string }[];
  /** User's own position on this triple (FOR side) */
  user_position?: UserPositionData[];
  /** User's own counter-position on this triple (AGAINST side) */
  user_counter_position?: UserPositionData[];
};

// OriginType enum - mirrors AccountType pattern
export enum OriginType {
  NoOrigin = 'NoOrigin',
  NoAtom = 'OriginNoAtom',
  AtomWithoutTrustTriple = 'OriginAtomWithoutTrustTriple',
  AtomWithTrustTriple = 'OriginAtomWithTrustTriple',
}

/** Common props shared across all origin states */
type BaseOriginProps = {
  /** The raw origin URL from the transaction */
  originUrl: string | undefined;
  /** Extracted hostname for display */
  hostname: string | undefined;
  /** Trusted contacts who have positions on this origin's trust triple */
  trustedCircle?: TrustedCirclePositions;
};

// Discriminated union types for proper OriginProps typing
export type OriginProps =
  | (BaseOriginProps & {
      originType: OriginType.NoOrigin;
      origin: null;
      triple: null;
    })
  | (BaseOriginProps & {
      originType: OriginType.NoAtom;
      origin: null;
      triple: null;
    })
  | (BaseOriginProps & {
      originType: OriginType.AtomWithoutTrustTriple;
      origin: Origin;
      triple: null;
    })
  | (BaseOriginProps & {
      originType: OriginType.AtomWithTrustTriple;
      origin: Origin;
      triple: OriginTriple;
    });

// Helper type to extract props for a specific origin type
export type PropsForOriginType<T extends OriginType> = Extract<
  OriginProps,
  { originType: T }
>;
