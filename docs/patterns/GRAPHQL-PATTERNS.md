# GraphQL Patterns

> **Purpose**: Query patterns for the Intuition GraphQL API. Self-contained with inline prerequisites.

---

## Prerequisites

**GraphQL Endpoint:** `https://mainnet.intuition.sh/v1/graphql`

**Well-Known Atom IDs:**
- hasTag: `0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd`
- trustworthy: `0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a`

---

## Critical Rules

1. **Use `_eq` against the EIP-55 checksummed address — never `_ilike` for addresses** — Indexed addresses (`account_id`, `creator_id`, `accounts.id`, address-typed `atoms.data`) are stored EIP-55 checksummed: that is the one canonical form. Run `viem.getAddress()` on every address at the boundary, then match with `_eq` / `_in`. `_ilike` is reserved for fuzzy *text/label* search and must never touch an address. Never store, cache, or display a lowercased (non-canonical) address.
2. **Navigate through `term`** — Positions don't directly reference atoms/triples
3. **Add `limit`** — Prevent timeout on large result sets
4. **Aggregate across curves for reads; pin writes to `curve_id = 1`** — Headline aggregates (`market_cap`, position counts) must sum across all curves so curve-2+ positions are not silently dropped. Filtering by `curve_id: { _eq: "1" }` in read queries is a known bug source. Write paths (deposit/redeem) still pin to `curveId = 1n` until the UI supports per-curve staking — see [CONTRACT-PATTERNS.md](./CONTRACT-PATTERNS.md).

---

## Pattern 1: Find Atom by Address

```graphql
query FindAtomByAddress($address: String!) {
  atoms(where: {
    _or: [
      { data: { _eq: $address } },
      { label: { _eq: $address } }
    ]
  }) {
    term_id
    label
    image
    type
    data
  }
}
```

**Why `data`, and why `_eq`?** The full EIP-55 checksummed address lives in `data`. `label` is the *display* field — an ENS name (`vitalik.eth`) or a truncated address (`0x920D...42bC`) — so the `label` arm only matches legacy atoms whose label is the full checksummed address. Pass `$address` already checksummed (via `viem.getAddress()`) and match exactly with `_eq`.

---

## Pattern 2: Get Trust Triple with Positions

```graphql
query GetTrustTriple($subjectId: String!, $hasTagId: String!, $trustworthyId: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId },
    predicate_id: { _eq: $hasTagId },
    object_id: { _eq: $trustworthyId }
  }) {
    term_id
    counter_term_id
    term {
      # ✅ DO: aggregate across all curves so curve-2+ positions are counted
      vaults_aggregate { aggregate { sum { market_cap } } }
      positions_aggregate(where: { shares: { _gt: "0" } }) { aggregate { count } }
      # For per-row reads that need a single representative share price,
      # use the helper `linearVault(vaults)` (see `packages/snap/src/term-stats.ts`)
      # against the unfiltered `vaults { curve_id, current_share_price, market_cap, position_count }` selection.
    }
    positions(order_by: { shares: desc }, limit: 30) {
      account_id
      shares
    }
    counter_positions(order_by: { shares: desc }, limit: 30) {
      account_id
      shares
    }
  }
}
```

```graphql
# ❌ DON'T: filter vaults by curve_id for headline reads — silently drops
#          every position staked on curve 2+, producing wrong market caps
#          and undercounted "stakers" / "positions" numbers.
term {
  vaults(where: { curve_id: { _eq: "1" } }) { market_cap, position_count }
}
```

> **Note:** `total_market_cap` on `term` is *not* a reliable cross-curve sum for headline displays — at least one mainnet triple has been observed where it diverges from `sum(vaults.market_cap)`. Prefer `vaults_aggregate { aggregate { sum { market_cap } } }` for headlines.

---

## Pattern 3: Get User's Position + Aggregate (One Query)

Use GraphQL aliases to fetch both in a single request:

```graphql
query TripleWithUserPosition($termId: String!, $userAddress: String!) {
  triple(term_id: $termId) {
    term_id
    
    # Aggregate positions
    positions(order_by: { shares: desc }, limit: 30) {
      account_id
      shares
    }
    
    # User's specific FOR position
    user_position: positions(where: { account_id: { _eq: $userAddress } }) {
      shares
    }
    
    # User's specific AGAINST position
    user_counter_position: counter_positions(where: { account_id: { _eq: $userAddress } }) {
      shares
    }
  }
}
```

---

## Pattern 4: Get User's All Positions

```graphql
query GetUserPositions($userId: String!) {
  positions(
    where: { account_id: { _eq: $userId } },
    order_by: { shares: desc }
  ) {
    term_id
    shares
    term {
      type
      atom { 
        label 
        image 
      }
      triple {
        subject { label }
        predicate { label }
        object { label }
      }
      # ✅ DO: return vaults across all curves; aggregate client-side with
      #         sumMarketCap / linearVault helpers (see `packages/snap/src/term-stats.ts`).
      vaults {
        curve_id
        market_cap
        current_share_price
        position_count
      }
    }
  }
}
```

```typescript
// Per-row consumer pattern:
import { sumMarketCap, sumPositionCount, linearVault } from './term-stats'

const cap = sumMarketCap(position.term?.vaults)
const count = sumPositionCount(position.term?.vaults)
const sharePrice = linearVault(position.term?.vaults)?.current_share_price

// ❌ DON'T: vaults[0] indexing — silently drops curve-2+ positions
const cap = position.term?.vaults?.[0]?.market_cap
```

---

## Pattern 5: Get Trust Circle (follow-based)

Find all accounts the user follows — `[I] → [follow] → [target]` triples the user has staked FOR. Match by the **position's** `account_id` (the staker); the followed account is the triple's **object**:

```graphql
query GetTrustCircle($userId: String!, $iAtomId: String!, $followAtomId: String!) {
  positions(where: {
    account_id: { _eq: $userId },
    term: {
      triple: {
        subject_id: { _eq: $iAtomId },
        predicate_id: { _eq: $followAtomId }
      }
    }
  }) {
    shares
    term {
      triple {
        object_id
        object { 
          label  # ENS name (for display)
          data   # Wallet address (for matching)
        }
      }
    }
  }
}
```

**⚠️ Important:** The followed account is the triple's `object` (the subject is always the shared `I` atom). Extract the wallet address from `object.data` first, not `object.label`. See [ENS-HANDLING.md](./ENS-HANDLING.md).

> The legacy `[X] → [hasTag] → [trustworthy]` pattern is no longer used to build the circle. `hasTag/trustworthy` is still read to display a target's trustworthiness market (see Pattern 1).

---

## Pattern 6: Search Atoms

```graphql
query SearchAtoms($query: String!, $limit: Int = 20) {
  atoms(
    where: { label: { _ilike: $query } },
    order_by: [{ term: { total_market_cap: desc } }],
    limit: $limit
  ) {
    term_id
    label
    image
    type
    term {
      total_market_cap
    }
  }
}
```

**Note:** Use `%` wildcards in the variable: `$query = "%searchterm%"`

---

## Pattern 7: Get Atom with Trust Data

```graphql
query GetAtomWithTrust($termId: String!, $hasTagId: String!, $trustworthyId: String!) {
  atom(term_id: $termId) {
    term_id
    label
    image
    type
    as_subject_triples(where: {
      predicate_id: { _eq: $hasTagId },
      object_id: { _eq: $trustworthyId }
    }) {
      term_id
      term {
        # ✅ DO: aggregate across all curves
        vaults_aggregate { aggregate { sum { market_cap } } }
        positions_aggregate(where: { shares: { _gt: "0" } }) { aggregate { count } }
      }
    }
  }
}
```

---

## Common Mistakes

### ❌ Lowercase / `_ilike` Address Matching

```graphql
# WRONG — non-canonical: lowercases the address and fuzzy-matches it
atoms(where: { data: { _ilike: "0xabc123..." } })
```

### ✅ Checksummed `_eq` Matching

```graphql
# CORRECT — exact match on the EIP-55 checksummed value from viem.getAddress()
atoms(where: { data: { _eq: "0xAbC123..." } })
```

---

### ❌ Direct Triple Navigation from Positions

```graphql
# WRONG - positions don't have triple field
positions(where: { triple: { predicate_id: { _eq: $id } } })
```

### ✅ Navigate Through Term

```graphql
# CORRECT - go through term
positions(where: {
  term: {
    triple: {
      predicate_id: { _eq: $id }
    }
  }
})
```

---

### ❌ Missing Pagination

```graphql
# Slow/timeout risk
atoms { term_id label }
```

### ✅ Add Limits

```graphql
# Better
atoms(limit: 50) { term_id label }
```

---

### ❌ Filtering Headline Reads by `curve_id = 1`

```graphql
# WRONG: ignores curve-2+ positions, undercounts market_cap and stakers
term {
  vaults(where: { curve_id: { _eq: "1" } }) { market_cap, position_count }
}
```

### ✅ Aggregate Across Curves

```graphql
# CORRECT: sums market cap across all curves; counts all open positions
term {
  vaults_aggregate { aggregate { sum { market_cap } } }
  positions_aggregate(where: { shares: { _gt: "0" } }) { aggregate { count } }
}
```

For per-row consumers that already iterate the `vaults[]` array, use the
`sumMarketCap` / `sumPositionCount` / `linearVault` helpers in
`packages/snap/src/term-stats.ts` instead of indexing `vaults[0]`.

> **Heads up:** `total_shares` and `current_share_price` are *per-curve* values
> and are not directly comparable across curves. Don't show them as headline
> numbers unless you've explicitly picked one curve (e.g. via `linearVault`).
> `total_market_cap` on `term` has been observed to diverge from the true
> cross-curve sum on at least one triple — prefer `vaults_aggregate` for
> headline displays.

---

## TypeScript Usage

```typescript
const result = await graphqlClient.query({
  atoms: {
    __args: {
      where: {
        _or: [
          { data: { _eq: address } },
          { label: { _eq: address } }
        ]
      }
    },
    term_id: true,
    label: true,
    image: true,
  }
});
```

---

## GraphQL Schema Quick Reference

### Core Types

| Type | Key Fields |
|------|------------|
| `atoms` | term_id, label, data, image, type |
| `triples` | term_id, subject_id, predicate_id, object_id, counter_term_id |
| `positions` | account_id, term_id, shares, curve_id |
| `terms` | id, type, atom_id, triple_id, total_market_cap *(not reliably cross-curve; aggregate `vaults.market_cap` for headlines)* |
| `vaults` | term_id, curve_id, market_cap, current_share_price *(rows are per-curve — sum or pick `linearVault`, don't `vaults[0]`)* |

### Relationship Navigation

```
positions → term → triple → subject/predicate/object
         → term → atom
         → account
         → vault
```

---

*See also: [ENS-HANDLING.md](./ENS-HANDLING.md) for address extraction*

*Last updated: January 21, 2026*
