import { chainConfig } from './config';

/**
 * TODO (address matching consistency): several queries use `_ilike` for address
 * EQUALITY instead of `_eq` / `_in` on EIP-55 checksummed addresses. This
 * contradicts the documented house standard (docs/patterns/GRAPHQL-PATTERNS.md)
 * and is inconsistent with the `_in` queries here (getExtendedNetworkQuery,
 * getAtomsForAddressesQuery). It is functionally fine for hex addresses but
 * slower (case-insensitive match can't use a plain index) and slightly
 * off-standard. `_ilike` should be reserved for fuzzy text/label search only.
 *
 * Affected:
 *  - getAddressAtomsQuery (label/data match on $plainAddress / $caipAddress)
 *  - getTripleWithPositionsDataQuery (user_position / user_counter_position
 *    filters on account_id)
 *  - getUserTrustedCircleQuery (positions account_id filter)
 *  - getSelfClaimsAboutAtomQuery (positions / counter_positions account_id
 *    filters, incl. the user_position / user_counter_position sub-selects)
 *
 * Fix: checksum the address(es) caller-side (viem `getAddress()`) and switch to
 * `_eq` (single) / `_in` (list), matching the canonical checksummed form the
 * indexer stores.
 */

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
export const graphQLQuery = async (
  query: string,
  variables: Record<string, unknown>,
) => {
  const response = await fetch(chainConfig.backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `GraphQL request failed: ${response.status} ${response.statusText}`,
    );
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

    # Main vault (support) market data — all curves; aggregate via sumMarketCap.
    term {
      vaults {
        term_id
        market_cap
        position_count
        curve_id
      }
    }

    # Counter vault (oppose) market data — all curves; aggregate via sumMarketCap.
    counter_term {
      vaults {
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
 * Matches any of the canonical + legacy label variants (exact `_in`) against
 * label or data, so atoms minted under the new `https://` paradigm AND legacy
 * bare-hostname / http / www forms all resolve.
 * Orders by total_market_cap to prefer the most-staked (canonical) atom.
 */
export const getOriginAtomQuery = `
query OriginAtom($labels: [String!]!) {
  atoms(
    where: {
      _or: [
        { label: { _in: $labels } },
        { data: { _in: $labels } }
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
 * Query to get the user's trusted circle.
 *
 * The trust circle is the set of accounts the user *follows*, expressed as
 * `[I] follow [target]` triples (shared first-person "I" atom as subject,
 * the `follow` predicate, and the followed account as the object). The user
 * "follows" an account by holding a FOR position on that triple, so we filter
 * positions by `account_id` and return each triple's OBJECT (the followed
 * account).
 *
 * Note: Path is positions → term → triple (not positions → triple directly).
 * The term table is a unified view of both atoms and triples.
 */
export const getUserTrustedCircleQuery = `
query UserTrustedCircle($userAddress: String!, $subjectId: String!, $predicateId: String!) {
  positions(
    where: {
      account_id: { _ilike: $userAddress },
      term: {
        triple: {
          subject_id: { _eq: $subjectId },
          predicate_id: { _eq: $predicateId }
        }
      }
    },
    order_by: { shares: desc },
    limit: 200
  ) {
    term {
      triple {
        object_id
        object {
          label
          data
        }
      }
    }
  }
}
`;

/**
 * Query to fetch the viewer's EXTENDED network (2-hop "friend-of-a-friend").
 *
 * Given the viewer's direct-follow wallet addresses (`followerAddresses`), this
 * returns every `[I] follow [G]` position those follows hold — i.e. the accounts
 * the viewer's follows follow. The position's `account_id` is the BRIDGE: which
 * direct follow reached each FoaF. Group rows by `object` to derive each FoaF and
 * its set of bridges.
 *
 * Address matching follows the house standard (docs/patterns/GRAPHQL-PATTERNS.md):
 * `followerAddresses` are EIP-55 checksummed (run through `viem.getAddress()` by
 * the caller) and matched with `_in` — the indexer stores `account_id`
 * checksummed, so that is the one canonical form. Never `_ilike` and never a
 * lowercased address here (`_ilike` is reserved for fuzzy text/label search).
 *
 * Deliberately does NOT select `shares` and is NOT ordered by stake: bridge count
 * (distinct bridges per FoaF) is the only weight in the 2-hop layer. `limit` is a
 * payload cap only. Seeds are the viewer's follows ONLY — never the whitelist.
 *
 * See docs/extended-network-spec.md.
 */
export const getExtendedNetworkQuery = `
query ExtendedNetwork($followerAddresses: [String!]!, $subjectId: String!, $predicateId: String!) {
  positions(
    where: {
      account_id: { _in: $followerAddresses },
      term: {
        triple: {
          subject_id: { _eq: $subjectId },
          predicate_id: { _eq: $predicateId }
        }
      }
    },
    limit: 2000
  ) {
    account_id
    term {
      triple {
        object_id
        object {
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
 *
 * The `has tag → trustworthy` triple is no longer special-cased; it flows
 * through here as a regular claim alongside everything else.
 *
 * Returns predicate + object labels so we can show claim context
 * (e.g., "tagged as DeFi Protocol").
 */
export const getAllClaimsAboutAtomQuery = `
query AllClaimsAboutAtom($subjectId: String!) {
  triples(
    where: {
      subject_id: { _eq: $subjectId }
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

/**
 * Query to fetch the VIEWER'S OWN claims about a subject atom.
 *
 * Returns triples where the subject is the target atom (address or origin) AND
 * the viewer holds a position — FOR (`positions`) or AGAINST
 * (`counter_positions`) — on the triple. This is the "Self" lane: the user's own
 * staked opinions about the subject, surfaced independently of their trusted
 * circle so a personal signal ("I tagged this trustworthy") is always shown back
 * to them.
 *
 * Unlike the familiarity lane this is NOT gated by the familiarity whitelist —
 * any claim the viewer staked is theirs to see — but the consumer still applies
 * the blacklist (non-canonical/duplicate atoms) and the safety-dedup exclusion
 * set so each claim has exactly one home.
 *
 * `user_position` / `user_counter_position` are the viewer's own shares on each
 * side; the consumer reads them to derive the stance (FOR vs AGAINST). The
 * `_ilike` match on `account_id` mirrors the existing self-position pattern in
 * `getTripleWithPositionsDataQuery` (the viewer's own address, any casing).
 *
 * Variables:
 *  - subjectId: term_id of the target atom
 *  - userAddress: the viewer's wallet address
 */
export const getSelfClaimsAboutAtomQuery = `
query SelfClaimsAboutAtom($subjectId: String!, $userAddress: String!) {
  triples(
    where: {
      subject_id: { _eq: $subjectId },
      _or: [
        { positions: { account_id: { _ilike: $userAddress } } },
        { counter_positions: { account_id: { _ilike: $userAddress } } }
      ]
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

    user_position: positions(
      where: { account_id: { _ilike: $userAddress } },
      limit: 1
    ) {
      shares
    }

    user_counter_position: counter_positions(
      where: { account_id: { _ilike: $userAddress } },
      limit: 1
    ) {
      shares
    }
  }
}
`;

/**
 * Query to fetch safety + provenance triples about a subject atom.
 *
 * Returns triples where the subject is the target address atom and the
 * predicate/object fall into the read surface's safety vocabulary:
 *  - any `reported for → *` triple (hard lane; classified client-side by object),
 *  - `has tag → {malicious, suspicious, scammer, bot, impersonation}` (soft lane),
 *  - any provenance predicate (`created by`, `audited by`, `evaluated by`,
 *    `same as`) triple (classified client-side by predicate).
 *
 * Positions (stakers FOR) and creator_id are returned so the consumer can gate
 * each claim by the publisher whitelist and the user's trust circle. Object +
 * predicate labels are returned for attribution/display.
 *
 * Variables:
 *  - subjectId: term_id of the target address atom
 *  - reportedForId: `reported for` predicate term ID
 *  - hasTagId: `has tag` predicate term ID
 *  - softObjectIds: soft-lane object term IDs (filters the hasTag lane)
 *  - provenancePredicateIds: provenance predicate term IDs
 */
export const getSafetyClaimsAboutAtomQuery = `
query SafetyClaimsAboutAtom(
  $subjectId: String!,
  $reportedForId: String!,
  $hasTagId: String!,
  $softObjectIds: [String!]!,
  $provenancePredicateIds: [String!]!
) {
  triples(
    where: {
      subject_id: { _eq: $subjectId },
      _or: [
        { predicate_id: { _eq: $reportedForId } },
        {
          _and: [
            { predicate_id: { _eq: $hasTagId } },
            { object_id: { _in: $softObjectIds } }
          ]
        },
        { predicate_id: { _in: $provenancePredicateIds } }
      ]
    },
    order_by: { triple_term: { total_market_cap: desc_nulls_last } },
    limit: 40
  ) {
    term_id
    predicate_id
    object_id
    creator_id
    creator {
      id
      label
    }

    predicate {
      label
    }
    object {
      label
      image
      data
    }

    triple_term {
      total_market_cap
      total_position_count
    }

    positions(order_by: { shares: desc }, limit: 30) {
      account_id
      shares
      account {
        id
        label
      }
    }

    counter_positions(order_by: { shares: desc }, limit: 30) {
      account_id
      shares
      account {
        id
        label
      }
    }
  }
}
`;

/**
 * Query for the PUBLIC-CLAIMS (escape-hatch) lane.
 *
 * Returns the highest-staked triples about a subject atom — UNFILTERED by the
 * viewer's network — so the lane can surface what the broader community has said
 * even when nobody the viewer follows has weighed in. Mirrors the per-side data
 * proven by `getTripleWithPositionsDataQuery`: each triple's FOR vaults
 * (`term { vaults }`) and AGAINST vaults (`counter_term { vaults }`) for
 * `sumMarketCap()`, plus distinct-staker counts via
 * `positions_aggregate { aggregate { count(columns: account_id, distinct: true) } }`
 * (summing `position_count` across curves would double-count multi-curve stakers).
 *
 * Ordered by `triple_term.total_market_cap desc_nulls_last` and capped at
 * `$limit` (PUBLIC_CLAIMS_FETCH_LIMIT). A separate `triples_aggregate` returns
 * the TRUE total count of claims about the subject for the "View all N" line.
 *
 * Works for any subject atom term_id, so address and domain are the same query.
 *
 * Variables:
 *  - subjectId: term_id of the subject atom (address or origin)
 *  - limit: payload cap (PUBLIC_CLAIMS_FETCH_LIMIT)
 */
export const getPublicClaimsAboutAtomQuery = `
query PublicClaimsAboutAtom($subjectId: String!, $limit: Int!) {
  triples(
    where: {
      subject_id: { _eq: $subjectId }
    },
    order_by: { triple_term: { total_market_cap: desc_nulls_last } },
    limit: $limit
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

    # FOR vault market data — all curves; aggregate via sumMarketCap.
    term {
      vaults {
        market_cap
        curve_id
      }
    }

    # AGAINST vault market data — all curves; aggregate via sumMarketCap.
    counter_term {
      vaults {
        market_cap
        curve_id
      }
    }

    # Distinct FOR stakers (unique accounts, not per-curve positions).
    positions_aggregate {
      aggregate {
        count(columns: account_id, distinct: true)
      }
    }

    # Distinct AGAINST stakers (unique accounts, not per-curve positions).
    counter_positions_aggregate {
      aggregate {
        count(columns: account_id, distinct: true)
      }
    }
  }

  # True total claim count about the subject (for the "View all N" line).
  triples_aggregate(where: { subject_id: { _eq: $subjectId } }) {
    aggregate {
      count
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

      # Individual vault data — all curves; aggregate via sumMarketCap.
      term {
        vaults {
          term_id
          market_cap
          position_count
          curve_id
        }
      }

      counter_term {
        vaults {
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
