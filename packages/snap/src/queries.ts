import { chainConfig } from './config';

/**
 * Executes a GraphQL query against the Intuition API.
 * Uses native fetch for Snap compatibility (Snaps run in a hardened SES environment
 * where axios may not work correctly).
 *
 * @param query - The GraphQL query string
 * @param variables - Query variables object
 * @returns The GraphQL response data
 * @throws Error if the request fails or returns GraphQL errors
 */
export const graphQLQuery = async (query: string, variables: Record<string, unknown>) => {
  const response = await fetch(chainConfig.backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Handle GraphQL-level errors
  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result;
};

/**
 * Query to find atoms by address (plain or CAIP format).
 * Orders by total_market_cap to prefer the most-staked (canonical) atom.
 */
export const getAddressAtomsQuery = `
query AddressAtoms($plainAddress: String!, $caipAddress: String!) {
  # Atoms matching plain address format (for EOAs)
  plainAtoms: atoms(
    where: {
      _or: [
        { label: { _ilike: $plainAddress } },
        { data: { _ilike: $plainAddress } }
      ]
    },
    order_by: { term: { total_market_cap: desc_nulls_last } },
    limit: 1
  ) {
    term_id
    type
    label
    image
    data
    emoji
    creator_id
  }

  # Atoms matching CAIP format (for smart contracts)
  caipAtoms: atoms(
    where: {
      _or: [
        { label: { _ilike: $caipAddress } },
        { data: { _ilike: $caipAddress } }
      ]
    },
    order_by: { term: { total_market_cap: desc_nulls_last } },
    limit: 1
  ) {
    term_id
    type
    label
    image
    data
    emoji
    creator_id
  }
}
`;

// will take in predicate_id and object_id
// then will look for instances of account being used
// as the subject for the triple and select the triple with the highest
// total market cap
export const getTripleWithPositionsDataQuery = `
query TripleWithPositionAggregates($subjectId: String!, $predicateId: String!, $objectId: String!, $userAddress: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId },
    predicate_id: { _eq: $predicateId },
    object_id: { _eq: $objectId }
  }) {
    term_id
    subject_id
    predicate_id
    object_id
    creator_id
    counter_term_id

    # Main vault (support) market data
    term {
      vaults(where: { curve_id: { _eq: "1" } }) {
        term_id
        market_cap
        position_count
        curve_id
      }
    }

    # Counter vault (oppose) market data
    counter_term {
      vaults(where: { curve_id: { _eq: "1" } }) {
        term_id
        market_cap
        position_count
        curve_id
      }
    }

    # Triple-specific aggregated market data
    triple_term {
      term_id
      counter_term_id
      total_market_cap
      total_position_count
    }

    # Detailed triple vault data per curve
    triple_vault {
      term_id
      counter_term_id
      curve_id
      position_count
      market_cap
    }

    positions_aggregate {
      aggregate {
        count
        sum {
          shares
        }
        avg {
          shares
        }
      }
    }

    counter_positions_aggregate {
      aggregate {
        count
        sum {
          shares
        }
        avg {
          shares
        }
      }
    }

    positions(
      order_by: { shares: desc }
      limit: 30
    ) {
      id
      account_id
      term_id
      curve_id
      shares
      account {
        id
        label
      }
    }

    counter_positions(
      order_by: { shares: desc }
      limit: 30
    ) {
      id
      account_id
      term_id
      curve_id
      shares
      account {
        id
        label
      }
    }

    # User's specific position (if any)
    user_position: positions(where: { account_id: { _ilike: $userAddress } }) {
      account_id
      shares
    }

    # User's specific counter-position (if any)
    user_counter_position: counter_positions(where: { account_id: { _ilike: $userAddress } }) {
      account_id
      shares
    }
  }
  chainlink_prices(limit: 1, order_by: { id: desc }) {
    usd
  }
  backup_chainlink_prices: chainlink_prices(
    limit: 1,
    order_by: { id: desc },
    where: { usd: { _is_null: false } }
  ) {
    usd
  }
}
`;

/**
 * Query to find an atom by URL (for origin trust signals).
 * Searches by label or data field matching the origin URL.
 * Orders by total_market_cap to prefer the most-staked (canonical) atom.
 */
export const getOriginAtomQuery = `
query OriginAtom($originUrl: String!) {
  atoms(
    where: {
      _or: [
        { label: { _ilike: $originUrl } },
        { data: { _ilike: $originUrl } }
      ]
    },
    order_by: { term: { total_market_cap: desc_nulls_last } },
    limit: 1
  ) {
    term_id
    type
    label
    image
    data
    emoji
    creator_id
  }
}
`;

/**
 * Query for origin trust triple data.
 * Simplified version of getTripleWithPositionsDataQuery for origin display.
 */
export const getOriginTrustTripleQuery = `
query OriginTrustTriple($subjectId: String!, $predicateId: String!, $objectId: String!, $userAddress: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId },
    predicate_id: { _eq: $predicateId },
    object_id: { _eq: $objectId }
  }) {
    term_id

    term {
      vaults(where: { curve_id: { _eq: "1" } }) {
        term_id
        market_cap
        position_count
      }
    }

    counter_term {
      vaults(where: { curve_id: { _eq: "1" } }) {
        term_id
        market_cap
        position_count
      }
    }

    positions(order_by: { shares: desc }, limit: 30) {
      id
      shares
      account_id
    }

    counter_positions(order_by: { shares: desc }, limit: 30) {
      id
      shares
      account_id
    }

    # User's specific position (if any)
    user_position: positions(where: { account_id: { _ilike: $userAddress } }) {
      account_id
      shares
    }

    # User's specific counter-position (if any)
    user_counter_position: counter_positions(where: { account_id: { _ilike: $userAddress } }) {
      account_id
      shares
    }
  }
}
`;

/**
 * Query to get the user's trusted circle.
 * Returns accounts that the user has staked FOR on trust triples.
 * Minimal data for bandwidth efficiency - only subject_id and label.
 *
 * Note: Path is positions → term → triple (not positions → triple directly).
 * The term table is a unified view of both atoms and triples.
 */
export const getUserTrustedCircleQuery = `
query UserTrustedCircle($userAddress: String!, $predicateId: String!, $objectId: String!) {
  positions(
    where: {
      account_id: { _ilike: $userAddress },
      term: {
        triple: {
          predicate_id: { _eq: $predicateId },
          object_id: { _eq: $objectId }
        }
      }
    },
    order_by: { shares: desc },
    limit: 200
  ) {
    term {
      triple {
        subject_id
        subject {
          label
          data
        }
      }
    }
  }
}
`;

/**
 * Query to fetch atom data for multiple addresses.
 * Used to enrich trusted circle contacts with ENS names/labels.
 * The backend resolves ENS names automatically, so atom.label will contain
 * the ENS name if available.
 */
export const getAtomsForAddressesQuery = `
query AtomsForAddresses($addresses: [String!]!) {
  atoms(
    where: {
      _or: [
        { label: { _in: $addresses } },
        { data: { _in: $addresses } }
      ]
    }
  ) {
    term_id
    label
    data
    image
  }
}
`;

/**
 * Query to find all triples where a given atom is the subject.
 * Used to discover any claims made about an address by anyone,
 * including the stakers (position holders) on each claim.
 * Excludes the trust triple (hasTag trustworthy) since that's displayed separately.
 *
 * Returns predicate + object labels so we can show claim context
 * (e.g., "tagged as DeFi Protocol").
 */
export const getAllClaimsAboutAtomQuery = `
query AllClaimsAboutAtom($subjectId: String!, $excludePredicateId: String!, $excludeObjectId: String!) {
  triples(
    where: {
      subject_id: { _eq: $subjectId },
      _not: {
        _and: [
          { predicate_id: { _eq: $excludePredicateId } },
          { object_id: { _eq: $excludeObjectId } }
        ]
      }
    },
    order_by: { triple_term: { total_market_cap: desc_nulls_last } },
    limit: 20
  ) {
    term_id
    predicate_id
    object_id

    predicate {
      label
    }
    object {
      label
    }

    positions(order_by: { shares: desc }, limit: 20) {
      account_id
      shares
    }

    counter_positions(order_by: { shares: desc }, limit: 20) {
      account_id
      shares
    }
  }
}
`;

export const getListWithHighestStakeQuery = `
  query GetTriplesWithHighestStake($subjectId: String!, $predicateId: String!) {
    triples(
      where: {
        subject_id: { _eq: $subjectId },
        predicate_id: { _eq: $predicateId }
      },
      order_by: { triple_term: { total_market_cap: desc } }
    ) {
      term_id
      subject_id
      predicate_id
      object_id
      creator_id
      counter_term_id

      # Triple-specific aggregated market data (stake information)
      triple_term {
        term_id
        counter_term_id
        total_market_cap
        total_position_count
      }

      # Individual vault data
      term {
        vaults(where: { curve_id: { _eq: "1" } }) {
          term_id
          market_cap
          position_count
          curve_id
        }
      }

      counter_term {
        vaults(where: { curve_id: { _eq: "1" } }) {
          term_id
          market_cap
          position_count
          curve_id
        }
      }

      # Object information for context
      object {
        label
        image
        data
      }
    }

    chainlink_prices(limit: 1, order_by: { id: desc }) {
      usd
    }
  }
`;
