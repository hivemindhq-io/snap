# Extended Network Spec — 2-hop "friend-of-a-friend" trust layer (Snap)

> **Status:** Proposed · **Owner:** Kylan · **Depends on:** the follow-based trust circle
> (`docs/patterns/TRUST-CIRCLE.md`, shipped 2026-05-30) and the safety read surface
> (`docs/claim-surface-spec.md`).
> **Scope:** Add a **2-hop** ("people followed by people I follow") layer to the Snap's
> read surface, sitting *below* the 1-hop trust circle in weight. Defines the data model,
> graph query, service API, caching, integration points, rendering, weighting, and rollout.
> **Non-goals:** writing follows (the Snap is read-only), 3+ hops, topic-scoped circles.

---

## TL;DR (ratified decisions)

1. **The extended network is the union of `[F] → follow → [G]` edges for every direct follow
   `F` in the viewer's *own* 1-hop circle**, minus the viewer and minus the 1-hop set. `G` is a
   *friend-of-a-friend* (FoaF), reachable at **degree 2**.

2. **Seeds are the viewer's follows ONLY — never the whitelist.** A friend-of-an-*authority*
   means nothing: whitelisted publishers are institutional sources, not the viewer's social
   graph, so we never expand 2-hop off them. The seed set is exactly today's `TrustedContact[]`.

3. **One batched query, no N+1.** Because the subject of every follow triple is the shared
   `I` atom (`0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b`), we fetch
   the *entire* 2-hop layer with a single `account_id: { _in: [...directFollows] }` query.
   The position's `account_id` tells us **which** direct follow bridged to each FoaF (the path).

4. **Stake is ignored. Bridge count is the only weight.** We do **not** read or rank by `shares`
   anywhere in the 2-hop layer. The heuristic is purely *how many distinct friends/FoaF made
   the claim* — the number of independent paths. (Seeds are taken as-is from the 1-hop circle,
   capped at `MAX_SEED_FOLLOWS` by insertion order, not by stake.)

5. **Every degree-2 surface requires ≥ `MIN_BRIDGES` distinct bridges** (default **2**) — this
   includes **familiarity**, not just soft flags. One follow-of-a-follow touching an address is
   noise; two or more independent paths is a signal. There is **no** threshold-free 2-hop tier.

6. **2-hop never gates a *hard/critical* safety report.** A FoaF is not an authority. Critical
   gating stays **whitelist + 1-hop trust circle** (per `claim-surface-spec.md` §5.1). The
   extended layer is **enrichment + a clearly-labeled lower tier** for soft signals and
   familiarity — matching `claim-surface-spec.md` §5.4 ("Friend-of-a-friend … lower weight,
   labeled as 2nd-degree").

7. **2-hop renders in its OWN section, never mixed with 1st-degree.** Degree-1 and degree-2 are
   kept in separate, separately-labeled blocks throughout (familiarity, soft warnings,
   attribution). A degree-2 contact is never merged into the trust-circle list.

8. **Layered cache.** The extended set is derived from (and cached alongside) the 1-hop circle,
   under its **own version + TTL**, so the existing trust-circle cache is untouched.

9. **Shipped behind a local flag** (`EXTENDED_NETWORK_ENABLED` in `config.ts`), in **3 phases**:
   enrichment-only → soft-lane 2nd-degree attribution → tuning. No remote feature-config (that
   module was removed with the AI feature).

---

## Definitions

| Term | Meaning |
|---|---|
| **Direct follow / 1-hop / degree 1** | An account `F` the viewer follows: viewer holds a FOR position on `[I] → follow → [F]`. This is today's `TrustedContact`. |
| **FoaF / 2-hop / degree 2** | An account `G` that some direct follow `F` follows (`F` holds FOR on `[I] → follow → [G]`), where `G` is **not** the viewer and **not** already a direct follow. |
| **Bridge / via** | The direct follow(s) `F` that connect the viewer to a FoaF `G`. A FoaF can have multiple bridges. |
| **Bridge count** | Number of *distinct* direct follows that follow a given FoaF. The 2-hop "path strength" / Sybil-resistance signal. |

```
        follow            follow
  [I] ───────────► F ───────────► G
  viewer        1-hop (F)       2-hop (G), bridged "via" F

  Extended network = ⋃  { G : F follows G }  \  ( {viewer} ∪ directFollows )
                    F ∈ directFollows
```

---

## 1. Principles

| Principle | Why |
|---|---|
| **Degree-aware, in its own section** | A direct follow is a deliberate, first-person endorsement; a FoaF is transitive and weaker. They render in **separate** blocks and gate differently — never merged. |
| **Seeds = viewer's follows only** | We expand 2-hop off the viewer's own social graph, never off whitelisted authorities. A friend-of-an-authority is not a trust path. |
| **Count paths, not stake** | Bridge count (how many distinct friends/FoaF asserted it) is the *only* weight. We never read `shares` in the 2-hop layer — stake is irrelevant to "how many people I'm socially near vouch for this". |
| **2-hop enriches, 1-hop (+whitelist) gates** | Transitive trust must not unlock critical warnings or un-suppress hard reports. It adds context and a lower soft tier only. |
| **Multiple independent paths > one path** | `MIN_BRIDGES ≥ 2` is the core anti-Sybil lever, applied to **every** 2-hop surface (familiarity included). A single bridge to a FoaF is barely a signal. |
| **One round-trip** | The 2-hop layer is a single batched `_in` query off the cached 1-hop set — never a fan-out loop. |
| **Reuse, don't fork** | The extended layer is built from the existing follow circle + the existing classification lanes; it adds a `degree`/`fromExtendedNetwork` dimension rather than parallel machinery. |

---

## 2. Data model & graph query

The 1-hop circle is already fetched by `getUserTrustedCircleQuery` (`queries.ts`) — positions
where `account_id = viewer` on `[I] → follow → [*]` triples, reading each triple's **object**
as the followed account (`trusted-circle/service.ts › fetchTrustedCircleFromAPI`).

The 2-hop layer is the **same shape**, keyed on the *direct-follow addresses* instead of the
viewer, fetched in **one** query:

```graphql
# getExtendedNetworkQuery
query ExtendedNetwork(
  $followerAddresses: [String!]!,   # lowercased direct-follow wallet addresses
  $subjectId: String!,              # iAtomId
  $predicateId: String!             # followAtomId
) {
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
    limit: 2000          # payload cap only — NOT ordered by stake
  ) {
    account_id            # the BRIDGE — which direct follow holds this follow
    term {
      triple {
        object_id
        object {
          label           # ENS name (display)
          data            # wallet address (matching) — see ENS-HANDLING.md
        }
      }
    }
  }
}
```

Notes:
- **Seeds are the viewer's follows only.** `followerAddresses` = the 1-hop `TrustedContact[]`
  addresses. The whitelist is **never** a seed (a friend-of-an-authority is not a trust path).
- **FOR-only**, exactly like 1-hop: we read the support-vault `positions` (the FOR table). An
  AGAINST position on a follow triple is not an "unfollow" in this model and is ignored.
- **`account_id` is the bridge.** Each returned row is "bridge `F` follows `object` `G`". Group
  rows by `object` to get each FoaF and its set of bridges. **Bridge count is the only weight —
  `shares` is not selected or read.**
- **No `order_by: shares`.** Unlike the 1-hop query we don't sort by stake; ordering is by
  bridge count, computed client-side after grouping. (We keep `limit` purely as a payload cap.)
- **Address extraction reuses the 1-hop rule** (`object.data` first, then `object.label`; see
  `docs/patterns/ENS-HANDLING.md`).
- **Bounds:** cap seeds at `MAX_SEED_FOLLOWS` (default **200**, already the 1-hop query limit)
  and rows at `limit: 2000`. A viewer following 200 accounts who each follow ~10 yields ~2000
  edges pre-dedup; that's the ceiling.

---

## 3. Types (`trusted-circle/types.ts`)

```ts
/** Degree of separation from the viewer. 1 = direct follow, 2 = friend-of-a-friend. */
export type TrustDegree = 1 | 2;

/**
 * A 2-hop contact: an account followed by one or more of the viewer's direct
 * follows, but not followed by the viewer directly.
 */
export interface ExtendedContact {
  /** The FoaF's wallet address */
  accountId: string;
  /** Display label (ENS name or truncated hex address) */
  label: string;
  /** Lowercased addresses of the direct follows who bridge to this account */
  via: string[];
}

/** Resolved 2-hop layer for a viewer (excludes self + all direct follows). */
export interface ExtendedNetwork {
  /** FoaF contacts, sorted by bridge count desc */
  contacts: ExtendedContact[];
}

/** Cached extended network with TTL + schema version. */
export interface CachedExtendedNetwork {
  contacts: ExtendedContact[];
  timestamp: number;
  /** Bumped when the *definition* of the extended layer changes. */
  version?: number;
}

export interface ExtendedNetworkState {
  [userAddress: string]: CachedExtendedNetwork;
}
```

For gating, consumers mostly need cheap lookups, so the service also exposes derived helpers
(see §4): a `Set<string>` of lowercased FoaF addresses and a `Map<string, ExtendedContact>`.

The existing `SafetyAuthor` (`safety/types.ts`) and `SafetySignal` gain a degree dimension:

```ts
export interface SafetyAuthor {
  accountId: string;
  label: string;
  /** 1 = direct follow / whitelist, 2 = extended network. Absent ⇒ treat as 1. */
  degree?: TrustDegree;
  /** Bridges, only set for degree-2 authors (for "via alice.eth, bob.eth"). */
  via?: string[];
}

// SafetySignal gains:
//   fromExtendedNetwork: boolean   // any degree-2 author contributed
```

---

## 4. Service API (`trusted-circle/service.ts`)

New functions, mirroring the 1-hop API:

```ts
/**
 * Fetches the viewer's extended network (2-hop follows) via one batched query.
 * Derives seeds from the already-resolved 1-hop circle. Caches per-viewer.
 *
 * @param userAddress - viewer (excluded from results)
 * @param directCircle - the viewer's resolved 1-hop circle (seeds + exclusion set)
 */
export async function getExtendedNetwork(
  userAddress: string,
  directCircle: TrustedContact[],
): Promise<ExtendedNetwork>;   // [] when directCircle is empty

/** Build cheap lookup structures for gating/attribution. */
export function indexExtendedNetwork(net: ExtendedNetwork): {
  ids: Set<string>;                       // lowercased FoaF addresses
  byAddress: Map<string, ExtendedContact>;
};
```

`getExtendedNetwork` algorithm:

```
1. If directCircle is empty → return { contacts: [] }.
2. Cache hit (per-viewer, version + TTL valid + derivedFrom matches 1-hop ts) → return cached.
3. seeds = directCircle addresses (lowercased), capped at MAX_SEED_FOLLOWS by insertion order
   (NOT by stake — we never read shares here).
4. Run getExtendedNetworkQuery({ followerAddresses: seeds, subjectId: iAtomId, predicateId: followAtomId }).
5. directSet = lowercased seeds; viewer = userAddress.lowercase().
6. For each row:
     bridge  = row.account_id.lowercase()
     g       = extractWallet(row.term.triple.object)   // data→label, ENS-aware
     if !g || g == viewer || directSet.has(g) → skip
     map[g].via.add(bridge); map[g].label ??= object.label
7. contacts = values(map), sorted by via.length (bridge count) desc, then label.
   NOTE: contacts with via.length < MIN_BRIDGES are still RETAINED here — the
   threshold is applied at the consumer/surface layer, not at fetch time, so the
   cache stays reusable if MIN_BRIDGES is tuned.
8. Cache + return.
```

The existing `getTrustedContactsWithPositions` and `getNetworkFamiliarity` are **generic over a
contact list** — they already accept any `TrustedContact[]` and a label map. The cleanest reuse
is to let them optionally take an extended layer and tag matches with `degree: 2` (see §7),
rather than duplicating the cross-reference logic.

---

## 5. Caching (`trusted-circle/cache.ts`)

- **Separate namespace** from the 1-hop circle so the two evolve independently. Either a new
  `snap_manageState` key prefix (`ext:<address>`) or a sibling map (`ExtendedNetworkState`).
- **`EXTENDED_CACHE_VERSION = 1`**, bumped on any definitional change (independent of the
  1-hop `CACHE_VERSION = 2`).
- **TTL:** the 2-hop layer drifts faster than 1-hop (it depends on what *others* do), but it's
  still on-chain-stable; default **`EXTENDED_CACHE_TTL_MS = 60 * 60 * 1000`** (1h), matching
  1-hop. Tunable down if staleness complaints arise.
- **Derivation order:** the extended cache is only ever populated *after* a valid 1-hop circle
  exists, so a 1-hop cache miss/refresh should **invalidate** the extended entry for that viewer
  (the seed set may have changed). Simplest: store the 1-hop `timestamp` the extended set was
  derived from and treat the extended entry as stale if it differs.
- `clearTrustedCircleCache(address)` should also clear the extended entry.

---

## 6. Integration into `onTransaction.tsx`

Today `getTrustedCircle(userAddress)` runs inside the top-level `Promise.all`. The extended
fetch **depends** on the resolved circle, so it chains right after — but it's independent of the
*target*, so it runs in parallel with the per-target cross-referencing.

```ts
const [accountData, originData, trustedCircle, claimTemplates, publisherWhitelist] =
  await Promise.all([ /* unchanged */ ]);

// NEW: derive the 2-hop layer off the resolved circle (cached; one round-trip on cold start).
const extendedNetwork = EXTENDED_NETWORK_ENABLED && userAddress
  ? await getExtendedNetwork(userAddress, trustedCircle)
  : { contacts: [] };

// Pass BOTH layers to the existing consumers (safety, familiarity, overlap).
```

> **Latency note:** cold start adds exactly one GraphQL round-trip *after* the circle resolves
> (steady state ≈ 0 via cache). If that becomes a sign-time concern, Phase 1 can fetch the
> extended layer **lazily/non-blocking** and only attach it to the *familiarity* section, which
> is the lowest-priority block. Critical/soft rendering never waits on it.

---

## 7. Consumer changes — gate vs. enrich

The crux question, resolved per `claim-surface-spec.md` §5:

| Consumer | 1-hop behavior (today) | 2-hop behavior (this spec) |
|---|---|---|
| **Hard / critical lane** (`reported for`) | gated by whitelist + trust circle; critical iff whitelist | **No gating power.** A FoaF author may be *listed* as a degree-2 contributor on an already-surfaced report, but a FoaF alone never un-suppresses or escalates. |
| **Soft lane** (`has tag → suspicious/malicious/…`) | trust-circle-gated only | **Surfaces if a degree-2 contact authored it AND that contact has ≥ `MIN_BRIDGES` distinct bridges**, rendered in a **separate 2nd-degree** block (below 1st-degree). Never promoted to critical. |
| **Provenance** (`created by`/`audited by`/`same as`/…) | gated by whitelist + trust circle | **Enrich only** — a degree-2 author (≥ `MIN_BRIDGES` bridges) can be shown in a separate "2nd-degree" block; does not change whether the 1st-degree/whitelist row surfaces. |
| **Network familiarity** (`getNetworkFamiliarity`) | 1-hop contacts with any claim | **Add a separate degree-2 familiarity section** ("people in your extended network have also interacted with this"), de-duplicated against degree-1 and the trust-circle section. **Also gated by `MIN_BRIDGES`** (a familiar FoaF must be reachable by ≥2 of your follows) per the ratified decision — no threshold-free 2-hop tier. |
| **Trust overlap** (`getTrustedContactsWithPositions` on the trust triple) | counts direct follows FOR/AGAINST | **Optional** separate secondary count row: "N in your extended network also trust this" (degree-2 contacts with ≥ `MIN_BRIDGES` bridges; never merged into the 1-hop FOR/AGAINST list). |

Mechanically, `buildAuthors` (`safety/service.ts`) gains an `extendedIndex` parameter and, when
an asserting address is not whitelisted and not in the 1-hop trust map but *is* in the extended
index, records it as `{ degree: 2, via: [...] }` and sets `fromExtendedNetwork = true`. Note the
asserting address's *own* bridge count (how many of the viewer's follows follow it) is the
threshold input — **not** stake. The soft-lane gate then becomes:

```
keep soft signal IF  fromTrustCircle                                   // 1-hop (existing)
                  OR (fromExtendedNetwork && maxBridgeCount(signal) >= MIN_BRIDGES)  // NEW
```

where `maxBridgeCount(signal)` = the largest `via.length` among the signal's degree-2 authors.
Stake is never consulted.

> **Dev-gate interaction:** the soft/hard gates are currently **commented out for development**
> (the `DEV-GATE-DISABLED` blocks in `safety/service.ts`). This 2-hop gate must be authored as
> part of the *same* gate block so that when the dev gates are re-enabled before prod, the 1-hop
> **and** 2-hop logic turn on together. Until then, everything surfaces regardless of degree, but
> the `degree`/`via` attribution should still be computed so the UI can show 2nd-degree badges.

---

## 8. Rendering & labeling (`components/Safety.tsx`, familiarity UI)

- **Degree badge.** Degree-2 authors/contacts render with a subtle "2nd-degree" / "via
  alice.eth" affordance. `formatAuthors` already produces "alice.eth, 0x1234…5678 +2 more"; for
  degree-2 it should read e.g. "alice.eth (via bob.eth) — 2nd-degree".
- **Visual hierarchy.** 2nd-degree soft warnings render **below** 1st-degree soft warnings and
  **never** in the critical banner. Familiarity gets an "Extended Network" subsection beneath the
  existing "Also Familiar" (1-hop) block.
- **Rendering home (resolved).** Because the legacy account/Destination card (`renderOnTransaction`)
  is hidden (`accountUI = null`), the trust-circle + familiarity UI that used to live inside it was
  dark. Phase 1 introduces `renderNetworkInsight(networkFamiliarity)` (in `components/NetworkFamiliarity.tsx`),
  rendered **directly in `onTransaction`'s `Box`** between the safety surface and the footer. It
  emits the 1-hop "Also Familiar" `Section` plus the separate degree-2 "Extended Network" `Section`.
  Degree-2 rows show `… · via N of your follows` (bridge-count copy).
- **Attribution string** for a degree-2 soft flag: prefer the bridge phrasing —
  *"Flagged suspicious by 3 accounts your follows trust"* — to make the transitive nature legible
  rather than implying a direct endorsement.

---

## 9. Weighting, thresholds & anti-Sybil

| Knob | Default | Rationale |
|---|---|---|
| `MAX_SEED_FOLLOWS` | 200 | Bounds fan-out; matches the 1-hop query `limit`. Seeds taken in 1-hop list order (NOT stake). |
| `MIN_BRIDGES` (ALL degree-2 surfaces) | 2 | One follow-of-a-follow touching an address is noise; ≥2 independent paths is signal. Applies to familiarity **and** soft flags — no threshold-free tier. |
| `EXTENDED_CACHE_TTL_MS` | 1h | Mirrors 1-hop; 2-hop drifts a bit faster but is on-chain-stable. |
| Query `limit` | 2000 | Ceiling for 200 seeds × ~10 follows each. |

- **Bridge count is the ONLY trust weight** for degree 2 — more distinct bridges ⇒ higher in
  sort order and (at/above `MIN_BRIDGES`) eligible to surface in any 2-hop section.
- **Stake is never read in the 2-hop layer.** No `shares` selection, no `order_by: shares`, no
  transitive stake math. Degree is binary (1 vs 2) and within degree-2 we rank purely by bridge
  count. (A stake-weighted score was explicitly rejected.)
- **Self/loop exclusion** is explicit (viewer and direct follows removed) so a mutual-follow
  doesn't masquerade as a FoaF.

---

## 10. Performance & cost

- **+1 GraphQL round-trip on cold start**, chained after the 1-hop circle; **~0 in steady
  state** (cache). No N+1 — the `_in` query collapses the fan-out into one request.
- **Payload:** ≤2000 rows of `{account_id, object{label,data}}` — small.
- **Compute:** O(rows) grouping into a map; trivial.
- **Memory/state:** one extra `snap_manageState` entry per viewer; FoaF sets are larger than
  1-hop but bounded by the query limit.

---

## 11. Rollout phases

| Phase | Deliverable | Surfaces? |
|---|---|---|
| **1 — Plumbing + familiarity** ✅ **DONE** | `getExtendedNetworkQuery`, `getExtendedNetwork`, `indexExtendedNetwork`, cache, types, `EXTENDED_NETWORK_ENABLED` flag (now **on**). Wired into `onTransaction`; degree-2 **familiarity** computed via the extended index threaded into `getNetworkFamiliarity` and rendered as a **separate "Extended Network" subsection** inside a new standalone `renderNetworkInsight` block (the legacy account card that hosted familiarity is hidden, so this also revives the 1-hop "Also Familiar" block). | Context only; no safety gating change. |
| **2 — Soft-lane 2nd-degree** ✅ **DONE** | `degree`/`via` on `SafetyAuthor` + `fromExtendedNetwork` on `SafetySignal` (`safety/types.ts`); `buildAuthors` takes an `extendedIndex` and tags non-whitelist/non-1-hop authors reachable by ≥ `MIN_BRIDGES` follows as `{ degree: 2, via }` (stake never read); the `MIN_BRIDGES` soft-lane gate is authored **inside** the existing `DEV-GATE-DISABLED` block (`if (!fromTrustCircle && !fromExtendedNetwork)`) so 1-hop + 2-hop flip together; hard/critical lane explicitly excludes degree-2 from un-suppressing/escalating; `extendedIndex` wired through `onTransaction` → `getSafetyData`; `Safety.tsx` renders a **separate "Extended Network Flags · 2nd-degree"** soft block below the 1st-degree warnings (never in the critical banner) and a separate 2nd-degree provenance block, both with bridge-count copy ("via N of your follows"). | 2nd-degree soft warnings (gated by `MIN_BRIDGES`), labeled, in their own block. |
| **3 — Tuning** | Telemetry-informed tweaks to `MIN_BRIDGES`/TTL; optional extended-overlap count row on the trust triple; optional weighted score. | Refinements. |

Each phase is independently shippable behind `EXTENDED_NETWORK_ENABLED`.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Sign-time latency** (extra round-trip) | Cache + cold-start single query; Phase 1 can fetch non-blocking and attach only to familiarity. |
| **Sybil / spam via 2-hop** | `MIN_BRIDGES ≥ 2`, degree-2 never gates critical, bridge-count ranking. |
| **Implying direct endorsement** | Bridge-aware attribution copy ("via …", "accounts your follows trust"); strict visual hierarchy below 1st-degree. |
| **Cache incoherence** (stale seeds) | Tie extended cache validity to the 1-hop `timestamp` it was derived from; clear together. |
| **Re-enabling dev gates forgets 2-hop** | Author the 2-hop gate *inside* the same `DEV-GATE-DISABLED` block so 1-hop + 2-hop flip together. |

---

## 13. Resolved decisions & remaining open questions

**Resolved (this revision):**
- **Stake is ignored** everywhere in the 2-hop layer — bridge count is the only heuristic. ✅
- **`MIN_BRIDGES = 2` applies to ALL degree-2 surfaces**, familiarity included — no
  threshold-free 2-hop tier. ✅
- **2-hop renders in its own section**, never mixed with 1st-degree. ✅
- **Seeds are the viewer's follows only** — never expanded off whitelisted authorities. ✅

**Still open:**
- Do we ever want an **extended-overlap count** on the trust triple itself ("12 in your extended
  network trust this"), or keep 2-hop out of the FOR/AGAINST overlap entirely? (Phase 3.)
- TTL: keep 2-hop at 1h, or shorten since it depends on third parties' activity?
- 3-hop — explicitly out of scope forever, or a future `TrustDegree = 3`?

---

## 14. Test plan (high level)

- **Unit (`getExtendedNetwork`):** empty circle ⇒ `[]`; viewer + direct follows excluded;
  multi-bridge dedup increments `via`; ENS vs hex address extraction; seed cap honored.
- **Unit (`buildAuthors`):** degree-2-only author ⇒ `fromExtendedNetwork`, `degree: 2`, not
  `fromTrustCircle`/`fromWhitelist`; soft gate respects `MIN_BRIDGES`; degree-2 never lands in
  `critical`.
- **Cache:** version mismatch ⇒ miss; stale-vs-1-hop ⇒ miss; clear-together.
- **Integration (`onTransaction`):** flag off ⇒ identical to today; flag on ⇒ degree-2 rows only
  in their labeled sections, no change to critical/whitelist behavior.

---

*Related: `docs/claim-surface-spec.md` (§2, §5, §9 FoaF), `docs/patterns/TRUST-CIRCLE.md`,
`docs/patterns/ENS-HANDLING.md`, `docs/trust-light-system.md`. Code:
`packages/snap/src/trusted-circle/`, `packages/snap/src/safety/service.ts`,
`packages/snap/src/queries.ts`, `packages/snap/src/onTransaction.tsx`, `packages/snap/src/config.ts`.*

*Last updated: May 30, 2026*
