# Architecture Decision Records

This file logs important architectural decisions with rationale.

---

## 2026-05-30: Trust circle migrated to the `[I] → [follow] → [target]` pattern

**Context**: The Snap built the user's trust circle from `[X] → [hasTag] → [trustworthy]`
triples — i.e. "accounts the user staked FOR as *trustworthy*" — and read the trusted
contact from the triple's **subject**. This diverged from the canonical Hive Mind pattern
(`[I] → [follow] → [target]`) already used by the browser extension and explorer, so the
Snap's "trust circle" was a different set of people than everywhere else in the product.
This also meant follow-gated safety signals (soft `has tag` flags) never surfaced for
accounts the user actually follows.

**Decision**: Build the trust circle from `[I] → [follow] → [target]` triples — the
accounts the user follows. The followed account is the triple's **object**; the staker is
identified by the position's `account_id` (the subject is always the shared `I` atom).

**Changes**:
- `config.ts`: added `followAtomId`
  (`0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260`) and `iAtomId`
  (`0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b`) to `ChainConfig`
  and both chain configs (content-addressed, identical across testnet/mainnet).
- `queries.ts` (`getUserTrustedCircleQuery`): filter positions by `subject_id = iAtomId` +
  `predicate_id = followAtomId`, return each triple's `object` instead of `subject`.
- `trusted-circle/service.ts` (`fetchTrustedCircleFromAPI`): pass `{ subjectId: iAtomId,
  predicateId: followAtomId }` and read the followed account from `triple.object`.

**Scope / non-changes**:
- The `has tag → trustworthy` triple is still read in `account.tsx` / `origin.tsx` to display
  a **target's** trustworthiness market (the TrustStatsBlock) — that is a separate signal from
  the viewer's circle and was intentionally left unchanged.
- `getNetworkFamiliarity` still excludes the target's `has tag → trustworthy` triple to
  de-dup against the displayed trust signal — still correct.
- `safety/service.ts` builds its `trustMap` from the passed-in circle, so it inherited the
  fix automatically.

**Migration note**: The trusted-circle cache (`trusted-circle/cache.ts`, `snap_manageState`,
1-hour TTL) value shape is unchanged, but entries computed under the old model can linger for
up to the TTL. Reinstall the Snap or call `clearTrustedCircleCache()` to force a fresh circle.

**Docs updated**: `patterns/TRUST-CIRCLE.md` (full rewrite), `patterns/GRAPHQL-PATTERNS.md`,
`patterns/ENS-HANDLING.md`, `intuition/GLOBAL.md`, `products/SNAP.md`, `claim-surface-spec.md`.

---

## 2026-05-29: Safety read surface (critical reports / soft flags / provenance)

**Context**: The Snap previously fetched the claim-template registry only to warm
its cache (`getClaimTemplates()` result was discarded) and rendered only the
trust triple + trust-circle signals. The safety/identity vocabulary that exists
in the graph (`reported for → Scam/Drainer/…`, `has tag → suspicious/malicious`,
`created by`/`audited by`/`same as`) was never surfaced at sign-time. See
`docs/claim-surface-spec.md` §3–§5.

**Decision**: Add a safety read surface that consumes the registry and renders a
classified safety block **above all existing insight sections** in
`onTransaction`.

**Changes**:
- `safety/` module (`types.ts`, `service.ts`, `index.ts`): fetches safety +
  provenance triples about the destination atom (`getSafetyClaimsAboutAtomQuery`)
  and classifies them into three lanes — **critical** (hard `reported for` from a
  whitelisted authority), **warnings** (trust-circle-gated soft flags +
  non-critical hard reports), **provenance** (created/audited/evaluated/same-as).
- `publisher-whitelist/` module (service + cache + types, mirrors
  `feature-config`): hydrates the authority allow-list from
  `GET /atoms/publisher-whitelist`, falls back to an empty whitelist.
- `components/Safety.tsx` + `renderSafetyInsight()`: rendered first in the
  `onTransaction` `Box`, above account/origin/footer.
- `onTransaction.tsx`: captures the registry (no longer discarded), fetches the
  whitelist in the same `Promise.all`, computes safety after the account atom
  resolves, threads `safety` onto `AccountProps`.
- `config.ts`: added `SAFETY_PREDICATE_IDS` / `SAFETY_OBJECT_IDS` (content-
  addressed, chain-independent) as the offline fallback vocabulary; `claim-
  templates/service.ts` `buildDefaults()` now carries them.

**Rationale**:
1. **Safety overrides reputation** — a whitelisted-authority `reported for Drainer`
   surfaces at the very top regardless of trust-circle overlap.
2. **Trust-circle-first, anonymous suppressed** — soft flags require trust-circle
   overlap; anonymous claims are not shown at sign-time (reachable via Explorer).
3. **API as authority, offline-safe** — predicate/object term IDs resolve from the
   live registry, falling back to chain-independent constants so the surface keeps
   working when the API is down.
4. **Non-destructive** — the new block is placed strictly above existing UI; no
   existing sections were changed.

**`Banner` note**: `@metamask/snaps-sdk@6.10.0` does not export `Banner`, so
critical reports render as an error-variant `Section`/`Row` instead.

---

## 2026-01-24: Origin CTA for Unknown dApps

**Context**: When a user encounters an unknown dApp (no atom exists in the knowledge graph), the Snap displayed a warning but provided no way to add the dApp to the knowledge graph. This created a chicken-and-egg problem where unknown dApps stayed unknown forever.

**Decision**: Add a new CTA "Add this dApp to knowledge graph" for unknown dApps (OriginType.NoAtom state).

**Changes**:
- Added `originNoAtom` method to `VendorConfig` type and implementation
- Created `OriginCreateAtom.tsx` action component
- Updated `UnifiedFooter.tsx` to show origin CTAs for NoAtom state
- Updated `OriginFooter/index.tsx` to support NoAtom state

**Rationale**: 
1. Users encountering unknown dApps are in the best position to vouch for them (they're actively using the dApp)
2. Growing the knowledge graph requires enabling data creation, not just consumption
3. The warning still exists, so users are informed—but now they can also take action

**URL Pattern**: `/snap/action?intent=complete_trust_triple&origin_url={hostname}`

---

## 2026-01-24: Inline CTAs in Origin Section

**Context**: The Origin section displayed state information (unknown, no votes, trusted) but action CTAs were buried in the footer, disconnected from context. This made the CTAs feel like an afterthought and didn't clearly connect "missing data" with "add data".

**Decision**: Move origin-related action CTAs inline within the Origin section component, directly below the status information.

**Changes**:
- `OriginNoAtom`: Added inline CTA "Be first to add trust data for this dApp ↗"
- `OriginAtomWithoutTrustTriple`: Added inline CTA "Be first to vote on this dApp ↗"
- `OriginAtomWithTrustTriple`: Added inline CTA "Vote on this dApp ↗"
- `UnifiedFooter`: Removed redundant origin voting CTAs (kept only "View more about this dApp")

**Rationale**:
1. Contextual CTAs are more effective than disconnected footer links
2. Users see the problem (no data) and solution (add data) in the same visual area
3. Reduces clutter in the footer
4. Creates clear information hierarchy: Status → Action

**Before**:
```
┌─────────────────────────────┐
│ dApp Origin                 │
│ Status: Unknown dApp        │
│ No community data.          │
└─────────────────────────────┘
... (footer far below) ...
[Add this dApp to knowledge graph]
```

**After**:
```
┌─────────────────────────────┐
│ dApp Origin                 │
│ Status: Unknown dApp        │
│ No community data.          │
│ [Be first to add trust...↗] │
└─────────────────────────────┘
```

---
