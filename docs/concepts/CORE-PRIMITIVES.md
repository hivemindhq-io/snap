# Core Primitives

> **Purpose**: Understand the fundamental building blocks of the Intuition protocol.

---

## Overview

Intuition is built on five core primitives:

```
Atom → Triple → Term → Vault → Position
```

- **Atoms** represent entities (people, orgs, URLs, concepts)
- **Triples** are claims linking atoms (Subject → Predicate → Object)
- **Terms** unify atoms and triples (vaults attach to terms)
- **Vaults** hold staked TRUST tokens with bonding curve pricing
- **Positions** track individual user stakes in vaults

---

## Atoms

An **atom** is the fundamental unit of knowledge. It represents a single entity or concept.

### Properties

| Property | Description |
|----------|-------------|
| `term_id` | Unique identifier, derived from `keccak256(ATOM_SALT, data)` |
| `data` | Raw content (JSON-LD, plain text, address, URL) |
| `label` | Human-readable display name |
| `image` | Optional image URL (supports IPFS) |
| `type` | Category: Account, Person, Organization, Thing, URL |
| `creator_id` | Address of the creator |

### Atom Types

| Type | Example Data | Resolved Label |
|------|--------------|----------------|
| Account | `0xd8da6bf26964...` | `vitalik.eth` (via ENS) |
| Person | `{"@type":"Person","name":"Alice"}` | `Alice` |
| Organization | `{"@type":"Organization","name":"Acme"}` | `Acme` |
| URL | `https://example.com` | `example.com` |
| Thing | `{"@type":"Thing","name":"trustworthy"}` | `trustworthy` |

### ID Calculation

```solidity
atomId = keccak256(abi.encodePacked(ATOM_SALT, data));
```

Identical data → identical term_id. This prevents duplicates.

---

## Triples

A **triple** is a semantic claim linking three atoms: `Subject → Predicate → Object`

### Examples

```
"vitalik.eth" → "has tag" → "trustworthy"
"0xABC..."    → "works at" → "Ethereum Foundation"
"Wikipedia"  → "has tag" → "reliable source"
```

### Properties

| Property | Description |
|----------|-------------|
| `term_id` | Unique identifier for the triple |
| `subject_id` | Reference to the subject atom |
| `predicate_id` | Reference to the predicate atom |
| `object_id` | Reference to the object atom |
| `counter_term_id` | ID of the opposing vault (AGAINST) |
| `creator_id` | Address of the creator |

### ID Calculation

```solidity
tripleId = keccak256(abi.encodePacked(TRIPLE_SALT, subjectId, predicateId, objectId));
counterTripleId = keccak256(abi.encodePacked(COUNTER_SALT, tripleId));
```

### Dual Vault System

Every triple creates **two vaults**:

| Vault | Purpose | Stake Here To |
|-------|---------|---------------|
| Support vault (`term_id`) | FOR the claim | Express agreement |
| Counter vault (`counter_term_id`) | AGAINST the claim | Express disagreement |

---

## The Term Abstraction

A **term** is a unified representation that can be either an atom or a triple.

### Why Terms Exist

Vaults and positions attach to **terms**, not directly to atoms or triples. This enables:

1. Unified queries across both entity types
2. Consistent vault mechanics
3. Simplified position tracking

### Relationship Diagram

```
Position → Term → Atom    (if term.type = 'atom')
                → Triple  (if term.type = 'triple')
```

### Database Structure

```sql
CREATE TABLE term (
    id NUMERIC(78,0) PRIMARY KEY,
    type term_type NOT NULL,  -- 'atom' or 'triple'
    atom_id NUMERIC(78,0),    -- Set if type = 'atom'
    triple_id NUMERIC(78,0),  -- Set if type = 'triple'
    total_assets NUMERIC(78,0),
    total_market_cap NUMERIC(78,0)
);
```

### Critical Pattern

When querying positions, navigate through `term`:

```graphql
# ❌ WRONG - positions don't have triple field
positions(where: { triple: { ... } })

# ✅ CORRECT - go through term
positions(where: { term: { triple: { ... } } })
```

---

## Vaults

A **vault** is an economic container holding staked TRUST tokens.

### Properties

| Property | Description |
|----------|-------------|
| `term_id` | The atom or triple this vault is for |
| `curve_id` | Bonding curve formula. `1` is the default *write* target; multiple curves can exist per term, so reads must aggregate across them |
| `total_shares` | Total shares issued *(per curve — not cross-curve comparable)* |
| `current_share_price` | Current price per share *(per curve — pick the linear vault for representative display)* |
| `market_cap` | Total value locked *(per curve — sum across rows for a term-level headline)* |
| `position_count` | Open positions *(per curve — sum across rows for a term-level total)* |

### Bonding Curve

Vaults use bonding curves for dynamic pricing:

- **Deposit**: User deposits TRUST → curve calculates shares → shares minted → price increases
- **Redeem**: User burns shares → TRUST returned (minus fees) → price decreases

Early stakers get more shares per TRUST. Later stakers pay higher prices.

### Default Curve

The linear curve (`curve_id = 1`) is the default **write** target for the
current UI — `deposit` / `redeem` calls pin `curveId = 1n` until the UI
supports per-curve staking.

**Reads must aggregate across all curves.** A single term can have multiple
vault rows (one per curve), and any user can stake on any curve. Filtering
reads by `curve_id = 1` silently drops every curve-2+ position and produces
incorrect market caps and staker counts. Use `vaults_aggregate` for headlines
and the `term-stats` helpers for per-row consumers. See
[../patterns/GRAPHQL-PATTERNS.md](../patterns/GRAPHQL-PATTERNS.md) and
[../patterns/CONTRACT-PATTERNS.md](../patterns/CONTRACT-PATTERNS.md).

---

## Positions

A **position** represents a user's stake in a vault.

### Properties

| Field | Description |
|-------|-------------|
| `account_id` | User's wallet address |
| `term_id` | The vault (atom or triple term) |
| `curve_id` | Bonding curve ID. Writes target `1` today; positions on curves > 1 exist in the wild and must be counted by reads |
| `shares` | Number of shares owned |

### Calculating Value

```typescript
positionValue = (shares * currentSharePrice) / 1e18n;
```

---

## Economic Model

### Fee Structure

| Fee Type | Purpose | Recipient |
|----------|---------|-----------|
| Atom creation fee | Prevent spam | Protocol treasury |
| Triple creation fee | Prevent spam | Protocol treasury |
| Entry fee | Share of deposit | Existing stakers |
| Exit fee | Cost of redemption | Protocol + remaining stakers |

### TRUST Token

TRUST is the native token with four functions:

1. **Data creation fees** — Creating atoms/triples
2. **Staking and signaling** — Expressing belief
3. **Governance** — Voting on protocol changes
4. **Node operation** — Running indexers requires stake

---

## System Invariants

These are always true in the Intuition protocol:

1. `term_id` is deterministic: same data → same term_id
2. Every triple has exactly one `counter_term_id` (never null)
3. Positions are always associated with terms, never directly with atoms/triples
4. `curve_id = 1` is the default **write** target; reads must aggregate across all curves
5. All monetary values are in wei (18 decimals)
6. Shares are stored as bigint (string in GraphQL responses)

---

*See also: [ARCHITECTURE.md](./ARCHITECTURE.md) for system flow*

*Last updated: January 21, 2026*
