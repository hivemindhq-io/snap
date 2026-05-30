# Trust Circle Implementation

> **Purpose**: Complete pattern for implementing the trust circle feature (showing when followed accounts have staked on a target entity).

> ## Current state (since 2026-05-30): follow-based circle
>
> The Snap builds the user's trust circle from `[I] → [follow] → [target]` triples — i.e. *"the user follows this account"*. This matches the **canonical Hive Mind pattern** already used by the browser extension and explorer.
>
> A user "follows" an account by holding a FOR position on `[I] → [follow] → [their address]`. We find the circle by filtering **positions** to the viewer's `account_id` and reading each triple's **object** (the followed account).
>
> The previous `[X] → [hasTag] → [trustworthy]` pattern is **legacy** and no longer used to build a viewer's circle. The `hasTag/trustworthy` triple is still read for *displaying a target's trustworthiness market* (see Step 3), but it is not how the circle is constructed. Per-topic trust circles and topical curatorship are **not** part of the active pattern in any Hive Mind product.
>
> Implemented in `packages/snap/src/trusted-circle/service.ts`, `packages/snap/src/queries.ts` (`getUserTrustedCircleQuery`), and `packages/snap/src/config.ts` (`iAtomId` / `followAtomId`).

---

## What is Trust Circle?

The trust circle shows **people the user follows who have also staked on a target entity**. This provides social proof: "People you follow also trust this address."

---

## Prerequisites

**Atom IDs** (content-addressed — same on mainnet `1155` and testnet `13579`):

- `iAtomId`: `0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b`
- `followAtomId`: `0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260`

These come from `chainConfig` in `packages/snap/src/config.ts`. Always read them from `chainConfig` — never inline the hex.

**Trust Triple Structure:**

```
Subject:   I atom         (fixed; universal self-referential subject)
Predicate: follow atom    (Schema.org FollowAction)
Object:    address atom   (the person/account being followed)
```

The staker's identity is captured by the on-chain `account_id` on the position — **not** by the triple's subject (which is always the shared `I` atom). "I follow Alice" is expressed by staking FOR the triple `[I] → [follow] → [Alice's address atom]`. Many users share the same triple; their positions distinguish them.

**Critical Dependency:** [ENS-HANDLING.md](./ENS-HANDLING.md) — Wallet addresses are in `object.data` for ENS-resolved atoms.

---

## Algorithm Overview

```
1. Get the viewer's follow circle (addresses they've staked FOR on [I] → [follow] → [target] triples)
2. Extract wallet addresses from each triple's object atom
3. Get positions on whatever target triple is being evaluated
4. Find overlap between the viewer's follow circle and the target's position holders
5. Display matches with names and stake amounts
```

---

## Step 1: Get the Viewer's Follow Circle

Query all follow triples where the viewer has staked FOR. Match by the **position's** `account_id` (the staker), not the triple's subject:

```graphql
query GetFollowCircle($userAddress: String!, $iAtomId: String!, $followAtomId: String!) {
  positions(where: {
    account_id: { _eq: $userAddress },
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

This is `getUserTrustedCircleQuery` in `packages/snap/src/queries.ts`, called by `fetchTrustedCircleFromAPI` in `trusted-circle/service.ts`.

---

## Step 2: Extract Wallet Addresses

⚠️ **Critical:** Use the ENS handling pattern — the address lives in `object.data`, not `object.label`, for ENS-resolved atoms.

```typescript
interface TrustedContact {
  accountId: string;   // Wallet address (lowercase)
  label: string;       // Display name (ENS or truncated address)
}

function buildFollowCircle(positions: FollowCirclePosition[]): Map<string, TrustedContact> {
  const contactMap = new Map<string, TrustedContact>();

  for (const position of positions) {
    const object = position.term.triple.object;

    const walletAddress = extractWalletAddress(object);

    if (walletAddress) {
      contactMap.set(getAddress(walletAddress), {
        accountId: walletAddress,
        label: object.label || walletAddress,
      });
    }
  }

  return contactMap;
}

function extractWalletAddress(atom: { label?: string; data?: string }): string | null {
  const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/i.test(v);

  if (atom.data && isEvmAddress(atom.data)) {
    return getAddress(atom.data);
  }
  if (atom.label && isEvmAddress(atom.label)) {
    return getAddress(atom.label);
  }
  return null;
}
```

---

## Step 3: Get Target Entity's Positions

The target triple varies by feature. A common case is the trustworthy tag on an address:

```graphql
query GetTargetPositions($subjectId: String!, $hasTagId: String!, $trustworthyId: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId },
    predicate_id: { _eq: $hasTagId },
    object_id: { _eq: $trustworthyId }
  }) {
    term_id
    positions(order_by: { shares: desc }) {
      account_id
      shares
    }
    counter_positions(order_by: { shares: desc }) {
      account_id
      shares
    }
  }
}
```

The target triple is independent of the follow circle. The viewer's circle is built once (from follow triples); each thing the viewer browses contributes its own target-position query. In the Snap, the target trust triple (`[address] → [hasTag] → [trustworthy]`) is fetched in `account.tsx` / `origin.tsx` and its positions are cross-referenced in `onTransaction.tsx`.

---

## Step 4: Find Overlap

```typescript
interface TrustCircleMatch {
  contact: TrustedContact;
  shares: string;
  direction: 'for' | 'against';
}

function findTrustCircleOverlap(
  followCircle: Map<string, TrustedContact>,
  forPositions: Position[],
  againstPositions: Position[]
): TrustCircleMatch[] {
  const matches: TrustCircleMatch[] = [];

  for (const pos of forPositions) {
    const contact = followCircle.get(getAddress(pos.account_id));
    if (contact) {
      matches.push({ contact, shares: pos.shares, direction: 'for' });
    }
  }

  for (const pos of againstPositions) {
    const contact = followCircle.get(getAddress(pos.account_id));
    if (contact) {
      matches.push({ contact, shares: pos.shares, direction: 'against' });
    }
  }

  return matches.sort((a, b) =>
    BigInt(b.shares) > BigInt(a.shares) ? 1 : -1
  );
}
```

This is `getTrustedContactsWithPositions` in `trusted-circle/service.ts`.

---

## Step 5: Display

```typescript
function renderTrustCircle(matches: TrustCircleMatch[]) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <div>
      <h3>People you follow</h3>
      {matches.map(match => (
        <div key={match.contact.accountId}>
          <span>{match.contact.label}</span>
          <span>{match.direction === 'for' ? 'Trusts' : 'Distrusts'}</span>
          <span>{formatShares(match.shares)}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Complete Implementation

```typescript
async function getTrustCircleOverlap(
  graphqlClient: GraphQLClient,
  viewerAddress: string,
  targetSubjectId: string
): Promise<TrustCircleMatch[]> {
  const { iAtomId, followAtomId, hasTagAtomId, trustworthyAtomId } = chainConfig;

  const [followCircleData, targetData] = await Promise.all([
    graphqlClient.query({
      positions: {
        __args: {
          where: {
            account_id: { _eq: viewerAddress },
            term: {
              triple: {
                subject_id: { _eq: iAtomId },
                predicate_id: { _eq: followAtomId },
              },
            },
          },
        },
        term: {
          triple: {
            object: { label: true, data: true },
          },
        },
      },
    }),
    graphqlClient.query({
      triples: {
        __args: {
          where: {
            subject_id: { _eq: targetSubjectId },
            predicate_id: { _eq: hasTagAtomId },
            object_id: { _eq: trustworthyAtomId },
          },
        },
        positions: { account_id: true, shares: true },
        counter_positions: { account_id: true, shares: true },
      },
    }),
  ]);

  const followCircle = buildFollowCircle(followCircleData.positions);

  const triple = targetData.triples[0];
  if (!triple) {
    return [];
  }

  return findTrustCircleOverlap(
    followCircle,
    triple.positions,
    triple.counter_positions
  );
}
```

---

## Writing into the Circle (Follow Flow)

The Snap is a **read-only** surface — it only *reads* the viewer's follow circle to compute overlap at sign-time. It does **not** create or deposit into follow triples.

Writing follows (`[I] → [follow] → [their address]`) happens in the browser extension and explorer (e.g. the extension's `useFollowBatch` in `src/hooks/useFollowBatch.ts`, batched through the fee router). See `hivemind-extension/docs/patterns/TRUST-CIRCLE.md` for the write flow.

---

## Caching Strategy

The follow circle is relatively stable. The Snap caches it per-address in `snap_manageState` with a 1-hour TTL (`packages/snap/src/trusted-circle/cache.ts`):

```typescript
const CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour

async function getCachedFollowCircle(viewerAddress: string): Promise<TrustedContact[] | null> {
  const cached = state[getAddress(viewerAddress)];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.contacts;
  }

  return null; // cache miss / expired → fetch fresh
}
```

> **Migration note:** the cache value shape (`TrustedContact[]`) is unchanged by the follow migration, but entries computed under the old `hasTag/trustworthy` model can linger for up to the 1-hour TTL. Reinstall the Snap or call `clearTrustedCircleCache()` to force a fresh follow-based circle.

---

## Common Mistakes

### ❌ Matching on the Triple's Subject

```typescript
// WRONG - the subject is always the I atom, not the staker
where: { triple: { subject_id: { _eq: viewerAddress } } }
```

### ✅ Match on the Position's account_id

```typescript
// CORRECT
where: { account_id: { _eq: viewerAddress }, term: { triple: { ... } } }
```

---

### ❌ Reading the Followed Account from the Subject

```typescript
// WRONG - the followed account is the OBJECT, not the subject
const contact = position.term.triple.subject;
```

### ✅ Read the Object

```typescript
// CORRECT
const contact = position.term.triple.object;
```

---

### ❌ Using Label for Address Matching

```typescript
// WRONG - fails for ENS-resolved atoms
contactMap.set(object.label, contact);  // "vitalik.eth"
```

### ✅ Use Data First

```typescript
const wallet = isEvmAddress(object.data) ? object.data : object.label;
contactMap.set(getAddress(wallet), contact);
```

---

### ❌ Lowercasing Addresses (non-canonical)

```typescript
followCircle.get(position.account_id.toLowerCase())
```

### ✅ Key by the Checksummed Address

```typescript
// account_id is already EIP-55 checksummed from the indexer — key/compare as-is
followCircle.get(position.account_id)
```

---

### ❌ Building Trust Circles from `[X] → [hasTag] → [trustworthy]` Triples

This was the pre-migration pattern. New code must use `[I] → [follow] → [target]`. The hasTag/trustworthy pattern is still readable for displaying existing trustworthy tags on a target, but it is no longer how the viewer's circle is constructed.

---

### ❌ Sequential Fetches

```typescript
const circle = await fetchFollowCircle();
const target = await fetchTargetPositions();
```

### ✅ Parallel Fetches

```typescript
const [circle, target] = await Promise.all([
  fetchFollowCircle(),
  fetchTargetPositions(),
]);
```

---

## Applies To

| Product | Trust circle pattern |
|---------|----------------------|
| Hive Mind Extension | `[I] → [follow] → [target]` (people-first, generic) |
| Hive Mind Explorer | `[I] → [follow] → [target]` (canonical) |
| Intuition Snap | `[I] → [follow] → [target]` (migrated 2026-05-30) |

---

*See also: [ENS-HANDLING.md](./ENS-HANDLING.md) for address extraction details*

*Last updated: May 30, 2026*
