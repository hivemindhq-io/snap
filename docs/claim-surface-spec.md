# Claim Surface Spec — Snap (read) vs Extension (write)

> **Status:** Proposed · **Owner:** Kylan · **Ontology dependency:** Kryptoremontier
> **Scope:** Which claim types the MetaMask Snap *surfaces* during signing for EOAs vs.
> smart contracts, and which claim templates the Hive Mind extension lets users *create*.

---

## TL;DR (the decisions)

1. **EOA and contract claims are NOT the same — in either product.** They are different
   threat models with different vocabularies. They share a spine (a soft "flag" lane +
   trust-circle overlap + the existing trust light), but the `reported for` vocabulary and
   the contract-only provenance section differ.

2. **Two safety lanes, by certainty:**
   - **Soft / early lane → `has tag → suspicious | malicious`.** Low bar, anyone can
     author, *trust-gated* at display time (Snap only shows these when they come from your
     trust circle, a friend-of-a-friend, or a whitelisted publisher). **Decision (2026-05-29):
     stay on the existing `has tag` predicate for now**, with the understanding that we'll
     likely migrate the soft lane to a dedicated `flagged as` predicate later. See [§2](#2-the-two-safety-lanes).
   - **Hard / categorical lane → `reported for → {Scam, Phishing/Drainer, Sybil, Honeypot,
     Exploit, Injection, Spam}`.** Higher bar, attributed, publisher-whitelist weighted.

3. **The extension's "Create Claim" tiles stay broad.** Do **not** limit them to safety.
   The extension is the *write surface that builds the trust graph* — `follow`, `trustedFor`,
   and curation tags (`bullish`, `insightful`, `knowledgeable`, …) are the whole reason users
   curate EOAs in the first place, and that graph is exactly what powers the Snap's
   "your trust circle says ___" signals. The Snap reads a **narrow safety/identity subset**
   of what the extension can write. **This read/write asymmetry is intentional and correct.**

4. **Snap rendering is trust-circle-first** for reputational signals, with one override:
   a critical `reported for` report from a **whitelisted authority** surfaces at the top as
   a hard warning regardless of trust-circle overlap. Aggregate consensus / absolute numbers
   are de-emphasized (context, not headline).

5. **The full hard + soft vocabulary is already live on mainnet** (verified 2026-05-29 via
   GraphQL; see [§7 Ontology dependencies](#7-ontology-dependencies)). The hard-lane objects
   once listed as "needs minting" — `Phishing`, `Drainer`, `Honeypot`, `Exploit`, `Sybil`,
   `Bot` — all exist, alongside `has tag`, `trustworthy`, `malicious`, `suspicious`,
   `scammer`, `bot`, `impersonation`, `Scam`, `Spam`, `Injection`, `reported for`, `follow`,
   `vouch for`, `same as`, `audited by`, `evaluated by`, `created by`. (A future `flagged as`
   predicate is the only net-new predicate, deferred.)

6. **The single source of truth is `hivemind-api`** — see
   [§10 API authority architecture](#10-api-authority-architecture). The structured tile set is
   now served from `GET /atoms/claim-templates`; the extension and snap load it at start-up and
   fall back to their bundled defaults only when the API is down.

---

## 1. Principles

| Principle | Why |
|---|---|
| **Read ⊂ Write** | The extension writes a rich curation vocabulary; the Snap reads a narrow, safety-and-identity slice of it. Never gate the write surface to what the Snap renders. |
| **Trust-circle-first** | "3 people you follow flagged this" beats "47 anonymous stakers." Absolute numbers are de-emphasized context. |
| **Entity-type specificity** | A drainer report on `vitalik.eth` is jarring; a `Follow` tile on a Uniswap router is nonsense. Tailor by EOA vs contract. |
| **Two-dimensional certainty** | Separate *who's saying it* (authority → trust circle → FoaF → anonymous) from *how hard the claim is* (soft `flagged as` → hard `reported for`). |
| **Safety overrides reputation** | A whitelisted-authority `reported for Drainer` is shown even with zero trust-circle overlap. |

---

## 2. The two safety lanes

```
SOFT  (early signal, low bar)          HARD (categorical, high bar)
────────────────────────────          ─────────────────────────────
[subject] has tag suspicious           [subject] reported for Scam
[subject] has tag malicious            [subject] reported for Drainer
                                       [subject] reported for Sybil
  • anyone can author                    • anyone can author …
  • TRUST-GATED at display               • … but only WHITELISTED or
    (only shown from trust circle,         TRUST-CIRCLE authors are
     FoaF, or whitelisted author)          surfaced at sign-time
  • renders as ⚠️ caution                • renders as 🔴 warning w/ attribution
```

**Decision (2026-05-29): use the existing `has tag` predicate for the soft lane now; migrate
to a dedicated `flagged as` predicate later.** Both `suspicious` (`0x3af7…f843`) and `malicious`
(`0x36ff…453`) **already exist** as universal-claim-tag object atoms on mainnet, so the soft lane
ships with zero new mints. The eventual `flagged as` migration is tracked but deferred.

**Why we'll *eventually* want `flagged as` (a dedicated predicate):**

- Reads as a warning, not a descriptor (`flagged as suspicious` vs `has tag suspicious`).
- Keeps safety **verdicts** out of the generic `has tag` descriptor bucket (where `bullish`,
  `DeFi Protocol`, `funny` live), so neither product accidentally renders a safety flag as a
  neutral chip or vice-versa.
- Future-proof: a new soft label is just a new **object** atom under `flagged as`; any consumer
  filtering by the predicate picks it up automatically.
- The migration is purely a predicate swap — the same `suspicious` / `malicious` **object** atoms
  carry over, preserving the "universal tag" convention at the object level.

**Consumer-side gating in the meantime:** because the soft lane shares the `has tag` predicate with
neutral descriptors, the Snap distinguishes safety flags by **object atom** (an allow-list of
safety objects: `suspicious`, `malicious`, `scammer`, `bot`) rather than by predicate. The
`hivemind-api` registry already classifies these as `universal_claim_tag`; the safety subset is a
small consumer-side set until `flagged as` lands.

---

## 3. Snap read surface — Smart Contract (CAIP-10)

Contracts are infra-flavored. The questions a signer needs answered: *what is this, who deployed/
audited it, and is it dangerous?*

| Section | Predicate → Object | Lane | Source gating | Live? |
|---|---|---|---|---|
| **Hard reports** | `reported for → Scam` | hard | whitelist + trust circle | ✅ |
| | `reported for → Phishing/Drainer` | hard | whitelist + trust circle | ✅ |
| | `reported for → Honeypot` | hard | whitelist + trust circle | ✅ |
| | `reported for → Exploit` | hard | whitelist + trust circle | ✅ |
| | `reported for → Injection` | hard | whitelist + trust circle | ✅ |
| | `reported for → Spam` | hard | whitelist + trust circle | ✅ |
| **Soft flags** | `has tag → suspicious` | soft | trust circle / FoaF only | ✅ |
| | `has tag → malicious` | soft | trust circle / FoaF only | ✅ |
| **Provenance** | `created by → [deployer]` | identity | whitelist + trust circle | ✅ |
| | `audited by → [auditor]` | identity | whitelist + trust circle | ✅ |
| | `verified by → [Etherscan/Sourcify]` | identity | whitelist | ⛔ mint predicate |
| | `evaluated by → [curator]` | identity | trust circle | ✅ |
| **Positive consensus** | `has tag → trustworthy` + trust light | aggregate | distribution analysis | ✅ |
| **Trust-circle overlap** | any claim authored by people you follow | trust circle | — | ✅ (network familiarity) |

**Not shown for contracts:** `Follow`, `vouch for`, `Sybil` (a contract isn't a bot/person).

---

## 4. Snap read surface — EOA / Smart Account

EOAs are person-flavored. The questions: *who is this, do people I trust vouch for or warn about
them, and are they a known bad actor?*

| Section | Predicate → Object | Lane | Source gating | Live? |
|---|---|---|---|---|
| **Hard reports** | `reported for → Scam` | hard | whitelist + trust circle | ✅ |
| | `reported for → Phishing/Drainer` | hard | whitelist + trust circle | ✅ |
| | `reported for → Sybil/Bot` | hard | whitelist + trust circle | ✅ |
| | `reported for → Impersonation` | hard | whitelist + trust circle | ✅ (object; surfaced via soft `has tag`) |
| | `reported for → Spam` | hard | whitelist + trust circle | ✅ |
| **Soft flags** | `has tag → suspicious` | soft | trust circle / FoaF only | ✅ |
| | `has tag → malicious` | soft | trust circle / FoaF only | ✅ |
| **Identity** | `same as → [linked identity]` | identity | trust circle + whitelist | ✅ |
| | alias / ENS | identity | protocol | ✅ |
| **Reputation** | `follow` overlap ("N people you follow follow this") | trust circle | — | ⛔ depends on follow-based circle |
| | `vouch for` from trust circle | trust circle | trust circle | ✅ |
| | `has tag → trustworthy` + trust light | aggregate | distribution analysis | ✅ |

**Not shown for EOAs:** `Honeypot`, `Injection`, `Exploit`, `audited by`, `verified by`,
`created by` (contract code attributes). Use the broad soft `flagged as malicious` instead of a
contract-only report when in doubt.

### Shared spine (both entity types)
- Your own prior position (strongest signal).
- Trust-circle overlap + network familiarity (`trusted-circle/service.ts`).
- The composite trust light (`docs/trust-light-system.md`) on whatever consensus market exists.

---

## 5. Snap rendering priority

Render top-to-bottom; stop elevating once a hard warning fires.

1. **🔴 Critical authority report** — `reported for {Scam, Drainer, Honeypot, Exploit, Sybil}` from
   a **whitelisted publisher**. Shown at the very top as a hard warning *regardless* of trust-circle
   overlap. Safety overrides reputation.
2. **Your own position** — "You already staked FOR/AGAINST this."
3. **Trust-circle signals** — follow overlap, trust-circle-authored `flagged as` / `reported for`
   (attributed: "alice.eth flagged this as suspicious"), trust-circle `trustworthy`/`vouch`.
4. **Friend-of-a-friend** (one hop) — same signals, lower weight, labeled as 2nd-degree.
5. **Aggregate consensus + trust light** — de-emphasized context (the % and distribution health),
   not the headline.
6. **Anonymous community claims** — **suppressed at sign-time.** Reachable only via the
   "View more about this address ↗" deep link into the Explorer.

> This is the concrete expression of "absolute numbers get less prominence in lieu of
> *your trust circle says ___*."

---

## 6. Extension write surface (`hivemind-extension`)

**Keep it broad. Do not limit to safety.** Recommended tile sets per entity (file:
`src/config/potential-triples/config.ts`). New/changed items in **bold**.

### EOA (`evm-address`)
| Group | Tiles |
|---|---|
| **Hero** | `Follow` (the trust-graph primitive — populates trust circles) |
| Reputation | `Vouch For`, `Trustworthy` |
| **Expertise** | **`trustedFor → [topic]`** (search input — DeFi, prediction markets, NFTs, …) — canonical topic-scoped trust primitive that feeds *topic* trust circles. Lighter alt: `has tag → knowledgeable / insightful / bullish`. |
| **Safety (soft)** | **`flagged as → suspicious`**, **`flagged as → malicious`** (replaces `has tag malicious` here) |
| Safety (hard) | `reported for → Scam`, **`Phishing/Drainer`**, **`Sybil`** |
| Identity | `Same As` |
| Fallback | `Add Tag` (custom) |

### Smart Contract (`caip10-address`)
| Group | Tiles |
|---|---|
| Positive | `Trustworthy`, `Bullish` |
| Provenance | `Created By`, `Audited By`, `Verified By`, `Evaluated By` |
| **Safety (soft)** | **`flagged as → suspicious`**, **`flagged as → malicious`** (replaces `has tag malicious` here) |
| Safety (hard) | `reported for → Scam`, `Injection`, **`Honeypot`**, **`Exploit`**, `Spam` |
| Fallback | `Add Tag` (custom) |

### Social profile (`x-profile` / `social-profile`)
Keep the existing rich vocabulary as-is — `credible`, `newsbreaker`, `funny`, `uplifting`,
`interesting`, `bullish`, `insightful`, `investigative`, `misleading`, `biased`, `plagiarist`,
`grifter`, `ai-slop`, `clickbait`, `unpleasant`, `custom`. This is the curation product; it should
stay expressive. The Snap never reads social-profile claims at sign-time.

> **Answering the direct question:** yes — embrace `bullish` / `knowledgeable` on EOAs. EOAs are
> *who Hive Mind users follow for curator insights*, so the extension needs the full reputational
> vocabulary. The Snap simply doesn't surface those at sign-time; it reads the safety/identity
> subset. The two surfaces are decoupled on purpose.

---

## 7. Ontology dependencies

**Already live on mainnet** (verified 2026-05-29; no action). Predicates: `has tag`,
`reported for` (`0x51f1…428d`), `follow`, `same as` (`0xbeeb…5f0`), `audited by`
(`0xe0d5…bc2`), `evaluated by` (`0xb769…226`), `created by` (`0x9116…b15`), `vouch for`
(`0x2bf2…166`). Objects: `trustworthy`, `malicious` (`0x36ff…453`), `suspicious`
(`0x3af7…f843`), `scammer` (`0x813f…bbde`), `bot` (`0xa5ef…603a`), `impersonation`
(`0x5749…b191`), `Scam` (`0x27f3…39ba`), `Spam` (`0x6ae6…e78f`), `Injection`
(`0x8e76…887a`), `Phishing` (`0x17ea…e00b`), `Drainer` (`0xb695…6529`), `Honeypot`
(`0xfe83…9e26`), `Exploit` (`0x21d9…ef7d`), `Sybil` (`0xc16b…1bea`), `Bot` (`0x5f44…e726`),
`I`.

All term IDs are mirrored in `hivemind-api/config/claim-templates.json` (`predicates` /
`objects`) and, as the snap's offline fallback, in `intuition-snap/packages/snap/src/config.ts`
(`SAFETY_PREDICATE_IDS` / `SAFETY_OBJECT_IDS`).

**Still outstanding (coordination with Kryptoremontier):**

| Atom | Kind | Used by | Priority |
|---|---|---|---|
| `verified by` | predicate | provenance (contract) | P2 |
| `flagged as` | predicate | soft-lane migration (off `has tag`) | **Deferred** |

The soft lane ships on `has tag` with the already-live `suspicious` / `malicious` / `scammer` /
`bot` / `impersonation` objects — no mint required. The hard lane uses `reported for` with the
already-live categorical objects above.

**Publisher whitelist:** served from `GET /atoms/publisher-whitelist`
(`hivemind-api/config/publisher-whitelist.json` + `PublisherWhitelistService`). The snap
hydrates it via `publisher-whitelist/` and falls back to an empty whitelist (trust-circle-only
gating) when the API is down. Seed it with authority addresses (ScamSniffer, AgentScore, …),
then `POST …/invalidate`.

**Source of truth for IDs:** `hivemind-api`. Two distinct endpoints:
- `GET /atoms/atom-registry` — flat *classification* (`infrastructure` / `predicate` / `featured` /
  `hidden` / `universal_claim_tag`); used by discovery-feed filtering.
- `GET /atoms/claim-templates` — the structured, entity-aware tile set (subject→predicate→object
  with `atomRef` term-ID maps). **This is the authority for both the extension's tiles and the
  snap's safety-predicate resolution.** See [§10](#10-api-authority-architecture).

When new atoms are minted, add their term IDs to `config/claim-templates.json` (and, if they're
reusable tags, `config/atom-registry.json`), then `POST …/invalidate`.

---

## 8. Implementation dependencies (Snap side)

1. **Resolve term IDs from the registry, not `ChainConfig`.** ✅ *Done.* The snap loads
   `GET /atoms/claim-templates` via `claim-templates/` (fetch → `snap_manageState` cache →
   offline fallback) and the **safety read surface now consumes** `registry.predicates` /
   `registry.objects` (`reportedFor`, `malicious`, `suspicious`, `phishing`, …) in
   `safety/service.ts`, falling back to `SAFETY_PREDICATE_IDS` / `SAFETY_OBJECT_IDS` in
   `config.ts` (content-addressed, chain-independent) when the registry is unavailable. The
   trustworthiness display triple (`has tag → trustworthy`, used to show a target's trust market —
   distinct from the follow-based trust circle) still reads `chainConfig` directly — those IDs
   are identical to the registry values, so no behavioral difference.
2. **Follow-based trust circle.** ✅ *Done (2026-05-30).* The trust circle is now
   defined by `I → follow → [person]` (matching the extension + explorer), not the legacy
   `has tag → trustworthy`. `trusted-circle/service.ts` and `getUserTrustedCircleQuery` filter
   positions to the viewer's `account_id` on `[I] → [follow] → [target]` triples and read the
   followed account from the triple's **object** (`config.ts` exposes `iAtomId` / `followAtomId`).
   This is the foundation for the EOA "follow overlap" reputation row.
3. **New queries** (`packages/snap/src/queries.ts`): fetch `flagged as` and `reported for` triples
   about the subject, with positions, so they can be cross-referenced against the trust circle and
   the publisher whitelist.
4. **Publisher whitelist.** ✅ *Done.* A configured allow-list of authority accounts (AgentScore,
   ScamSniffer, etc.) whose hard reports surface globally. Served from
   `GET /atoms/publisher-whitelist` and hydrated by the snap's `publisher-whitelist/` module
   (fetch → cache → empty fallback). The config currently ships **empty** — seed it with real
   authority addresses to activate global (non-trust-circle) report surfacing.
5. **Entity-aware rendering.** `getAccountType` already branches on `NoAtom /
   AtomWithoutTrustTriple / AtomWithTrustTriple`; add an EOA-vs-contract dimension
   (`classification.type` is already computed in `account.tsx`) to pick the §3 vs §4 surface.

---

## 9. Open questions

- `Phishing` vs `Drainer` as the canonical object label (or both, with `Drainer ⊂ Phishing`)?
- `Sybil` vs `Bot` — one atom or two?
- Do we want `Impersonation` for EOAs in v1, or fold it into `flagged as suspicious`?
- FoaF (2nd-degree) signals in v1, or trust-circle (1st-degree) only to start?
- Whitelist hydration cadence (static config vs. live `hivemind-api` fetch with cache).

---

## 10. API authority architecture

The structured claim-template set is owned centrally by `hivemind-api` and loaded by each product
at start-up, with the product's bundled config as the offline fallback. This is the
"directory of pre-selected claim types as the universal source of truth" pattern.

```
                       hivemind-api  (single source of truth)
                       ├─ config/claim-templates.json   ← structured tiles (authority)
                       │     GET /atoms/claim-templates
                       │     POST …/invalidate           (Redis 24h cache)
                       ├─ config/atom-registry.json      ← flat classification
                       │     GET /atoms/atom-registry
                       └─ config/claim-types.json        ← flat tag vocab (topic quick-claims)
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
   hivemind-extension     intuition-snap          hivemind-core
   useClaimTemplates()    claim-templates/        DEFAULT_ATOM_REGISTRY
     → installs ADDRESS     getClaimTemplates()     (shared fallback +
       overrides into         → snap_manageState      helpers; mirrors the
       potential-triples        cache → chainConfig    API JSON; now incl.
     fallback: bundled          fallback               universal_claim_tag)
       entityMappings
```

### What's now in place (this change set)

| Layer | Component | Role |
|---|---|---|
| **hivemind-api** | `GET /atoms/claim-templates` (+ `/invalidate`), `ClaimTemplateService`, `config/claim-templates.json` | **Authority** for structured tiles + snap safety vocab (objects map now carries the full hard+soft safety set) |
| | `GET /atoms/publisher-whitelist` (+ `/invalidate`), `PublisherWhitelistService`, `config/publisher-whitelist.json` | **New authority** for hard-report authority accounts |
| | `GET /atoms/atom-registry` (pre-existing) | classification authority |
| **hivemind-core** | `AtomCategory` + `DEFAULT_ATOM_REGISTRY` now include `universal_claim_tag` | heals drift; shared fallback parity |
| **hivemind-extension** | `useClaimTemplates()` → `installRemoteAddressMappings()` | fetches templates; overrides **address** tile sets; bundled `entityMappings` = fallback |
| | `config/potential-triples/remote.ts` | wire-format types + `atomRef`→term-ID resolver + runtime override store |
| | matcher `getActiveMappings()` | prefers remote address mappings, falls back to bundled |
| **intuition-snap** | `claim-templates/` (service + cache + types) | fetch → `snap_manageState` cache → `config.ts` `SAFETY_*` fallback (mirrors `feature-config`) |
| | `publisher-whitelist/` (service + cache + types) | fetch → cache → empty fallback (mirrors `feature-config`) |
| | `safety/` (service + types) + `components/Safety.tsx` | **consumes** registry + whitelist + trust circle; classifies critical/soft/provenance; rendered above existing sections |
| | `onTransaction` | captures the registry + whitelist (no longer discarded) and computes the safety surface |

### Design choices

- **Why a *new* `claim-templates` endpoint, not the existing `claim-types`?** `claim-types.json`
  is a *flat* tag vocabulary (`{label, termId, sentiment}`) for X/Farcaster topic quick-claims.
  The tile set needs structure the flat shape can't express: `subject→predicate→object` slots,
  entity-type/`addressKind` applicability, `disabled` state, icons. Overloading `claim-types`
  would have broken its consumers. They stay as siblings.
- **Why only ADDRESS tiles are overridden in the extension.** The matcher's social / GitHub /
  archetype paths are richly synchronous and entangled; forcing them through an async fetch would
  be invasive and risky. The address tiles (this spec's subject) are simple, so they're sourced
  remotely; everything else stays on the bundled config. The override is additive and reversible.
- **Fallback is always the bundled config**, never an empty state. If the API is unreachable both
  products behave exactly as before this change.
- **`atomRef` indirection.** Templates reference predicates/objects by name (`reportedFor`,
  `malicious`) resolved against the registry's `predicates` / `objects` maps. This keeps raw term
  IDs in one place per environment and lets a `fixed` slot with an unknown ref be dropped safely
  rather than submitting a malformed triple.

### Not yet migrated (intentional follow-ups)

- The extension still bundles term IDs in `config/intuition-*.ts` (`activeChain`) as the fallback;
  `claim-types.json`-style quick-claims and GitHub/archetype tiles are unchanged.
- ~~The snap fetches+caches the registry but the read surface doesn't consume it yet.~~ ✅ The
  snap's **safety read surface now consumes** `registry.predicates` / `registry.objects`
  (`safety/service.ts`); see §8.1.
- The publisher whitelist config ships **empty** — seed `config/publisher-whitelist.json` with real
  authority addresses + `POST …/invalidate` to activate global report surfacing.
- No admin UI for editing `claim-templates.json` / `publisher-whitelist.json` — edit +
  `POST …/invalidate`.
- The EOA "follow overlap" reputation row still depends on migrating the trust circle to
  `I → follow → [person]` (see §8.2); the safety surface ships independently of it.

---

*Related: `docs/products/SNAP.md`, `docs/products/EXTENSION.md`, `docs/trust-light-system.md`,
`docs/patterns/TRUST-CIRCLE.md`. Extension config: `hivemind-extension/src/config/potential-triples/config.ts`.
API authority: `hivemind-api/config/claim-templates.json`, `hivemind-api/app/Services/ClaimTemplateService.ts`.*
