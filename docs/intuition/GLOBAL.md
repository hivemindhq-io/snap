# Intuition Protocol & Hive Mind Ecosystem

## A Comprehensive Guide to the Decentralized Knowledge Graph

**Version:** 1.1
**Last Updated:** January 20, 2026
**Authors:** AI-assisted documentation from codebase analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part I: The Intuition Protocol](#part-i-the-intuition-protocol)
   - [Vision and Philosophy](#vision-and-philosophy)
   - [Core Primitives](#core-primitives)
   - [Economic Model](#economic-model)
   - [Smart Contract Architecture](#smart-contract-architecture)
3. [Part II: The TRUST Token](#part-ii-the-trust-token)
   - [Token Utility](#token-utility)
   - [Supply and Emissions](#supply-and-emissions)
   - [Staking Mechanics](#staking-mechanics)
   - [Bonding Curves](#bonding-curves)
4. [Part III: Technical Architecture](#part-iii-technical-architecture)
   - [Data Layer](#data-layer)
   - [Backend Services](#backend-services)
   - [GraphQL API](#graphql-api)
   - [Identity Resolution](#identity-resolution)
5. [Part IV: The Hive Mind Products](#part-iv-the-hive-mind-products)
   - [Hive Mind Explorer](#hive-mind-explorer)
   - [Hive Mind Extension](#hive-mind-extension)
   - [Intuition Snap](#intuition-snap)
6. [Part V: Workspace Projects Deep Dive](#part-v-workspace-projects-deep-dive)
   - [intuition-contracts-v2](#intuition-contracts-v2)
   - [intuition-rs](#intuition-rs)
   - [intuition-ts](#intuition-ts)
   - [intuition-snap](#intuition-snap-1)
   - [hivemind-explorer](#hivemind-explorer)
   - [hivemind-extension](#hivemind-extension)
7. [Part VI: Key Concepts and Patterns](#part-vi-key-concepts-and-patterns)
   - [The Term Abstraction](#the-term-abstraction)
   - [Position and Vault Mechanics](#position-and-vault-mechanics)
   - [Distribution Analysis](#distribution-analysis)
   - [Trust Circles](#trust-circles)
8. [Part VII: Integration Patterns](#part-vii-integration-patterns)
   - [Querying the Knowledge Graph](#querying-the-knowledge-graph)
   - [Creating Atoms and Triples](#creating-atoms-and-triples)
   - [Staking and Signaling](#staking-and-signaling)
9. [Part VIII: Security Considerations](#part-viii-security-considerations)
   - [ENS and Identity](#ens-and-identity)
   - [Economic Attacks](#economic-attacks)
   - [Data Integrity](#data-integrity)
10. [Appendices](#appendices)
    - [Glossary](#glossary)
    - [Configuration Reference](#configuration-reference)
    - [GraphQL Schema Reference](#graphql-schema-reference)

---

## Executive Summary

Intuition is a decentralized protocol for creating, curating, and querying a global knowledge graph. At its core, Intuition enables anyone to make claims about anything—people, organizations, URLs, concepts—and back those claims with economic stake. This creates a permissionless reputation and knowledge system where truth emerges from consensus, weighted by conviction.

The Hive Mind products are the primary user interfaces for interacting with the Intuition Protocol. They include a web-based explorer, a browser extension, and a MetaMask Snap, each designed to surface trust signals and knowledge graph data in contextually relevant ways.

This document provides a comprehensive overview of the entire ecosystem, explaining how each component works independently and how they integrate to form a cohesive system for decentralized knowledge management.

### Key Takeaways

1. **Atoms** are the fundamental units of knowledge—they can represent anything: a person, an organization, a URL, a concept.

2. **Triples** are claims in Subject-Predicate-Object format that link atoms together, forming a semantic knowledge graph.

3. **Vaults** are economic containers where users stake TRUST tokens to signal belief in atoms or claims.

4. **The TRUST token** is the native currency for data creation fees, staking, governance, and node operation.

5. **The MultiVault contract** is the central smart contract managing all protocol operations.

6. **The backend services** (intuition-rs) index blockchain events, resolve metadata, and serve data via GraphQL.

7. **The frontend products** (explorer, extension, snap) provide user interfaces for browsing, creating, and staking on knowledge.

---

## Part I: The Intuition Protocol

### Vision and Philosophy

The internet lacks a native layer for trust and reputation. Today's systems are fragmented, centralized, and opaque. Intuition aims to create an open, permissionless infrastructure where:

- **Anyone can participate** — No gatekeepers control who can add knowledge or signal trust.
- **Economic weight creates accountability** — Staking tokens behind claims makes false information costly.
- **Consensus emerges organically** — The aggregate of many individual signals reveals collective belief.
- **Knowledge is composable** — Triples can reference other triples, building complex knowledge structures.

Intuition draws inspiration from Wikipedia's collaborative knowledge creation, combined with prediction markets' economic incentives, built on blockchain's transparency and permissionlessness.

### Core Primitives

#### Atoms

An **atom** is the fundamental unit of knowledge in Intuition. It represents a single entity or concept and has the following properties:

| Property | Description |
|----------|-------------|
| `term_id` | Unique identifier, derived from `keccak256(ATOM_SALT, data)` |
| `data` | The raw content (could be JSON-LD, plain text, address, URL) |
| `label` | Human-readable display name |
| `image` | Optional image URL (supports IPFS) |
| `type` | Category (Account, Person, Organization, Thing, URL, etc.) |
| `creator_id` | Address of the creator |
| `wallet_id` | Address controlling the atom's wallet |

Atoms can represent:
- **Ethereum addresses** (EOAs and contracts)
- **URLs** (websites, social profiles)
- **People** (using schema.org Person type)
- **Organizations** (using schema.org Organization type)
- **Concepts** (like "trustworthy", "verified", "expert")
- **Arbitrary data** (any structured or unstructured content)

The `term_id` is deterministically derived from the atom's data, ensuring that identical content always maps to the same identity. This prevents duplicates and enables content-addressing.

#### Triples

A **triple** is a semantic claim that links three atoms together:

```
Subject → Predicate → Object
```

For example:
- "Vitalik" → "is" → "trustworthy"
- "Wikipedia" → "has tag" → "reliable source"
- "0xABC..." → "works at" → "Ethereum Foundation"

Triples have the following properties:

| Property | Description |
|----------|-------------|
| `term_id` | Unique identifier for the triple |
| `subject_id` | Reference to the subject atom |
| `predicate_id` | Reference to the predicate atom |
| `object_id` | Reference to the object atom |
| `counter_term_id` | ID of the opposing vault (for AGAINST positions) |
| `creator_id` | Address of the creator |

Every triple automatically creates **two vaults**:
1. **Support vault** — For staking in favor of the claim
2. **Counter vault** — For staking against the claim

This dual-vault system enables nuanced signaling where users can express agreement or disagreement with specific claims.

#### Vaults

A **vault** is an economic container that holds staked TRUST tokens. Vaults use bonding curves to determine share prices, creating dynamic pricing based on demand.

Key vault properties:

| Property | Description |
|----------|-------------|
| `term_id` | The atom or triple this vault is associated with |
| `curve_id` | Which bonding curve formula to use |
| `total_shares` | Total shares issued |
| `current_share_price` | Current price per share |
| `market_cap` | Total value locked |
| `position_count` | Number of unique stakers |

When users deposit TRUST tokens:
1. The bonding curve calculates how many shares they receive
2. Shares are minted to the user
3. The share price increases for future depositors

When users redeem:
1. Shares are burned
2. TRUST tokens are returned (minus exit fees)
3. The share price decreases

This creates a market where early conviction is rewarded and later participants pay higher prices, incentivizing information discovery.

### Economic Model

Intuition's economic model balances several objectives:

1. **Data quality** — Fees for creation prevent spam
2. **Signal strength** — Staking costs make signals meaningful
3. **Sustainability** — Protocol fees fund ongoing development
4. **Decentralization** — Token distribution enables governance

#### Fee Structure

| Fee Type | Purpose | Recipient |
|----------|---------|-----------|
| Atom creation fee | Prevent spam, fund protocol | Protocol treasury |
| Triple creation fee | Prevent spam, fund protocol | Protocol treasury |
| Entry fee | Share of deposit | Existing stakers |
| Exit fee | Cost of redemption | Protocol + remaining stakers |
| Atom deposit fraction | Portion to atom wallet | Atom creator |

Fees are configured in the MultiVault contract and can be adjusted through governance.

#### Utilization Requirements

The protocol implements **utilization requirements** to tie token emissions to actual network usage:

**System Utilization:**
```
System Utilization = Total Staked Value / (Total Supply × Target Ratio)
```

When system utilization is below target, emissions are reduced, preventing inflation without corresponding activity.

**Personal Utilization:**
Each user also has personal utilization requirements to receive rewards, encouraging active participation rather than passive holding.

### Smart Contract Architecture

The core smart contracts are built on Solidity and follow the ERC-4626 tokenized vault standard with significant extensions.

#### Contract Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MultiVault                                   │
│  (Main entry point for all protocol operations)                     │
├─────────────────────────────────────────────────────────────────────┤
│                       MultiVaultCore                                 │
│  (Configuration, ID calculation, core getters)                      │
├─────────────────────────────────────────────────────────────────────┤
│                    Supporting Contracts                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ BondingCurve │ │ AtomWallet   │ │ AccessControl│                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

#### ID Calculation

All IDs are deterministically calculated using keccak256 hashing:

```solidity
// Atom ID
function _calculateAtomId(bytes calldata data) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(ATOM_SALT, data));
}

// Triple ID
function _calculateTripleId(
    bytes32 subjectId,
    bytes32 predicateId,
    bytes32 objectId
) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(TRIPLE_SALT, subjectId, predicateId, objectId));
}

// Counter Triple ID (for AGAINST positions)
function _calculateCounterTripleId(bytes32 tripleId) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(COUNTER_SALT, tripleId));
}
```

This deterministic ID generation enables:
- Pre-computing IDs before on-chain transactions
- Preventing duplicate atoms with identical content
- Content-addressing for the knowledge graph

---

## Part II: The TRUST Token

### Token Utility

TRUST is the native token of the Intuition Protocol, serving four primary functions:

#### 1. Data Creation Fees

Creating atoms and triples requires paying fees in TRUST:
- **Atom creation**: Fixed fee + minimum deposit
- **Triple creation**: Fixed fee + minimum deposit

These fees serve as economic spam prevention and fund protocol development.

#### 2. Staking and Signaling

Users stake TRUST tokens in vaults to signal their beliefs:
- **Atom staking**: Express support for an entity's reputation
- **Triple staking FOR**: Agree with a claim
- **Triple staking AGAINST**: Disagree with a claim

The amount staked represents conviction—larger stakes carry more weight in aggregate signals.

#### 3. Governance

TRUST holders can participate in protocol governance:
- Voting on parameter changes (fees, thresholds)
- Voting on upgrade proposals
- Voting on treasury allocation

The **veTRUST** mechanism (vote-escrowed TRUST) provides boosted voting power for tokens locked for longer periods:

| Lock Duration | Voting Power Multiplier |
|---------------|------------------------|
| 1 month | 1.0x |
| 6 months | 1.5x |
| 1 year | 2.0x |
| 4 years | 4.0x |

#### 4. Node Operation

Running an Intuition node (indexer) requires staking TRUST as a bond:
- Nodes index blockchain events
- Nodes serve GraphQL queries
- Malicious or faulty nodes can be slashed

This creates a decentralized network of indexers with economic accountability.

### Supply and Emissions

#### Initial Supply

The TRUST token has a capped initial supply with planned emissions:

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| Community treasury | 40% | Ecosystem development, grants |
| Team | 20% | Core contributors (vested) |
| Early supporters | 15% | Seed and private rounds |
| Public sale | 10% | Initial distribution |
| Protocol incentives | 15% | Staking rewards, node rewards |

#### Emission Schedule

Emissions follow a geometric decay model:

```
Annual Emission Rate = Base Rate × Decay Factor^Year
```

Where:
- Base Rate starts at 10% of remaining allocation
- Decay Factor is approximately 0.85
- Emissions are tied to utilization requirements

This creates predictable, decreasing inflation that incentivizes early participation while maintaining long-term scarcity.

### Staking Mechanics

#### Depositing (Staking)

When a user stakes TRUST tokens:

1. **Fee deduction**: Entry fees are calculated and deducted
2. **Share calculation**: Bonding curve determines shares to mint
3. **Position creation**: User receives shares representing their stake
4. **Price update**: Share price increases based on deposit

```
shares_received = bonding_curve.preview_deposit(assets_deposited)
new_share_price = bonding_curve.calculate_price(total_shares + shares_received)
```

#### Redeeming (Unstaking)

When a user redeems their position:

1. **Asset calculation**: Bonding curve determines TRUST to return
2. **Fee deduction**: Exit fees are calculated and deducted
3. **Share burning**: User's shares are burned
4. **Price update**: Share price decreases based on redemption

```
assets_received = bonding_curve.preview_redeem(shares_redeemed) - exit_fees
new_share_price = bonding_curve.calculate_price(total_shares - shares_redeemed)
```

#### Position Tracking

Each user's position in a vault is tracked:

| Field | Description |
|-------|-------------|
| `account_id` | User's wallet address |
| `term_id` | The vault (atom or triple) |
| `curve_id` | Which bonding curve |
| `shares` | Number of shares owned |

Positions are stored on-chain and indexed for querying.

### Bonding Curves

Bonding curves determine the relationship between deposits and share prices. Intuition supports multiple curve types:

#### Linear Curve

```
price = base_price + (slope × total_shares)
```

Properties:
- Predictable price growth
- Simple to understand
- Lower volatility

#### Exponential Curve

```
price = base_price × e^(rate × total_shares)
```

Properties:
- Rapid price appreciation
- Rewards early stakers significantly
- Higher volatility

#### Sigmoid Curve

```
price = max_price / (1 + e^(-rate × (total_shares - midpoint)))
```

Properties:
- Price plateaus at maximum
- S-curve adoption pattern
- Balanced between linear and exponential

The default curve for most vaults is linear (curve_id = 1), providing predictable economics while still rewarding early conviction.

---

## Part III: Technical Architecture

### Data Layer

The Intuition data layer consists of three main components:

#### 1. On-Chain State

The blockchain serves as the source of truth for:
- Atom and triple creation events
- Vault deposits and redemptions
- Position balances
- Fee accumulation

Smart contract events are emitted for all state changes, enabling indexing.

#### 2. PostgreSQL Database

The backend indexes blockchain events into a PostgreSQL database:

```sql
-- Core tables
CREATE TABLE atom (
    term_id NUMERIC(78,0) PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    data TEXT,
    raw_data TEXT NOT NULL,
    label TEXT,
    image TEXT,
    type atom_type NOT NULL,
    resolving_status atom_resolving_status NOT NULL
);

CREATE TABLE triple (
    term_id NUMERIC(78,0) PRIMARY KEY,
    subject_id NUMERIC(78,0) REFERENCES atom(term_id),
    predicate_id NUMERIC(78,0) REFERENCES atom(term_id),
    object_id NUMERIC(78,0) REFERENCES atom(term_id),
    counter_term_id NUMERIC(78,0),
    creator_id TEXT NOT NULL
);

CREATE TABLE position (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    term_id NUMERIC(78,0) NOT NULL,
    curve_id INTEGER NOT NULL,
    shares NUMERIC(78,0) NOT NULL
);

CREATE TABLE vault (
    term_id NUMERIC(78,0),
    curve_id INTEGER,
    total_shares NUMERIC(78,0),
    current_share_price NUMERIC(78,0),
    market_cap NUMERIC(78,0),
    position_count INTEGER,
    PRIMARY KEY (term_id, curve_id)
);
```

#### 3. The Term Table

A key abstraction is the **term** table, which provides a unified view of atoms and triples:

```sql
CREATE TABLE term (
    id NUMERIC(78,0) PRIMARY KEY,
    type term_type NOT NULL, -- 'atom' or 'triple'
    atom_id NUMERIC(78,0),
    triple_id NUMERIC(78,0),
    total_assets NUMERIC(78,0),
    total_market_cap NUMERIC(78,0)
);
```

The term table enables:
- Unified vault queries (positions are on terms, not atoms/triples directly)
- Aggregated market cap calculations
- Simplified GraphQL relationships

### Backend Services

The `intuition-rs` repository contains the Rust backend services:

#### Consumer Service

The consumer service processes blockchain events in real-time:

```
Blockchain Events → Consumer → PostgreSQL
                  ↓
            Resolver Queue
```

It handles:
- AtomCreated events
- TripleCreated events
- Deposited events
- Redeemed events
- FeeTransfer events

#### Resolver Service

The resolver enriches atom metadata asynchronously:

1. **ENS Resolution**: Looks up ENS names and avatars for addresses
2. **IPFS Resolution**: Fetches and validates IPFS content
3. **Schema.org Parsing**: Extracts structured data from JSON-LD
4. **Image Processing**: Downloads and caches images

Resolution flow:
```
New Atom → Check Type → Enqueue for Resolution → Resolve → Update Database
```

#### API Service

The consumer-api service provides REST endpoints for:
- Health checks
- Metrics
- Administrative operations

### GraphQL API

The GraphQL API is served via Hasura, providing auto-generated queries from the PostgreSQL schema:

#### Key Queries

**Fetch an atom by term_id:**
```graphql
query GetAtom($termId: String!) {
    atom(term_id: $termId) {
        term_id
        label
        image
        data
        type
        creator {
            id
            label
        }
    }
}
```

**Fetch triples with positions:**
```graphql
query GetTripleWithPositions($subjectId: String!, $predicateId: String!, $objectId: String!) {
    triples(where: {
        subject_id: { _eq: $subjectId },
        predicate_id: { _eq: $predicateId },
        object_id: { _eq: $objectId }
    }) {
        term_id
        term {
            vaults {
                market_cap
                position_count
            }
        }
        positions {
            account_id
            shares
        }
        counter_positions {
            account_id
            shares
        }
    }
}
```

**Search atoms:**
```graphql
query SearchAtoms($query: String!) {
    atoms(where: {
        _or: [
            { label: { _ilike: $query } },
            { data: { _ilike: $query } }
        ]
    }, order_by: { term: { total_market_cap: desc } }) {
        term_id
        label
        image
    }
}
```

#### Relationship Navigation

The GraphQL schema enables navigation through relationships:

```
positions → term → triple → subject/predicate/object → atom
         → term → atom
         → account
         → vault
```

This enables complex queries like "find all addresses I trust that have staked on this claim."

### Identity Resolution

A critical aspect of the Intuition system is identity resolution—connecting blockchain addresses to human-readable identities.

#### ENS Resolution

The resolver service queries ENS for:

1. **Forward resolution**: Name → Address
2. **Reverse resolution**: Address → Name (via addr.reverse)
3. **Avatar resolution**: Name → Image URL

```rust
pub async fn get_ens(address: Address, context: &ResolverContext) -> Result<Ens> {
    // Prepare reverse lookup name
    let reverse_name = format!("{:?}.addr.reverse", address);

    // Get resolver address from ENS registry
    let resolver_address = ens_registry.resolver(namehash(&reverse_name)).await?;

    // Query the name
    let ens_name = ens_resolver.name(namehash(&reverse_name)).await?;

    // Get avatar if name exists
    let avatar = if let Some(name) = &ens_name {
        get_ens_avatar(name, context).await?
    } else {
        None
    };

    Ok(Ens { name: ens_name, image: avatar })
}
```

#### Important Security Consideration: ENS Transfers

**ENS domains can be transferred.** When an ENS domain is sold or transferred:
- The new owner can point it to a different address
- Historical claims about the ENS name may now apply to a different entity

The Intuition protocol mitigates this by:
1. **Using addresses as canonical identifiers** — Claims are tied to `term_id` derived from address data
2. **ENS is display-only** — The `label` field may contain ENS, but identity matching uses the address
3. **Separate concerns** — ENS resolution enriches display, it doesn't define identity

In the Snap and Explorer:
- Trust triples are about addresses, not ENS names
- ENS names are shown as labels for convenience
- The underlying identity remains the cryptographic address

---

## Part IV: The Hive Mind Products

Hive Mind is the brand for user-facing products built on the Intuition Protocol. These products make the knowledge graph accessible and actionable.

### Hive Mind Explorer

The Explorer (`hivemind-explorer`) is a web application for browsing and interacting with the Intuition knowledge graph.

#### Core Features

1. **Atom Browser**: Browse and search all atoms in the knowledge graph
2. **Triple Explorer**: View claims and their stake distributions
3. **User Profiles**: See an address's atoms, claims, and positions
4. **Staking Interface**: Stake FOR or AGAINST claims
5. **Creation Tools**: Create new atoms and triples

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       React Application                              │
├─────────────────────────────────────────────────────────────────────┤
│  Routes (TanStack Router)                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                  │
│  │ Home    │ │ Atoms   │ │ Triples │ │ Profile │                  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                  │
├─────────────────────────────────────────────────────────────────────┤
│  State Management                                                    │
│  ┌──────────────┐ ┌──────────────┐                                 │
│  │ React Query  │ │   Zustand    │                                 │
│  │ (server)     │ │   (client)   │                                 │
│  └──────────────┘ └──────────────┘                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Services & Hooks                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ GraphQL      │ │ MultiVault   │ │ Modal System │               │
│  │ Queries      │ │ Wrapper      │ │              │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
├─────────────────────────────────────────────────────────────────────┤
│ GraphQL API ←→ PostgreSQL ←→ Blockchain Indexer                    │
│ MultiVault Contract (for transactions)                              │
└─────────────────────────────────────────────────────────────────────┘
```

#### Key Configuration

From `config/app.config.ts`:

```typescript
export const chainConfigs = {
    mainnet: {
        chainId: 1155,
        chainName: 'Intuition Mainnet',
        graphqlOrigin: 'https://mainnet.intuition.sh',
        multiVaultAddress: '0x...',
        wellKnownAtoms: {
            hasTagAtomId: '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
            trustworthyAtomId: '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
        }
    }
};
```

### Hive Mind Extension

The Extension (`hivemind-extension`) is a browser extension (Chrome) that brings Intuition data to the browsing experience.

#### Core Features

1. **Entity Detection**: Automatically detects addresses, URLs, and social profiles on any page
2. **Contextual Insights**: Shows trust data for detected entities in a sidepanel
3. **Atom Queue**: Collects detected entities for batch creation
4. **Quick Staking**: Stake on entities without leaving the current page
5. **Social Integration**: Special support for X.com (Twitter) profiles

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER EXTENSION                             │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Background      │  Content Scripts │  Sidepanel (React)            │
│  (Service Worker)│  (Per-domain)    │  (Main UI)                    │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ • Web3 state     │ • URL detection  │ • TanStack Router             │
│ • Message hub    │ • Address detect │ • React Query                 │
│ • Contract calls │ • X.com scraper  │ • Atom queue                  │
│ • Session persist│ • Entity extract │ • Modal system                │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

#### Content Scripts

The extension injects content scripts for:

1. **global-url-detector.ts**: Detects URLs on any page
2. **global-address-detector.ts**: Detects EVM addresses on hover
3. **x-com.ts**: Extracts X.com profile data

These scripts communicate with the background service worker and sidepanel via Chrome's messaging API.

### Intuition Snap

The Snap (`intuition-snap`) is a MetaMask Snap that provides trust insights during transaction signing.

#### Core Features

1. **Your Position**: Prominently displays the user's own trust/distrust stake as the strongest signal
2. **Transaction Insights**: Shows trust data for the destination address
3. **Origin Trust**: Shows trust data for the dApp initiating the transaction
4. **Trust Circle**: Highlights if trusted contacts have staked on the address (sorted by stake)
5. **Distribution Analysis**: Shows how concentrated the stake is (Gini coefficient)
6. **Visual Indicators**: Color-coded trust badges (Trusted/Mixed/Untrusted)

#### Transaction Flow

```
User Initiates Transaction
         ↓
MetaMask Calls onTransaction Handler
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Parallel Fetches:                                                    │
│ 1. getAccountData(transaction.to)                                   │
│ 2. getOriginData(transactionOrigin)                                 │
│ 3. getTrustedCircle(userAddress)                                    │
└─────────────────────────────────────────────────────────────────────┘
         ↓
Calculate Trusted Circle Overlap
         ↓
Render Insight UI
         ↓
User Reviews and Confirms/Rejects
```

#### Your Position Feature

The strongest signal a user can receive is their own prior judgment. The Snap queries for the user's existing trust positions alongside aggregate data using GraphQL aliases:

```graphql
query TripleWithUserPosition($subjectId: String!, $predicateId: String!, $objectId: String!, $userAddress: String!) {
  triples(where: { ... }) {
    # Aggregate positions (top 30)
    positions(order_by: { shares: desc }, limit: 30) { ... }
    counter_positions(order_by: { shares: desc }, limit: 30) { ... }
    
    # User's specific position (using GraphQL aliases - no extra query needed)
    user_position: positions(where: { account_id: { _eq: $userAddress } }) {
      account_id
      shares
    }
    user_counter_position: counter_positions(where: { account_id: { _eq: $userAddress } }) {
      account_id
      shares
    }
  }
}
```

If the user has previously staked FOR or AGAINST, the `UserPositionSection` component renders this prominently at the top of the insight panel.

#### Trust Circle Feature

> **Pattern note:** The Snap builds the user's trust circle from `[I] → [follow] → [target]` triples (the canonical Hive Mind pattern, shared with the browser extension and explorer). A user "follows" an account by holding a FOR position on `[I] → [follow] → [their address]`; the circle is the set of **objects** of those triples. The legacy `[X] → [hasTag] → [trustworthy]` pattern is no longer used to build the circle. Per-topic trust circles and topical curatorship are **not** part of the active pattern in any Hive Mind product.

The trust circle (renamed from "Trusted Contacts") shows when someone you follow has also staked on the destination:

1. **Fetch user's follow circle**: Query positions where the user staked FOR on `[I] → [follow] → [target]` triples; the followed account is each triple's object
2. **Fetch destination's trust triple**: Get all positions on the destination's trustworthiness claim (`[address] → [hasTag] → [trustworthy]`)
3. **Cross-reference**: Find overlap between followed accounts and position holders
4. **Display**: Show which followed accounts have staked FOR or AGAINST, sorted by stake amount (highest first)

Contacts display their ENS name or Intuition alias (if available) via pre-resolved atom labels.

This provides social proof—"people you follow also trust this address."

---

## Part V: Workspace Projects Deep Dive

### intuition-contracts-v2

**Purpose**: Solidity smart contracts implementing the Intuition Protocol.

**Location**: `/Users/kylan/Documents/intuition/intuition-contracts-v2`

#### Key Contracts

| Contract | Purpose |
|----------|---------|
| `MultiVault.sol` | Main entry point for all protocol operations |
| `MultiVaultCore.sol` | Core configuration and ID calculations |
| `BondingCurve.sol` | Implementations of pricing curves |
| `AtomWallet.sol` | Manages per-atom treasury wallets |

#### Main Functions

```solidity
// Create atoms
function createAtoms(bytes[] calldata atomDatas) external payable returns (uint256[] memory);

// Create triples
function createTriples(
    uint256[] calldata subjectIds,
    uint256[] calldata predicateIds,
    uint256[] calldata objectIds
) external payable returns (uint256[] memory);

// Deposit (stake)
function deposit(
    address receiver,
    uint256 termId,
    uint256 curveId,
    uint256 minShares
) external payable returns (uint256 shares);

// Redeem (unstake)
function redeem(
    uint256 shares,
    address receiver,
    uint256 termId,
    uint256 curveId,
    uint256 minAssets
) external returns (uint256 assets);
```

#### Configuration Structs

```solidity
struct GeneralConfig {
    address admin;
    address protocolMultisig;
    uint256 minDeposit;
    uint256 minShare;
    uint256 atomCreationFee;
    uint256 tripleCreationFee;
}

struct VaultFees {
    uint256 entryFee;
    uint256 exitFee;
    uint256 protocolFee;
}
```

### intuition-rs

**Purpose**: Rust backend services for indexing, resolving, and serving data.

**Location**: `/Users/kylan/Documents/intuition/intuition-rs`

#### Key Crates

| Crate | Purpose |
|-------|---------|
| `consumer` | Event processing and database writes |
| `consumer-api` | REST API for administration |
| `models` | Rust structs matching database schema |
| `shared-utils` | Common utilities |
| `histocrawler` | Historical data backfill |
| `histoflux` | Real-time event streaming |
| `image-guard` | Image validation and processing |

#### Consumer Event Processing

```rust
// Main event processing loop
async fn process_event(event: ContractEvent) -> Result<()> {
    match event {
        ContractEvent::AtomCreated { term_id, creator, data, .. } => {
            // Insert atom record
            // Enqueue for metadata resolution
        }
        ContractEvent::TripleCreated { term_id, subject_id, predicate_id, object_id, .. } => {
            // Insert triple record
            // Update predicate_object stats
        }
        ContractEvent::Deposited { term_id, sender, assets, shares, .. } => {
            // Update or create position
            // Update vault state
        }
        ContractEvent::Redeemed { term_id, sender, assets, shares, .. } => {
            // Update position
            // Update vault state
        }
    }
}
```

#### Resolver Types

```rust
pub enum AtomType {
    Account,    // Ethereum address
    Person,     // schema.org Person
    Organization,
    Thing,
    Book,
    Url,
    Unknown,
}

pub enum AtomResolvingStatus {
    Pending,    // Not yet resolved
    Resolved,   // Successfully resolved
    Failed,     // Resolution failed
}
```

### intuition-ts

**Purpose**: TypeScript packages for interacting with Intuition.

**Location**: `/Users/kylan/Documents/intuition/intuition-ts`

#### Packages

| Package | Purpose |
|---------|---------|
| `@0xintuition/protocol` | Smart contract interactions via viem |
| `@0xintuition/graphql` | GraphQL client and queries |
| `@0xintuition/sdk` | High-level SDK combining protocol + graphql |
| `@0xintuition/1ui` | Shared UI components |
| `@0xintuition/api` | API client |

#### Protocol Package Usage

```typescript
import { multiVaultCreateAtoms, multiVaultDeposit } from '@0xintuition/protocol';

// Create an atom
const result = await multiVaultCreateAtoms(walletClient, {
    address: contractAddress,
    args: [atomDataArray],
    value: totalValue,
});

// Deposit (stake)
const depositResult = await multiVaultDeposit(walletClient, {
    address: contractAddress,
    args: [receiver, termId, curveId, minShares],
    value: depositAmount,
});
```

#### SDK Experimental Utils

```typescript
import { sync, findAtomIds, findTripleIds } from '@0xintuition/sdk/experimental';

// Find existing atoms by data
const existingAtoms = await findAtomIds(graphqlClient, atomDataArray);

// Sync atoms and triples (create missing, stake on existing)
const syncResult = await sync(walletClient, graphqlClient, {
    atoms: [{ data: '0x1234...' }],
    triples: [{ subject: '...', predicate: '...', object: '...' }],
});
```

### intuition-snap

**Purpose**: MetaMask Snap providing transaction insights.

**Location**: `/Users/kylan/Documents/intuition/intuition-snap`

#### Project Structure

```
packages/
├── snap/
│   ├── src/
│   │   ├── index.tsx           # Snap entry point
│   │   ├── onTransaction.tsx   # Transaction handler
│   │   ├── onUserInput.tsx     # User input handler
│   │   ├── account.tsx         # Account data fetching
│   │   ├── origin.tsx          # Origin data fetching
│   │   ├── queries.ts          # GraphQL queries
│   │   ├── config.ts           # Chain configuration
│   │   ├── distribution.ts     # Gini/distribution analysis
│   │   ├── components/         # UI components
│   │   └── trusted-circle/     # Trusted circle feature
│   └── snap.manifest.json
└── site/                       # Demo/documentation site
```

#### Key Configuration

```typescript
export const INTUITION_MAINNET = {
    backendUrl: 'https://mainnet.intuition.sh/v1/graphql',
    rpcUrl: 'https://rpc.intuition.systems',
    chainId: 1155,
    chainIdHex: '0x483',
    chainName: 'Intuition Mainnet',
    currencySymbol: 'TRUST',
    hasTagAtomId: '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
    trustworthyAtomId: '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
    hasAliasAtomId: '0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6',
};
```

### hivemind-explorer

**Purpose**: Web application for exploring the Intuition knowledge graph.

**Location**: `/Users/kylan/Documents/hivemind/hivemind-explorer`

#### Technology Stack

- **Framework**: React with TypeScript
- **Routing**: TanStack Router
- **State**: React Query (server) + Zustand (client)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Web3**: viem + wagmi

#### Key Directories

```
src/
├── routes/             # Page components (TanStack Router)
├── components/         # Reusable UI components
├── features/           # Feature-specific code (modals, etc.)
├── hooks/              # Custom React hooks
├── services/           # Data fetching services
├── util/               # Utilities (multivault wrapper, etc.)
└── graphql/            # GraphQL queries and fragments
```

### hivemind-extension

**Purpose**: Browser extension for contextual Intuition data.

**Location**: `/Users/kylan/Documents/hivemind/hivemind-extension`

#### Technology Stack

- **Framework**: React with TypeScript
- **Build**: Plasmo (extension framework)
- **Routing**: TanStack Router
- **State**: React Query + Zustand
- **Web3**: viem + wagmi (ad-hoc connections)

#### Extension Components

```
src/
├── background/         # Service worker
│   ├── index.ts        # Entry point
│   ├── web3-service.ts # Wallet connection management
│   └── messages/       # Message handlers
├── contents/           # Content scripts
│   ├── global-url-detector.ts
│   ├── global-address-detector.ts
│   └── x-com.ts
├── sidepanel.tsx       # Main UI entry
├── routes/             # Sidepanel pages
├── components/         # UI components
├── hooks/              # React hooks
└── lib/
    └── atom-queue/     # Entity queue system
```

---

## Part VI: Key Concepts and Patterns

### The Term Abstraction

One of the most important architectural decisions in Intuition is the **term** abstraction. A term is a unified representation that can be either an atom or a triple.

#### Why Terms Exist

Vaults and positions are associated with **terms**, not directly with atoms or triples. This enables:

1. **Unified queries**: Query all positions without knowing if they're on atoms or triples
2. **Consistent pricing**: Same bonding curve logic for all vault types
3. **Aggregated stats**: `total_market_cap` calculated at the term level

#### Database Structure

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

#### GraphQL Navigation

```graphql
# Navigate from position to the underlying entity
query {
    positions(where: { account_id: { _eq: $userId } }) {
        term {
            type
            atom { label }
            triple { subject { label } predicate { label } object { label } }
        }
    }
}
```

### Position and Vault Mechanics

#### Position Structure

A position represents a user's stake in a vault:

```typescript
interface Position {
    id: string;              // Unique position ID
    account_id: string;      // User's wallet address
    term_id: string;         // The vault (atom or triple term)
    curve_id: number;        // Which bonding curve
    shares: bigint;          // Number of shares owned
}
```

#### Vault Structure

A vault tracks the aggregate state:

```typescript
interface Vault {
    term_id: string;
    curve_id: number;
    total_shares: bigint;
    current_share_price: bigint;
    market_cap: bigint;
    position_count: number;
}
```

#### Relationship

```
User Position ←→ Vault ←→ Term ←→ Atom/Triple
```

One vault can have many positions (one per user), and market_cap = sum of all position values.

### Distribution Analysis

The Snap implements distribution analysis to assess how concentrated stake is in a vault.

#### Gini Coefficient

The Gini coefficient measures inequality:
- **0** = Perfect equality (everyone has equal stake)
- **1** = Perfect inequality (one person has everything)

```typescript
function calculateGini(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;

    let sumDifferences = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            sumDifferences += Math.abs(values[i] - values[j]);
        }
    }

    return sumDifferences / (2 * n * n * mean);
}
```

#### Nakamoto Coefficient

The Nakamoto coefficient is the minimum number of stakers needed to control 51%:

```typescript
function calculateNakamoto(values: number[]): number {
    const total = values.reduce((a, b) => a + b, 0);
    const threshold = total * 0.51;

    const sorted = [...values].sort((a, b) => b - a);

    let cumulative = 0;
    for (let i = 0; i < sorted.length; i++) {
        cumulative += sorted[i];
        if (cumulative >= threshold) {
            return i + 1;
        }
    }
    return sorted.length;
}
```

#### Status Determination

```
1. Top-1% ≥ 80%  →  ⛔️ Whale Dominated
2. < 3 stakers   →  ⚠️ Concentrated (or moderate)
3. Gini ≤ 0.35   →  🟢 Well Distributed
4. Gini ≤ 0.55   →  🟡 Moderate
5. Gini ≤ 0.75   →  ⚠️ Concentrated
6. Gini > 0.75   →  ⛔️ Whale Dominated
```

### Trust Circle

The trust circle feature (UI displays "Your Trust Circle") shows when people you follow have also staked on an entity.

> **Canonical pattern:** Hive Mind's canonical trust circle pattern is `[I] → [follow] → [target]` (browser extension + explorer), and the Intuition Snap now uses it too (migrated 2026-05-30). The legacy `[X] → [hasTag] → [trustworthy]` pattern is no longer used to build the circle. Per-topic trust circles and topical curatorship are **not** part of the active pattern in any Hive Mind product.

#### How It Works

1. **Build follow circle**: Find all follow triples where the user has staked FOR. Match by the **position's** `account_id` (the staker), read the followed account from `triple.object`:
   ```graphql
   positions(where: {
       account_id: { _eq: $userAddress },
       term: {
           triple: {
               subject_id: { _eq: $iAtomId },
               predicate_id: { _eq: $followAtomId }
           }
       }
   }) {
     term {
       triple {
         object_id
         object {
           label  # May contain ENS name
           data   # Contains EVM address for ENS-resolved atoms
         }
       }
     }
   }
   ```

   The subject is always the shared `I` atom; the staker is identified by the position's `account_id`, and the followed account is the triple's `object`.

2. **Get destination positions**: Find all stakers on the destination's trust triple (`[address] → [hasTag] → [trustworthy]`)

3. **Cross-reference**: Find overlap between followed accounts and position holders

4. **Display**: Show "Your Trust Circle" with contacts sorted by stake amount (highest first)

5. **Label enrichment**: Fetch pre-resolved atom labels for trusted addresses to display ENS names or Intuition aliases

#### Key Insight: ENS Address Extraction

For ENS-resolved atoms, the wallet address is in `subject.data`, NOT `subject.label`:

```typescript
// Helper to validate EVM addresses
function isEvmAddress(value: string | null | undefined): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/i.test(value);
}

// CORRECT: Check subject.data first for ENS-resolved atoms
// subject.label = "smilingkylan.eth" (ENS name)
// subject.data  = "0xCF806BacAFBbcf09959B1866b5c1479fbEF97e05" (EVM address)
const walletAddress = isEvmAddress(subject.data)
  ? subject.data
  : isEvmAddress(subject.label)
    ? subject.label
    : null;

contactMap.set(getAddress(walletAddress), {
    accountId: walletAddress,
    label: subject.label || walletAddress, // Keep ENS name for display
});

// This matches position.account_id (also a wallet address)
```

**⚠️ Critical**: Using only `subject.label` will fail for ENS-resolved atoms because the label contains the ENS name (e.g., "vitalik.eth"), not the EVM address.

---

## Part VII: Integration Patterns

### Querying the Knowledge Graph

#### Finding Atoms

```typescript
// By address
const atoms = await graphqlClient.query({
    atoms: {
        __args: {
            where: {
                _or: [
                    { label: { _eq: address } },
                    { data: { _eq: address } }
                ]
            }
        },
        term_id: true,
        label: true,
        image: true,
    }
});

// By search term
const searchResults = await graphqlClient.query({
    atoms: {
        __args: {
            where: { label: { _ilike: `%${searchTerm}%` } },
            order_by: [{ term: { total_market_cap: 'desc' } }],
            limit: 20
        },
        term_id: true,
        label: true,
        type: true,
    }
});
```

#### Finding Trust Triples

```typescript
// Find if a trust triple exists for an entity
const trustTriple = await graphqlClient.query({
    triples: {
        __args: {
            where: {
                subject_id: { _eq: subjectTermId },
                predicate_id: { _eq: hasTagAtomId },
                object_id: { _eq: trustworthyAtomId }
            }
        },
        term_id: true,
        term: {
            vaults: {
                __args: { where: { curve_id: { _eq: '1' } } },
                market_cap: true,
                position_count: true,
            }
        },
        positions: {
            account_id: true,
            shares: true,
        },
        counter_positions: {
            account_id: true,
            shares: true,
        }
    }
});
```

### Creating Atoms and Triples

#### Using the Protocol Package

```typescript
import { multiVaultCreateAtoms, multiVaultGetAtomCost } from '@0xintuition/protocol';

// Get creation cost
const atomCost = await multiVaultGetAtomCost(publicClient, {
    address: contractAddress,
});

// Prepare atom data (hex-encoded)
const atomData = toHex(JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Alice',
    description: 'Blockchain developer'
}));

// Create atom
const tx = await multiVaultCreateAtoms(walletClient, {
    address: contractAddress,
    args: [[atomData]],
    value: atomCost.atomCost + atomCost.minDeposit,
});

// Wait for confirmation and parse events
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
const atomCreatedEvent = parseEventLogs({
    abi: multiVaultAbi,
    logs: receipt.logs,
    eventName: 'AtomCreated'
});
const newAtomId = atomCreatedEvent[0].args.termId;
```

#### Creating Triples

```typescript
import { multiVaultCreateTriples, multiVaultGetTripleCost } from '@0xintuition/protocol';

// Get creation cost
const tripleCost = await multiVaultGetTripleCost(publicClient, {
    address: contractAddress,
});

// Create triple
const tx = await multiVaultCreateTriples(walletClient, {
    address: contractAddress,
    args: [[subjectId], [predicateId], [objectId]],
    value: tripleCost.tripleCost + tripleCost.minDeposit,
});
```

### Staking and Signaling

#### Depositing (Staking FOR)

```typescript
import { multiVaultDeposit, multiVaultPreviewDeposit } from '@0xintuition/protocol';

// Preview how many shares you'll get
const preview = await multiVaultPreviewDeposit(publicClient, {
    address: contractAddress,
    args: [depositAmount, termId, curveId],
});

// Execute deposit
const tx = await multiVaultDeposit(walletClient, {
    address: contractAddress,
    args: [
        receiverAddress,  // Usually the sender
        termId,           // Atom or triple term_id
        curveId,          // Usually 1n
        minShares,        // Slippage protection
    ],
    value: depositAmount,
});
```

#### Staking AGAINST a Triple

To stake against a triple, deposit into its counter vault:

```typescript
// Get the counter term ID
const counterTermId = await publicClient.readContract({
    address: contractAddress,
    abi: multiVaultAbi,
    functionName: 'tripleCounterTermId',
    args: [tripleTermId],
});

// Deposit into counter vault
const tx = await multiVaultDeposit(walletClient, {
    address: contractAddress,
    args: [receiverAddress, counterTermId, curveId, minShares],
    value: depositAmount,
});
```

#### Redeeming (Unstaking)

```typescript
import { multiVaultRedeem, multiVaultPreviewRedeem } from '@0xintuition/protocol';

// Preview how much you'll get back
const preview = await multiVaultPreviewRedeem(publicClient, {
    address: contractAddress,
    args: [sharesToRedeem, termId, curveId],
});

// Execute redemption
const tx = await multiVaultRedeem(walletClient, {
    address: contractAddress,
    args: [
        sharesToRedeem,
        receiverAddress,
        termId,
        curveId,
        minAssets,  // Slippage protection
    ],
});
```

---

## Part VIII: Security Considerations

### ENS and Identity

#### The Transfer Problem

ENS domains can be bought, sold, and transferred. When transferred:
- The new owner controls the name
- Historical associations become invalid
- Claims made about the ENS name may apply to different people

#### Mitigation Strategies

1. **Address-based identity**: The Intuition protocol uses addresses as canonical identifiers. ENS is purely display.

2. **Deterministic IDs**: `term_id = keccak256(ATOM_SALT, data)` where data is the address, not the ENS name.

3. **Separate concerns**:
   - Claims are about addresses (immutable)
   - ENS enriches the display (mutable)
   - UI shows address prominently

4. **Backend resolution caching**: ENS names are resolved and cached, but the underlying identity remains the address.

#### Best Practices

- Always display the underlying address
- Use ENS as a label, not an identifier
- Consider adding "last resolved" timestamps
- Be explicit that claims follow addresses, not names

### Economic Attacks

#### Sybil Attacks

**Risk**: Create many wallets to artificially inflate position counts.

**Mitigation**:
- Position count is a weak signal; market cap matters more
- Distribution analysis (Gini) reveals concentration even with many addresses
- Minimum deposit requirements increase attack cost

#### Whale Manipulation

**Risk**: Large stakers can dominate signals.

**Mitigation**:
- Distribution indicators warn users of whale dominance
- Nakamoto coefficient shows concentration
- Counter-vaults enable pushback

#### Front-Running

**Risk**: Observers front-run deposits to capture bonding curve profits.

**Mitigation**:
- Minimal MEV opportunity due to small typical deposits
- Entry fees reduce profit margins
- Batch creation/staking reduces exposure

### Data Integrity

#### Resolver Trust

The resolver service enriches atom metadata (ENS names, IPFS content, etc.). This introduces trust assumptions:

1. **Resolver availability**: If the resolver is down, metadata won't update
2. **Resolver accuracy**: Bugs could populate incorrect data
3. **Source reliability**: External sources (ENS, IPFS) may be unreliable

**Mitigations**:
- Raw data is always preserved on-chain
- Resolution status is tracked
- Multiple resolution attempts before marking failed

#### Indexer Consistency

Multiple indexers should produce identical state:

1. **Deterministic processing**: Same events → same database state
2. **Reorg handling**: Chain reorgs must be handled correctly
3. **Gap detection**: Missing events must be detected and backfilled

---

## Appendices

### Glossary

| Term | Definition |
|------|------------|
| **Atom** | Fundamental knowledge unit (person, org, URL, concept) with a unique term_id |
| **Triple** | Subject-Predicate-Object claim linking three atoms |
| **Vault** | Economic container holding staked TRUST tokens, priced by bonding curve |
| **Position** | A user's stake in a vault, represented as shares |
| **Term** | Unified abstraction for atoms and triples (vaults are on terms) |
| **term_id** | Unique identifier derived from keccak256 hash of atom data |
| **curve_id** | Identifier for which bonding curve formula to use |
| **TRUST** | Native token for fees, staking, governance, and node operation |
| **tTRUST** | Testnet version of TRUST token |
| **veTRUST** | Vote-escrowed TRUST for boosted governance power |
| **MultiVault** | Core smart contract managing all protocol operations |
| **Counter-vault** | Opposing side of a triple's vault (FOR vs AGAINST) |
| **Entry fee** | Fee charged when depositing into a vault |
| **Exit fee** | Fee charged when redeeming from a vault |
| **Bonding curve** | Algorithmic pricing mechanism for vault shares |
| **Gini coefficient** | Measure of inequality (0 = equal, 1 = unequal) |
| **Nakamoto coefficient** | Minimum entities needed to control 51% |
| **Trust Circle** | The accounts a user follows — i.e. those they hold a FOR position on in an `[I] → [follow] → [account]` triple. Canonical pattern across Hive Mind (extension, explorer, and Snap as of 2026-05-30). Per-topic / topical curator trust circles are **not** part of the active pattern in any Hive Mind product. |
| **I atom** | Universal self-referential subject atom; fixed subject of every `[I] → [follow] → [target]` triple |
| **follow atom** | Predicate atom used to build the viewer's trust circle (Schema.org `FollowAction`) — canonical Hive Mind pattern |
| **hasTag** | Common predicate for tagging (e.g., "X has tag trustworthy"); used to display a target's trustworthiness market, **not** to build the viewer's trust circle |
| **hasAlias** | Predicate for associating alternative names |
| **CAIP-10** | Chain Agnostic Improvement Proposal for address formatting |

### Configuration Reference

#### Chain Configuration

| Network | Chain ID | RPC URL | GraphQL URL |
|---------|----------|---------|-------------|
| Mainnet | 1155 | https://rpc.intuition.systems | https://mainnet.intuition.sh/v1/graphql |
| Testnet | 13579 | https://testnet.rpc.intuition.systems | https://testnet.intuition.sh/v1/graphql |

#### Well-Known Atoms (Mainnet)

| Name | term_id |
|------|---------|
| I | `0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b` |
| follow | `0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260` |
| hasTag | `0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5` |
| trustworthy | `0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a` |
| hasAlias | `0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6` |

### GraphQL Schema Reference

#### Core Types

```graphql
type atoms {
    term_id: String!
    wallet_id: String!
    creator_id: String!
    data: String
    raw_data: String!
    label: String
    image: String
    type: atom_type!
    resolving_status: atom_resolving_status!

    # Relationships
    creator: accounts
    controller: accounts
    term: terms
    positions: [positions!]!
    as_subject_triples: [triples!]!
    as_predicate_triples: [triples!]!
    as_object_triples: [triples!]!
}

type triples {
    term_id: String!
    subject_id: String!
    predicate_id: String!
    object_id: String!
    counter_term_id: String!
    creator_id: String!

    # Relationships
    subject: atoms!
    predicate: atoms!
    object: atoms!
    creator: accounts!
    term: terms!
    counter_term: terms!
    positions: [positions!]!
    counter_positions: [positions!]!
}

type positions {
    id: String!
    account_id: String!
    term_id: String!
    curve_id: Int!
    shares: String!

    # Relationships
    account: accounts!
    term: terms!
    vault: vaults!
}

type terms {
    id: String!
    type: term_type!
    atom_id: String
    triple_id: String
    total_assets: String
    total_market_cap: String

    # Relationships
    atom: atoms
    triple: triples
    positions: [positions!]!
    vaults: [vaults!]!
}

type vaults {
    term_id: String!
    curve_id: Int!
    total_shares: String!
    current_share_price: String!
    market_cap: String!
    position_count: Int!
}

type accounts {
    id: String!
    atom_id: String
    label: String!
    image: String
    type: account_type!

    # Relationships
    atom: atoms
    positions: [positions!]!
}
```

#### Common Query Patterns

**Get atom with trust data:**
```graphql
query GetAtomWithTrust($termId: String!, $hasTagId: String!, $trustworthyId: String!) {
    atom(term_id: $termId) {
        term_id
        label
        image
        as_subject_triples(where: {
            predicate_id: { _eq: $hasTagId },
            object_id: { _eq: $trustworthyId }
        }) {
            term_id
            term {
                vaults(where: { curve_id: { _eq: "1" } }) {
                    market_cap
                    position_count
                }
            }
        }
    }
}
```

**Get user's positions:**
```graphql
query GetUserPositions($userId: String!) {
    positions(where: { account_id: { _eq: $userId } }) {
        term_id
        shares
        term {
            type
            atom { label }
            triple {
                subject { label }
                predicate { label }
                object { label }
            }
            vaults(where: { curve_id: { _eq: "1" } }) {
                market_cap
                current_share_price
            }
        }
    }
}
```

**Get trust circle (follow-based):**
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
    }, order_by: { shares: desc }) {
        shares
        term {
            triple {
                object_id
                object { 
                    label  # ENS name or address
                    data   # EVM address for ENS-resolved atoms
                }
            }
        }
    }
}
```

**Note**: The followed account is the triple's **object**. For ENS-resolved atoms, extract the wallet address from `object.data`, not `object.label`. The label contains the ENS name for display purposes.

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-19 | AI-assisted | Initial comprehensive documentation |
| 1.1 | 2026-01-20 | AI-assisted | Added "Your Position" feature documentation; Fixed ENS address extraction patterns for trust circle; Updated `transaction.from` as primary user address source; Renamed "Trusted Contacts" to "Trust Circle"; Added stake-based sorting and label enrichment |
| 1.2 | 2026-05-30 | AI-assisted | Migrated the Snap's trust circle from `[X] → [hasTag] → [trustworthy]` to the canonical `[I] → [follow] → [target]` follow pattern (matching extension + explorer); updated trust-circle algorithm, glossary, and query examples |

---

## Acknowledgments

This document was created through extensive analysis of the Intuition and Hive Mind codebases, including:
- Smart contract source code and architecture
- Backend service implementations
- Frontend application patterns
- GraphQL schema and query patterns
- Documentation and inline comments

Special attention was given to the trust circle feature implementation, user position display, distribution analysis algorithms, and ENS identity resolution patterns.

---

## Part IX: Development Workflows

### Setting Up the Development Environment

#### Prerequisites

Before working with the Intuition ecosystem, ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| pnpm | 8+ | Package manager (for intuition-ts, hivemind-*) |
| yarn | 1.22+ | Package manager (for intuition-snap) |
| Rust | 1.70+ | Backend services (intuition-rs) |
| Foundry | Latest | Smart contract development |
| Docker | Latest | Local database and services |

#### Repository Setup

Each repository has its own setup process:

**intuition-contracts-v2:**
```bash
cd intuition-contracts-v2
foundryup                    # Update Foundry
forge install                # Install dependencies
forge build                  # Compile contracts
forge test                   # Run tests
```

**intuition-rs:**
```bash
cd intuition-rs
docker-compose up -d         # Start PostgreSQL
cargo build                  # Build all crates
cargo run -p consumer        # Run the consumer
```

**intuition-ts:**
```bash
cd intuition-ts
pnpm install                 # Install dependencies
pnpm build                   # Build all packages
pnpm test                    # Run tests
```

**intuition-snap:**
```bash
cd intuition-snap
yarn install                 # Install dependencies
yarn build:snap              # Build the Snap
yarn serve                   # Start development server
```

**hivemind-explorer:**
```bash
cd hivemind-explorer
pnpm install                 # Install dependencies
pnpm dev                     # Start development server
```

**hivemind-extension:**
```bash
cd hivemind-extension
pnpm install                 # Install dependencies
pnpm dev                     # Start Plasmo development
```

### Contract Development Workflow

#### Writing New Features

1. **Design the interface**: Update `IMultiVault.sol` with new function signatures
2. **Implement core logic**: Add implementation to `MultiVaultCore.sol` if shared
3. **Implement main logic**: Add public functions to `MultiVault.sol`
4. **Write tests**: Create unit tests in `tests/unit/`
5. **Run test suite**: `forge test -vvv`

#### Testing Patterns

```solidity
// tests/unit/MultiVaultTest.t.sol
contract MultiVaultDepositTest is BaseTest {
    function setUp() public override {
        super.setUp();
        // Setup test atoms, triples, etc.
    }

    function test_Deposit_Success() public {
        // Arrange
        uint256 depositAmount = 1 ether;
        uint256 termId = createTestAtom();

        // Act
        uint256 shares = multiVault.deposit{value: depositAmount}(
            address(this),
            termId,
            1, // curveId
            0  // minShares
        );

        // Assert
        assertGt(shares, 0, "Should receive shares");
        assertEq(
            multiVault.getPosition(address(this), termId, 1),
            shares,
            "Position should match shares"
        );
    }

    function test_Deposit_RevertWhen_BelowMinDeposit() public {
        // Arrange
        uint256 termId = createTestAtom();
        uint256 tooLow = multiVault.minDeposit() - 1;

        // Act & Assert
        vm.expectRevert("Deposit below minimum");
        multiVault.deposit{value: tooLow}(address(this), termId, 1, 0);
    }
}
```

#### Deployment Process

1. **Configure deployment settings** in `settings.json`
2. **Run deployment script**: `forge script script/intuition/Deploy.s.sol --broadcast`
3. **Verify contracts**: `forge verify-contract ...`
4. **Update ABI exports**: `bun extract-abis.ts`
5. **Update TypeScript packages**: Publish new `@0xintuition/protocol` version

### Backend Development Workflow

#### Adding New Event Handlers

1. **Define the event struct** in `models/src/events.rs`
2. **Add parsing logic** in `consumer/src/mode/events.rs`
3. **Implement handler** in `consumer/src/mode/handlers/`
4. **Update database migrations** if new tables needed
5. **Test locally** with Docker Compose

#### Resolver Development

The resolver enriches atom metadata asynchronously:

```rust
// consumer/src/mode/resolver/mod.rs
pub async fn resolve_atom(atom: &Atom, context: &ResolverContext) -> Result<ResolvedAtom> {
    match classify_atom(atom) {
        AtomType::Account => resolve_account(atom, context).await,
        AtomType::Url => resolve_url(atom, context).await,
        AtomType::Person => resolve_person(atom, context).await,
        _ => Ok(ResolvedAtom::default()),
    }
}

async fn resolve_account(atom: &Atom, context: &ResolverContext) -> Result<ResolvedAtom> {
    // Parse address from atom data
    let address = parse_address(&atom.data)?;

    // Try ENS resolution
    let ens = get_ens(address, context).await?;

    // Return resolved data
    Ok(ResolvedAtom {
        label: ens.name.unwrap_or_else(|| format!("{:?}", address)),
        image: ens.image,
        resolved_at: Some(Utc::now()),
    })
}
```

#### Database Migrations

```bash
# Create a new migration
cd hasura/migrations/intuition
mkdir $(date +%s)_description
echo "-- Migration: description" > $(date +%s)_description/up.sql
echo "-- Rollback: description" > $(date +%s)_description/down.sql

# Apply migrations
hasura migrate apply --database-name intuition
```

### Frontend Development Workflow

#### Component Development Pattern

```tsx
// src/components/AtomCard.tsx

/**
 * Displays an atom's basic information with optional staking controls.
 *
 * @param atom - The atom data to display
 * @param showStaking - Whether to show staking controls
 * @param onStake - Callback when user initiates a stake
 *
 * @example
 * <AtomCard
 *   atom={atomData}
 *   showStaking={true}
 *   onStake={(amount) => handleStake(amount)}
 * />
 */
export function AtomCard({
  atom,
  showStaking = false,
  onStake
}: AtomCardProps) {
  const { data: trustData, isLoading } = useAtomTrustData(atom.term_id);

  if (isLoading) {
    return <AtomCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <Avatar src={formatIpfsUrl(atom.image)} />
        <CardTitle>{atom.label}</CardTitle>
      </CardHeader>
      <CardContent>
        {trustData && (
          <TrustIndicator
            forAmount={trustData.forAmount}
            againstAmount={trustData.againstAmount}
          />
        )}
        {showStaking && (
          <StakingControls onStake={onStake} />
        )}
      </CardContent>
    </Card>
  );
}
```

#### Hook Development Pattern

```tsx
// src/hooks/useAtomTrustData.ts

/**
 * Fetches trust data for an atom including FOR and AGAINST positions.
 * Uses React Query for caching and deduplication.
 *
 * @param termId - The atom's term_id
 * @returns Query result with trust data
 */
export function useAtomTrustData(termId: string) {
  const { graphqlClient } = useIntuition();

  return useQuery({
    queryKey: ['atom-trust', termId],
    queryFn: async () => {
      const result = await graphqlClient.query({
        triples: {
          __args: {
            where: {
              subject_id: { _eq: termId },
              predicate_id: { _eq: HAS_TAG_ATOM_ID },
              object_id: { _eq: TRUSTWORTHY_ATOM_ID },
            }
          },
          term_id: true,
          term: {
            vaults: {
              market_cap: true,
            }
          },
          // ... more fields
        }
      });

      return transformTrustData(result.triples[0]);
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!termId,
  });
}
```

### Snap Development Workflow

#### Testing the Snap

1. **Build the Snap**: `yarn build:snap`
2. **Start local server**: `yarn serve`
3. **Install in MetaMask Flask**: Navigate to `localhost:8080` and click "Connect"
4. **Test transactions**: Initiate transactions in MetaMask to trigger insights

#### Debugging Tips

```typescript
// Add structured console logs for debugging
console.log('[FeatureName] Context:', JSON.stringify({
  key1: value1,
  key2: value2,
}, null, 2));

// Use the browser console to inspect Snap output
// MetaMask Flask shows Snap logs in the extension console
```

#### Snap Permissions

The Snap manifest (`snap.manifest.json`) declares required permissions:

```json
{
  "initialPermissions": {
    "endowment:transaction-insight": {},
    "endowment:network-access": {},
    "snap_manageState": {},
    "snap_notify": {}
  }
}
```

---

## Part X: Common Pitfalls and Solutions

### GraphQL Query Issues

#### Problem: "Field not found" Errors

When navigating nested relationships, the GraphQL schema requires correct traversal:

```graphql
# WRONG - positions don't directly have triple
positions(where: { triple: { predicate_id: { _eq: $id } } })

# CORRECT - navigate through term first
positions(where: {
  term: {
    triple: {
      predicate_id: { _eq: $id }
    }
  }
})
```

**Solution**: Always check the schema. Positions relate to terms, and terms can be atoms or triples.

#### Problem: Querying With a Non-Canonical Address

Indexed addresses are stored EIP-55 checksummed — the one canonical form. Passing a lowercased address to `_eq` matches nothing:

```graphql
# This fails — lowercased address won't match the checksummed row
atoms(where: { data: { _eq: "0xabc123..." } })

# Correct — exact match on the EIP-55 checksummed value
atoms(where: { data: { _eq: "0xAbC123..." } })
```

**Solution**: Run `viem.getAddress()` on every address at the boundary, then match with `_eq`. Never lowercase an address, and never use `_ilike` for address matching (`_ilike` is for fuzzy text/label search only).

#### Problem: Slow Queries

Complex queries with many nested relationships can be slow:

```graphql
# Slow - fetches everything
query {
  atoms(limit: 1000) {
    as_subject_triples {
      positions {
        account { positions { ... } }
      }
    }
  }
}
```

**Solution**:
- Limit result counts
- Use pagination
- Fetch only needed fields
- Split into multiple focused queries

### Smart Contract Integration Issues

#### Problem: Insufficient Value

Transaction reverts with "insufficient value" or similar:

```typescript
// WRONG - forgot fees
const tx = await multiVaultDeposit(walletClient, {
  args: [receiver, termId, curveId, minShares],
  value: depositAmount, // Missing entry fee
});

// CORRECT - include fees
const cost = await multiVaultPreviewDeposit(publicClient, {
  args: [depositAmount, termId, curveId],
});
const tx = await multiVaultDeposit(walletClient, {
  args: [receiver, termId, curveId, minShares],
  value: depositAmount + cost.fees,
});
```

**Solution**: Always use preview functions to calculate total cost including fees.

#### Problem: Slippage

Transaction reverts because share price changed:

```typescript
// WRONG - no slippage protection
const tx = await multiVaultDeposit(walletClient, {
  args: [receiver, termId, curveId, 0n], // minShares = 0
  value: depositAmount,
});

// CORRECT - calculate acceptable minimum
const preview = await multiVaultPreviewDeposit(publicClient, {
  args: [depositAmount, termId, curveId],
});
const minShares = (preview.shares * 99n) / 100n; // 1% slippage tolerance
const tx = await multiVaultDeposit(walletClient, {
  args: [receiver, termId, curveId, minShares],
  value: depositAmount,
});
```

**Solution**: Calculate expected shares and set `minShares` with slippage tolerance.

### MetaMask Snap Issues

#### Problem: Getting User Address in Snaps

In Snaps, `eth_accounts` doesn't work like in regular dapps—Snaps are not "connected" to accounts the way dapps are.

```typescript
// UNRELIABLE in Snap context
const accounts = await ethereum.request({ method: 'eth_accounts' });
// accounts may be undefined or empty

// RECOMMENDED - use transaction.from directly
const userAddress: string | undefined = transaction.from;
```

**Why `transaction.from` is reliable and secure:**
- MetaMask populates `transaction.from` from the user's permitted accounts list
- It's always an address the user controls (EOA they own)
- The dApp cannot spoof this—MetaMask validates it against the user's connected accounts
- For transaction insights, this is the most direct and reliable source

**Note**: `transaction.from` is the sender address for the transaction being reviewed, making it contextually correct for "your position" features.

#### Problem: State Persistence

Snap state doesn't persist correctly:

```typescript
// WRONG - using browser storage
localStorage.setItem('key', value); // Not available in Snaps

// CORRECT - use snap_manageState
await snap.request({
  method: 'snap_manageState',
  params: {
    operation: 'update',
    newState: { key: value }
  }
});
```

**Solution**: Use `snap_manageState` for persistent storage. It's limited to ~5MB.

#### Problem: Network Requests Blocked

External API calls fail:

```typescript
// MAY FAIL without permission
const response = await fetch('https://api.example.com/data');

// Check manifest has permission
// snap.manifest.json:
// "endowment:network-access": {}
```

**Solution**: Ensure `endowment:network-access` is in the Snap manifest.

### Extension Development Issues

#### Problem: Content Script Isolation

Content scripts can't access React context:

```typescript
// WRONG - trying to use React hook in content script
// content-script.ts
const { addToQueue } = useAtomQueue(); // This doesn't work

// CORRECT - use message passing
// content-script.ts
chrome.runtime.sendMessage({ type: 'ADD_TO_QUEUE', data: entityData });

// background.ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ADD_TO_QUEUE') {
    // Forward to sidepanel
  }
});
```

**Solution**: Content scripts communicate via Chrome messaging API.

#### Problem: Multiple Dev Servers

Changes not reflecting in the extension:

**Symptoms**:
- Code changes don't appear
- Old behavior persists
- Console logs don't show up

**Solution**:
1. Check for multiple terminal windows running `pnpm dev`
2. Kill all dev servers: `pkill -f plasmo`
3. Restart single dev server: `pnpm dev`
4. Reload the extension in Chrome

#### Problem: Ad-hoc Wallet Disconnection

Wallet state lost between sidepanel reopenings:

```typescript
// The background service maintains connection state
// web3-service.ts
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.walletConnected) {
    // Handle connection state change
  }
});
```

**Solution**: Persist wallet state in `chrome.storage.session` and restore on sidepanel open.

### ID Type Mismatches

#### Problem: term_id vs Wallet Address

Different parts of the system use different ID types:

| Context | ID Type | Example |
|---------|---------|---------|
| Atom identity | term_id | `0xfbdbc115dc...` |
| User/staker identity | wallet address | `0xb14f8ed6cf...` |
| Position lookup | account_id (wallet) | `0xb14f8ed6cf...` |
| Triple subject | term_id | `0xfbdbc115dc...` |
| ENS atom label | ENS name | `vitalik.eth` |
| ENS atom data | wallet address | `0xd8da6bf...` |

**Common mistake**:
```typescript
// WRONG - comparing term_id to wallet address
const isInTrustedCircle = trustedCircle.some(
  contact => contact.accountId === position.account_id
);
// If accountId is term_id and position.account_id is wallet, this never matches

// CORRECT - both are EIP-55 checksummed; compare canonical forms
const isInTrustedCircle = trustedCircle.some(
  contact => getAddress(contact.accountId) === getAddress(position.account_id)
);
```

**⚠️ For ENS-resolved atoms**: The wallet address is in `subject.data`, not `subject.label`. See the "Trust Circle" section for the correct extraction pattern.

**Solution**: Be explicit about ID types and normalize before comparison.

---

## Part XI: Testing Strategies

### Unit Testing

#### Smart Contracts

```solidity
// tests/unit/BondingCurveTest.t.sol
contract LinearCurveTest is BaseTest {
    function test_PreviewDeposit_LinearGrowth() public {
        // Test that share price grows linearly with deposits
        uint256 firstDeposit = 1 ether;
        uint256 firstShares = curve.previewDeposit(firstDeposit, 0);

        uint256 secondDeposit = 1 ether;
        uint256 secondShares = curve.previewDeposit(secondDeposit, firstShares);

        // Second deposit should get fewer shares due to higher price
        assertLt(secondShares, firstShares);
    }

    function testFuzz_Deposit_AlwaysPositiveShares(uint256 amount) public {
        // Bound to valid deposit range
        amount = bound(amount, minDeposit, 1000 ether);

        uint256 shares = curve.previewDeposit(amount, 0);
        assertGt(shares, 0);
    }
}
```

#### TypeScript

```typescript
// __tests__/distribution.test.ts
describe('calculateGini', () => {
  it('returns 0 for equal distribution', () => {
    const values = [100, 100, 100, 100];
    expect(calculateGini(values)).toBe(0);
  });

  it('returns ~1 for extreme inequality', () => {
    const values = [1000000, 1, 1, 1];
    expect(calculateGini(values)).toBeCloseTo(0.75, 1);
  });

  it('handles single staker', () => {
    const values = [1000];
    expect(calculateGini(values)).toBe(0); // Single value = no inequality
  });
});

describe('determineStatus', () => {
  it('returns Whale for 80%+ top-1', () => {
    const analysis = analyzeDistribution([1000000, 100, 50, 25]);
    expect(analysis.status).toBe('Whale Dominated');
  });

  it('returns Well Distributed for low Gini', () => {
    const analysis = analyzeDistribution([100, 95, 90, 85, 80]);
    expect(analysis.status).toBe('Well Distributed');
  });
});
```

### Integration Testing

#### API Integration

```typescript
// integration-tests/graphql.test.ts
describe('GraphQL API', () => {
  const client = new GraphQLClient(process.env.GRAPHQL_URL);

  it('fetches atom by term_id', async () => {
    const result = await client.query({
      atom: {
        __args: { term_id: KNOWN_ATOM_ID },
        term_id: true,
        label: true,
      }
    });

    expect(result.atom).toBeDefined();
    expect(result.atom.term_id).toBe(KNOWN_ATOM_ID);
  });

  it('finds trust triples', async () => {
    const result = await client.query({
      triples: {
        __args: {
          where: {
            predicate_id: { _eq: HAS_TAG_ATOM_ID },
            object_id: { _eq: TRUSTWORTHY_ATOM_ID },
          },
          limit: 10,
        },
        term_id: true,
        subject: { label: true },
      }
    });

    expect(result.triples.length).toBeGreaterThan(0);
  });
});
```

#### Contract Integration

```typescript
// integration-tests/multivault.test.ts
describe('MultiVault Integration', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;

  beforeAll(async () => {
    // Setup clients connected to testnet
  });

  it('creates atom and deposits', async () => {
    // Create atom
    const atomData = toHex('test-atom-' + Date.now());
    const createTx = await multiVaultCreateAtoms(walletClient, {
      address: CONTRACT_ADDRESS,
      args: [[atomData]],
      value: ATOM_CREATION_COST,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: createTx
    });
    const atomId = parseAtomCreatedEvent(receipt);

    // Deposit
    const depositTx = await multiVaultDeposit(walletClient, {
      address: CONTRACT_ADDRESS,
      args: [walletClient.account.address, atomId, 1n, 0n],
      value: parseEther('0.1'),
    });

    await publicClient.waitForTransactionReceipt({ hash: depositTx });

    // Verify position
    const position = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: multiVaultAbi,
      functionName: 'getPosition',
      args: [walletClient.account.address, atomId, 1n],
    });

    expect(position).toBeGreaterThan(0n);
  });
});
```

### End-to-End Testing

#### Explorer E2E

```typescript
// e2e/explorer.spec.ts
import { test, expect } from '@playwright/test';

test('search and view atom', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Search for an atom
  await page.fill('[data-testid="search-input"]', 'vitalik.eth');
  await page.click('[data-testid="search-button"]');

  // Wait for results
  await expect(page.locator('[data-testid="atom-card"]').first())
    .toBeVisible();

  // Click on result
  await page.click('[data-testid="atom-card"]');

  // Verify atom page
  await expect(page.locator('[data-testid="atom-title"]'))
    .toContainText('vitalik');
});

test('stake on trust triple', async ({ page }) => {
  // Connect wallet first
  await page.goto('http://localhost:5173');
  await page.click('[data-testid="connect-wallet"]');
  // ... wallet connection flow

  // Navigate to atom
  await page.goto('http://localhost:5173/atom/' + ATOM_ID);

  // Click stake FOR
  await page.click('[data-testid="stake-for-button"]');

  // Enter amount
  await page.fill('[data-testid="stake-amount"]', '0.1');

  // Confirm
  await page.click('[data-testid="confirm-stake"]');

  // Wait for transaction
  await expect(page.locator('[data-testid="tx-success"]'))
    .toBeVisible({ timeout: 30000 });
});
```

#### Snap E2E

Testing Snaps requires MetaMask Flask:

```typescript
// e2e/snap.spec.ts
import { test } from '@playwright/test';
import {
  installSnap,
  connectWallet,
  initiateTransaction
} from './helpers/metamask';

test('shows trust insight', async ({ page, context }) => {
  // Install Snap in MetaMask Flask
  await installSnap(context, SNAP_ID);

  // Connect wallet
  await connectWallet(page);

  // Initiate transaction to known address
  await initiateTransaction(page, {
    to: KNOWN_TRUSTED_ADDRESS,
    value: '0.01',
  });

  // Verify insight appears
  const insightPanel = await page.locator('[data-testid="snap-insight"]');
  await expect(insightPanel).toContainText('Trust');
  await expect(insightPanel).toContainText('Trusted');
});
```

---

## Part XII: Performance Optimization

### GraphQL Query Optimization

#### Batching Queries

```typescript
// BAD - separate queries
const atom = await queryAtom(termId);
const trustTriple = await queryTrustTriple(termId);
const positions = await queryPositions(termId);

// GOOD - single batched query
const result = await graphqlClient.query({
  atom: {
    __args: { term_id: termId },
    term_id: true,
    label: true,
  },
  triples: {
    __args: {
      where: {
        subject_id: { _eq: termId },
        predicate_id: { _eq: HAS_TAG_ID },
        object_id: { _eq: TRUSTWORTHY_ID },
      }
    },
    term_id: true,
    positions: { account_id: true, shares: true },
  },
});
```

#### Field Selection

```typescript
// BAD - over-fetching
const result = await graphqlClient.query({
  atoms: {
    __args: { limit: 100 },
    // All fields by default
  }
});

// GOOD - select only needed fields
const result = await graphqlClient.query({
  atoms: {
    __args: { limit: 100 },
    term_id: true,
    label: true,
    image: true,
    // Only what's displayed
  }
});
```

### React Query Optimization

#### Stale Time Configuration

```typescript
// Configure appropriate stale times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute for most data
      gcTime: 5 * 60 * 1000,     // 5 minutes garbage collection
    },
  },
});

// Override for specific queries
useQuery({
  queryKey: ['atom', termId],
  queryFn: fetchAtom,
  staleTime: 5 * 60 * 1000,     // 5 minutes for atom data (changes rarely)
});

useQuery({
  queryKey: ['positions', termId],
  queryFn: fetchPositions,
  staleTime: 30 * 1000,          // 30 seconds for positions (changes often)
});
```

#### Prefetching

```typescript
// Prefetch on hover
function AtomLink({ termId, children }) {
  const queryClient = useQueryClient();

  const prefetchAtom = () => {
    queryClient.prefetchQuery({
      queryKey: ['atom', termId],
      queryFn: () => fetchAtom(termId),
      staleTime: 60 * 1000,
    });
  };

  return (
    <Link
      to={`/atom/${termId}`}
      onMouseEnter={prefetchAtom}
    >
      {children}
    </Link>
  );
}
```

### Contract Call Optimization

#### Multicall

```typescript
import { multicall } from 'viem/actions';

// BAD - separate calls
const balance1 = await publicClient.readContract({ ... });
const balance2 = await publicClient.readContract({ ... });
const balance3 = await publicClient.readContract({ ... });

// GOOD - multicall
const results = await multicall(publicClient, {
  contracts: [
    { address, abi, functionName: 'balanceOf', args: [addr1] },
    { address, abi, functionName: 'balanceOf', args: [addr2] },
    { address, abi, functionName: 'balanceOf', args: [addr3] },
  ],
});
```

#### Caching Contract Data

```typescript
// Cache immutable contract data
const contractConfigCache = new Map();

async function getContractConfig(publicClient, address) {
  const cacheKey = `${address}`;

  if (contractConfigCache.has(cacheKey)) {
    return contractConfigCache.get(cacheKey);
  }

  const config = await publicClient.readContract({
    address,
    abi: multiVaultAbi,
    functionName: 'getGeneralConfig',
  });

  contractConfigCache.set(cacheKey, config);
  return config;
}
```

### Snap Performance

#### Parallel Fetches

```typescript
// GOOD - parallel fetches
const [accountData, originData, trustedCircle] = await Promise.all([
  getAccountData(transaction, chainId),
  getOriginData(transactionOrigin),
  userAddress ? getTrustedCircle(userAddress) : Promise.resolve([]),
]);

// BAD - sequential fetches
const accountData = await getAccountData(transaction, chainId);
const originData = await getOriginData(transactionOrigin);
const trustedCircle = userAddress ? await getTrustedCircle(userAddress) : [];
```

#### Trusted Circle Caching

```typescript
// Cache trusted circle for 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getTrustedCircle(userAddress: string): Promise<TrustedContact[]> {
  const cached = await getCachedTrustedCircle(userAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.contacts;
  }

  const contacts = await fetchTrustedCircleFromAPI(userAddress);
  await cacheTrustedCircle(userAddress, contacts);

  return contacts;
}
```

---

## Part XIII: Monitoring and Observability

### Metrics Collection

#### Backend Metrics (Rust)

```rust
// consumer/src/metrics.rs
use prometheus::{Counter, Histogram, register_counter, register_histogram};

lazy_static! {
    static ref EVENTS_PROCESSED: Counter = register_counter!(
        "intuition_events_processed_total",
        "Total number of events processed"
    ).unwrap();

    static ref EVENT_PROCESSING_TIME: Histogram = register_histogram!(
        "intuition_event_processing_seconds",
        "Time to process an event"
    ).unwrap();
}

pub fn record_event_processed(event_type: &str, duration: Duration) {
    EVENTS_PROCESSED.inc();
    EVENT_PROCESSING_TIME.observe(duration.as_secs_f64());
}
```

#### Frontend Metrics

```typescript
// Track key user actions
function trackStakeAction(termId: string, amount: bigint, isFor: boolean) {
  analytics.track('stake_action', {
    termId,
    amount: formatEther(amount),
    direction: isFor ? 'for' : 'against',
    timestamp: Date.now(),
  });
}

// Track performance
function trackQueryPerformance(queryName: string, duration: number) {
  analytics.track('query_performance', {
    query: queryName,
    durationMs: duration,
  });
}
```

### Error Tracking

#### Sentry Integration

```typescript
// Initialize Sentry
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Capture errors with context
function handleError(error: Error, context: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      component: context.component,
    },
  });
}
```

#### Error Boundaries

```tsx
// components/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Logging Standards

#### Structured Logging

```typescript
// Use consistent log format
const log = {
  info: (message: string, data?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },

  error: (message: string, error: Error, data?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
};

// Usage
log.info('[TrustedCircle] Fetched contacts', {
  userAddress,
  contactCount: contacts.length,
});

log.error('[TrustedCircle] Fetch failed', error, {
  userAddress,
});
```

---

## Part XIV: Deployment and Operations

### Deployment Environments

| Environment | Purpose | GraphQL URL |
|-------------|---------|-------------|
| Local | Development | http://localhost:8080/v1/graphql |
| Testnet | Testing | https://testnet.intuition.sh/v1/graphql |
| Mainnet | Production | https://mainnet.intuition.sh/v1/graphql |

### CI/CD Pipelines

#### Smart Contracts

```yaml
# .github/workflows/contracts.yml
name: Contracts CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge build
      - run: forge test -vvv

  deploy-testnet:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge script script/intuition/Deploy.s.sol --broadcast
        env:
          PRIVATE_KEY: ${{ secrets.DEPLOYER_KEY }}
          RPC_URL: ${{ secrets.TESTNET_RPC }}
```

#### Frontend Applications

```yaml
# .github/workflows/explorer.yml
name: Explorer CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_TOKEN }}
```

### Infrastructure

#### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: intuition
      POSTGRES_USER: intuition
      POSTGRES_PASSWORD: intuition
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  hasura:
    image: hasura/graphql-engine:v2.33.0
    depends_on:
      - postgres
    environment:
      HASURA_GRAPHQL_DATABASE_URL: postgres://intuition:intuition@postgres:5432/intuition
      HASURA_GRAPHQL_ENABLE_CONSOLE: "true"
    ports:
      - "8080:8080"

  consumer:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://intuition:intuition@postgres:5432/intuition
      RPC_URL: ${RPC_URL}
    command: cargo run -p consumer

volumes:
  postgres_data:
```

### Runbook: Common Operations

#### Backfilling Missing Data

```bash
# Run histocrawler to backfill from a specific block
cd intuition-rs
cargo run -p histocrawler -- --from-block 1000000 --to-block 2000000
```

#### Reprocessing Events

```bash
# Mark events for reprocessing
psql $DATABASE_URL -c "
  UPDATE events
  SET processed_at = NULL
  WHERE block_number BETWEEN 1000000 AND 1000100
"

# Consumer will automatically reprocess
```

#### Database Maintenance

```bash
# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE"

# Check index usage
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC
  LIMIT 20
"
```

---

## Part XV: Use Cases and Applications

### Trust and Reputation Systems

#### Personal Reputation

The most fundamental use case is building personal reputation. Users can:

1. **Create their identity atom**: Register their Ethereum address, ENS name, or social profile
2. **Accumulate trust signals**: Other users stake on their trustworthiness
3. **Build a trust graph**: The connections between trusters form a social network

Example workflow:
```
1. Alice creates an atom for her ENS: alice.eth
2. Bob, who knows Alice, stakes 100 TRUST on "alice.eth has tag trustworthy"
3. Charlie, who trusts Bob, sees Bob's stake when viewing Alice's profile
4. Charlie is more likely to trust Alice based on Bob's signal
```

This creates a web of trust where reputation propagates through connections.

#### Organization Verification

Organizations can use Intuition for:

1. **Team verification**: Create atoms for team members, link them with "works at" triples
2. **Role attestation**: Use triples like "Alice has role Developer" at "Protocol Inc"
3. **Credential verification**: Link educational credentials, certifications

```
Organization Atom: "Protocol Inc"
  ├── "Alice has role CTO at Protocol Inc"
  ├── "Bob has role Developer at Protocol Inc"
  └── "Protocol Inc has tag verified"
```

Stakeholders stake on these claims to signal their validity.

#### Project Trust Scores

For open source projects or DAOs:

1. **Create project atom**: The project's website, GitHub, or contract address
2. **Audit attestations**: Auditors stake on "Project X is audited"
3. **Community signals**: Users stake on security, usability, trustworthiness

The MetaMask Snap displays these signals when users interact with the project's contracts.

### Knowledge Curation

#### Fact Verification

Intuition can serve as a decentralized fact-checking layer:

1. **Create claim triples**: "Statement X is true/false"
2. **Experts stake**: Those with relevant expertise signal their belief
3. **Aggregate consensus**: The market cap shows collective belief strength

Example:
```
Subject: "Bitcoin whitepaper was published in 2008"
Predicate: "is"
Object: "factually accurate"

FOR vault: 1000 TRUST staked by 50 users
AGAINST vault: 10 TRUST staked by 2 users

→ Strong consensus that the claim is accurate
```

#### Content Categorization

Tagging and categorizing content:

1. **Tag triples**: "Article X has tag Topic Y"
2. **Community curation**: Users stake on relevant tags
3. **Weighted taxonomy**: Popular tags have higher stakes

This creates a decentralized, stake-weighted tagging system.

### DeFi Integration

#### Protocol Risk Assessment

DeFi protocols can integrate Intuition signals:

1. **Contract atoms**: Each contract address becomes an atom
2. **Security claims**: "Contract X is audited by Firm Y"
3. **Risk scoring**: Aggregate stakes inform risk models

```typescript
// Example: Check protocol trust before interacting
async function checkProtocolTrust(contractAddress: string) {
  const trustTriple = await getTrustTriple(contractAddress);

  if (!trustTriple || trustTriple.forMarketCap < MIN_TRUST_THRESHOLD) {
    showWarning("This protocol has low trust signals");
  }
}
```

#### Counterparty Assessment

For OTC or P2P trades:

1. **Trader reputation**: Users build reputation through successful trades
2. **Dispute resolution**: Staking on "User X is reliable trader"
3. **Collateral consideration**: Trust signals could inform collateral requirements

### Identity and Access Control

#### Decentralized Access Control

Using trust signals for access:

```typescript
// Gate access based on trust
async function checkAccess(userAddress: string): Promise<boolean> {
  // Get user's trust score
  const trustData = await getUserTrustData(userAddress);

  // Check if minimum stakers trust this user
  if (trustData.trustedByCount < MIN_TRUSTERS) {
    return false;
  }

  // Check if any known-good actors trust this user
  const knownGoodActors = ['0x...', '0x...'];
  const trustedByKnownGood = trustData.trusters.some(
    t => knownGoodActors.includes(getAddress(t))
  );

  return trustedByKnownGood;
}
```

#### Sybil Resistance

Trust signals provide sybil resistance:

1. **New accounts have no trust**: Fresh addresses lack social proof
2. **Trust is expensive**: Building fake reputation requires real stake
3. **Network effects**: Established trust networks are hard to fake

### Content Moderation

#### Decentralized Moderation

Instead of centralized moderation:

1. **Flag content**: Create triples like "Content X has tag harmful"
2. **Community signals**: Users stake on moderation decisions
3. **Weighted filtering**: Display based on aggregate signals

```typescript
// Filter content based on community signals
function filterContent(items: Content[], userTrustedCircle: string[]) {
  return items.filter(item => {
    const harmfulClaims = item.triples.filter(t =>
      t.predicate === 'has tag' && t.object === 'harmful'
    );

    // Check if anyone in user's trusted circle flagged this
    const flaggedByTrusted = harmfulClaims.some(claim =>
      claim.stakers.some(s => userTrustedCircle.includes(s))
    );

    return !flaggedByTrusted;
  });
}
```

#### Appeal Mechanism

When content is flagged:

1. **Counter-stake**: Content creators or supporters can stake AGAINST harmful claims
2. **Distributed decision**: Market dynamics determine outcome
3. **Transparent process**: All stakes and stakers are visible

### NFT and Token Authentication

#### Provenance Verification

For NFTs and collectibles:

1. **Authenticity claims**: "NFT X is authentic work by Artist Y"
2. **Artist endorsement**: Artists stake on their own works
3. **Collector verification**: Known collectors signal authentic pieces

#### Token Legitimacy

For new tokens:

1. **Legitimacy claims**: "Token X is official project token"
2. **Team attestation**: Team members stake on legitimacy
3. **Community verification**: Community members confirm or deny

---

## Part XVI: Ecosystem Governance

### Protocol Governance

#### Parameter Governance

Token holders can vote on:

1. **Fee adjustments**: Atom/triple creation fees, entry/exit fees
2. **Curve parameters**: Bonding curve slopes and shapes
3. **Minimum deposits**: Required minimums for various operations
4. **Protocol upgrades**: Smart contract upgrades

#### Governance Process

```
1. Proposal submitted on-chain
2. Discussion period (7 days)
3. Voting period (7 days)
4. Timelock (2 days)
5. Execution
```

Voting power is determined by veTRUST holdings (vote-escrowed TRUST).

### Treasury Management

#### Treasury Composition

The protocol treasury receives:

1. **Creation fees**: From atom and triple creation
2. **Protocol fees**: From vault entry/exit operations
3. **Slashed stakes**: From misbehaving nodes

#### Treasury Allocation

Treasury funds are allocated to:

1. **Development grants**: Teams building on Intuition
2. **Node incentives**: Rewards for running indexers
3. **Security audits**: Ongoing security reviews
4. **Liquidity provision**: Market making for TRUST token

### Node Operator Governance

#### Becoming a Node Operator

1. **Stake requirement**: Minimum TRUST stake as bond
2. **Hardware requirements**: Sufficient compute and storage
3. **Uptime requirements**: 99%+ availability
4. **Correct data**: Indexing accuracy checks

#### Slashing Conditions

Nodes can be slashed for:

1. **Downtime**: Extended unavailability
2. **Data inconsistency**: Serving incorrect data
3. **Censorship**: Refusing to index valid transactions

#### Node Selection

Clients select nodes based on:

1. **Stake weight**: Higher stake = more trust
2. **Historical performance**: Uptime and accuracy
3. **Geographic distribution**: Latency considerations

---

## Part XVII: Future Roadmap

### Near-term (2026)

#### Cross-Chain Expansion

1. **Multi-chain atoms**: Same entity, multiple chains
2. **Bridge integrations**: Trust data across chains
3. **L2 deployments**: Cheaper creation and staking on L2s

#### Enhanced Privacy

1. **Private positions**: ZK proofs for stake privacy
2. **Selective disclosure**: Reveal stakes only to trusted parties
3. **Anonymous reputation**: Prove reputation without revealing identity

### Medium-term (2026-2027)

#### AI Integration

1. **LLM training data**: Knowledge graph as training corpus
2. **Inference verification**: Using stakes to weight LLM outputs
3. **Automated curation**: AI-assisted claim verification

#### Advanced Economic Models

1. **Dynamic curves**: Curves that adapt to market conditions
2. **Prediction markets**: Claims with resolution criteria
3. **Insurance markets**: Stake-backed insurance products

### Long-term (2028+)

#### Decentralized Oracle Network

1. **Oracle integration**: Using stakes as oracle inputs
2. **Cross-protocol data**: Sharing trust data across DeFi
3. **Real-world integration**: Connecting to off-chain verification

#### Identity Standards

1. **W3C DID integration**: Standard identity documents
2. **Verifiable credentials**: Interoperable credentials
3. **Self-sovereign identity**: Full user control

---

## Part XVIII: Comparison with Related Systems

### vs. Traditional Reputation Systems

| Aspect | Traditional | Intuition |
|--------|-------------|-----------|
| Data ownership | Platform-owned | User-owned |
| Portability | Siloed | Universal |
| Transparency | Opaque algorithms | Open stakes |
| Manipulation | Easy (fake reviews) | Costly (requires stake) |
| Interoperability | None | Protocol-level |

### vs. Other Web3 Reputation Protocols

#### vs. Lens Protocol

- **Lens**: Social graph with follows and content
- **Intuition**: Knowledge graph with semantic claims
- **Overlap**: Both track social relationships
- **Difference**: Intuition adds economic signaling

#### vs. Gitcoin Passport

- **Gitcoin**: Sybil resistance through credential aggregation
- **Intuition**: Sybil resistance through economic stake
- **Overlap**: Both aim to verify identity
- **Difference**: Intuition is more expressive (any claim, not just identity)

#### vs. Ceramic/ComposeDB

- **Ceramic**: Decentralized data storage with schemas
- **Intuition**: Data storage + economic signaling layer
- **Overlap**: Both store structured data
- **Difference**: Intuition adds bonding curves and staking

### vs. Prediction Markets

#### vs. Polymarket

- **Polymarket**: Binary outcomes with resolution
- **Intuition**: Continuous signaling without fixed resolution
- **Overlap**: Both use markets for information
- **Difference**: Intuition claims persist; prediction markets resolve

#### vs. Augur

- **Augur**: Decentralized prediction market platform
- **Intuition**: Decentralized knowledge graph with staking
- **Overlap**: Both use economics for information revelation
- **Difference**: Intuition focuses on reputation, not prediction

---

## Part XIX: Mathematical Foundations

### Bonding Curve Mathematics

#### Linear Curve

The linear bonding curve follows:

```
P(S) = P₀ + k × S
```

Where:
- `P(S)` = Price at supply `S`
- `P₀` = Base price
- `k` = Slope coefficient
- `S` = Current supply (shares)

**Deposit calculation:**
```
shares = (√(2k × deposit + P₀²) - P₀) / k
```

**Redemption calculation:**
```
assets = (P(S_before) + P(S_after)) / 2 × shares_redeemed
```

#### Exponential Curve

```
P(S) = P₀ × e^(r × S)
```

Where:
- `r` = Growth rate

**Deposit calculation:**
```
shares = (1/r) × ln(1 + (r × deposit) / P₀)
```

#### Market Cap Calculation

For any curve:
```
MarketCap = ∫₀^S P(s) ds
```

For linear:
```
MarketCap = P₀ × S + (k × S²) / 2
```

### Gini Coefficient Mathematics

The Gini coefficient is calculated as:

```
G = (Σᵢ Σⱼ |xᵢ - xⱼ|) / (2n² × μ)
```

Where:
- `xᵢ, xⱼ` = Individual stake amounts
- `n` = Number of stakers
- `μ` = Mean stake

Alternative calculation using sorted values:
```
G = (2 × Σᵢ (i × xᵢ)) / (n × Σᵢ xᵢ) - (n + 1) / n
```

### Nakamoto Coefficient

```
N = min{k : Σᵢ₌₁^k xᵢ ≥ 0.51 × Σᵢ xᵢ}
```

Where values are sorted in descending order.

### Trust Propagation

Trust can propagate through the network. A simple model:

```
Trust(A→C) = max(Trust(A→B) × Trust(B→C)) for all B
```

More sophisticated models use:
- Decay factors for distance
- Stake weighting for signal strength
- Negative signals for distrust

---

## Part XX: Community and Resources

### Official Channels

| Channel | Purpose | URL |
|---------|---------|-----|
| Website | Main information | https://intuition.systems |
| Documentation | Technical docs | https://docs.intuition.systems |
| GitHub | Source code | https://github.com/0xintuition |
| Discord | Community chat | [Discord invite] |
| Twitter/X | Announcements | @0xintuition |

### Developer Resources

#### SDKs and Libraries

- **@0xintuition/protocol**: Smart contract interactions
- **@0xintuition/graphql**: GraphQL client
- **@0xintuition/sdk**: High-level SDK
- **@0xintuition/1ui**: UI components

#### API Endpoints

| Network | GraphQL | RPC |
|---------|---------|-----|
| Mainnet | https://mainnet.intuition.sh/v1/graphql | https://rpc.intuition.systems |
| Testnet | https://testnet.intuition.sh/v1/graphql | https://testnet.rpc.intuition.systems |

#### Example Code

The repositories contain examples:
- `intuition-ts/apps/cli`: Command-line interface
- `intuition-ts/apps/nextjs-template`: Next.js starter
- `hivemind-explorer/examples`: Query examples

### Contributing

#### Contribution Process

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request
5. Address review feedback
6. Merge upon approval

#### Code Standards

- TypeScript strict mode
- Comprehensive JSDoc comments
- Unit tests for new features
- Integration tests for APIs
- E2E tests for user flows

### Bug Bounty Program

The protocol maintains a bug bounty program:

| Severity | Reward |
|----------|--------|
| Critical | Up to $100,000 |
| High | Up to $25,000 |
| Medium | Up to $5,000 |
| Low | Up to $1,000 |

Report security issues to security@intuition.systems.

---

## Part XXI: Troubleshooting Guide

### Common Issues and Solutions

#### Issue: "Atom already exists" Error

**Symptom**: Transaction reverts when creating an atom

**Cause**: The atom data has already been registered on-chain

**Solution**:
```typescript
// Check if atom exists before creating
import { findAtomIds } from '@0xintuition/sdk/experimental';

const existingAtoms = await findAtomIds(graphqlClient, [atomData]);
if (existingAtoms[0]) {
  console.log('Atom exists with term_id:', existingAtoms[0]);
  // Use existing atom instead of creating
} else {
  // Safe to create
  await createAtom(atomData);
}
```

**Prevention**: Always check for existence before creation in your UI flows.

#### Issue: Transaction Stuck Pending

**Symptom**: Transaction doesn't confirm for extended period

**Possible Causes**:
1. Gas price too low
2. Nonce gap from previous failed transaction
3. Network congestion

**Solutions**:
```typescript
// 1. Speed up with higher gas
const speedUpTx = await walletClient.sendTransaction({
  ...originalTx,
  nonce: originalNonce,
  maxFeePerGas: originalMaxFee * 2n,
});

// 2. Cancel with same nonce
const cancelTx = await walletClient.sendTransaction({
  to: walletClient.account.address,
  value: 0n,
  nonce: originalNonce,
  maxFeePerGas: originalMaxFee * 2n,
});
```

#### Issue: GraphQL Query Timeout

**Symptom**: Queries fail with timeout errors

**Possible Causes**:
1. Query too complex
2. Missing indexes on queried fields
3. Server overload

**Solutions**:
```typescript
// 1. Add pagination
const result = await client.query({
  atoms: {
    __args: {
      limit: 50,
      offset: 0,
      // Instead of fetching 10,000 at once
    },
    term_id: true,
  }
});

// 2. Reduce field selection
const result = await client.query({
  atoms: {
    term_id: true,
    label: true,
    // Only essential fields
  }
});

// 3. Add where clauses to reduce result set
const result = await client.query({
  atoms: {
    __args: {
      where: {
        type: { _eq: 'Account' },
        // Narrow the search
      }
    },
    term_id: true,
  }
});
```

#### Issue: Position Not Showing After Deposit

**Symptom**: Deposited funds but position doesn't appear in queries

**Cause**: Indexer delay - the backend hasn't processed the blockchain event yet

**Solution**:
```typescript
// Wait for indexer to process (typically 4-10 seconds)
await new Promise(resolve => setTimeout(resolve, 5000));

// Then invalidate cache and refetch
await queryClient.invalidateQueries({ queryKey: ['positions', termId] });

// Or poll until position appears
async function waitForPosition(termId: string, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const position = await fetchPosition(termId);
    if (position && position.shares > 0n) {
      return position;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Position not found after waiting');
}
```

#### Issue: Wallet Not Connecting in Extension

**Symptom**: Connect wallet button doesn't work or fails silently

**Possible Causes**:
1. Multiple wallet extensions conflicting
2. MetaMask locked
3. Extension permissions not granted

**Solutions**:
1. Disable other wallet extensions temporarily
2. Unlock MetaMask and ensure correct network
3. Clear extension storage and reinstall

```typescript
// In extension, use ad-hoc connection pattern
import { createWalletClient, custom } from 'viem';

const connectWallet = async () => {
  try {
    // Request accounts
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned');
    }

    // Create client
    const client = createWalletClient({
      account: accounts[0],
      transport: custom(window.ethereum),
    });

    return client;
  } catch (error) {
    if (error.code === 4001) {
      // User rejected connection
      console.log('User rejected wallet connection');
    } else {
      console.error('Wallet connection failed:', error);
    }
    throw error;
  }
};
```

#### Issue: Snap Not Showing Insights

**Symptom**: MetaMask transactions don't show Intuition insights panel

**Possible Causes**:
1. Snap not installed
2. Snap disabled
3. Transaction to unsupported chain
4. Snap crashed

**Solutions**:
1. Reinstall Snap from the Snap store
2. Enable in MetaMask settings
3. Ensure transaction is on Intuition-supported chain
4. Check Snap logs in MetaMask developer mode

```typescript
// Verify Snap installation
const checkSnapInstalled = async () => {
  const snaps = await ethereum.request({
    method: 'wallet_getSnaps'
  });

  return snaps[SNAP_ID] !== undefined;
};
```

#### Issue: IPFS Images Not Loading

**Symptom**: Atom images show broken or don't load

**Cause**: Direct IPFS URLs not supported in browser

**Solution**:
```typescript
// Convert IPFS URLs to gateway URLs
function formatImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }

  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return `https://ipfs.io/ipfs/${url}`;
  }

  return url;
}

// Usage
<Avatar src={formatImageUrl(atom.image)} />
```

#### Issue: Chain ID Mismatch

**Symptom**: Transactions fail with wrong chain error

**Cause**: Wallet connected to different chain than expected

**Solution**:
```typescript
// Check and switch chain
async function ensureCorrectChain(expectedChainId: number) {
  const currentChainId = await walletClient.getChainId();

  if (currentChainId !== expectedChainId) {
    try {
      await walletClient.switchChain({ id: expectedChainId });
    } catch (error) {
      if (error.code === 4902) {
        // Chain not added to wallet, add it
        await walletClient.addChain({
          chain: intuitionChain,
        });
        await walletClient.switchChain({ id: expectedChainId });
      } else {
        throw error;
      }
    }
  }
}
```

### Debugging Techniques

#### Enable Verbose Logging

```typescript
// Add to entry point for development
if (process.env.NODE_ENV === 'development') {
  // Log all GraphQL queries
  const originalQuery = graphqlClient.query;
  graphqlClient.query = async (q) => {
    console.log('[GraphQL Query]', JSON.stringify(q, null, 2));
    const result = await originalQuery(q);
    console.log('[GraphQL Result]', JSON.stringify(result, null, 2));
    return result;
  };
}
```

#### Inspect React Query State

```typescript
// In React DevTools, find QueryClientProvider
// Or add this utility component
function QueryDebugger() {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('Query cache:', queryClient.getQueryCache().getAll());
  }, []);

  return null;
}
```

#### Trace Contract Calls

```typescript
// Wrap contract calls with tracing
async function traceContractCall<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  console.log(`[Contract] ${name} starting`);
  const start = Date.now();

  try {
    const result = await fn();
    console.log(`[Contract] ${name} completed in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`[Contract] ${name} failed:`, error);
    throw error;
  }
}

// Usage
const shares = await traceContractCall('deposit', () =>
  multiVaultDeposit(walletClient, { ... })
);
```

---

## Part XXII: API Reference Summary

### GraphQL Queries

#### Atoms

```graphql
# Get atom by term_id
query GetAtom($termId: String!) {
  atom(term_id: $termId) {
    term_id
    label
    image
    data
    type
    creator_id
    resolving_status
  }
}

# Search atoms
query SearchAtoms($query: String!, $limit: Int = 20) {
  atoms(
    where: { _or: [
      { label: { _ilike: $query } },
      { data: { _ilike: $query } }
    ] },
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

# Get atoms with trust data
query GetAtomsWithTrust($termIds: [String!]!, $predicateId: String!, $objectId: String!) {
  atoms(where: { term_id: { _in: $termIds } }) {
    term_id
    label
    as_subject_triples(where: {
      predicate_id: { _eq: $predicateId },
      object_id: { _eq: $objectId }
    }) {
      term_id
      term {
        vaults(where: { curve_id: { _eq: "1" } }) {
          market_cap
          position_count
        }
      }
    }
  }
}
```

#### Triples

```graphql
# Get triple by components
query GetTriple($subjectId: String!, $predicateId: String!, $objectId: String!) {
  triples(where: {
    subject_id: { _eq: $subjectId },
    predicate_id: { _eq: $predicateId },
    object_id: { _eq: $objectId }
  }) {
    term_id
    counter_term_id
    subject { label }
    predicate { label }
    object { label }
    term {
      vaults(where: { curve_id: { _eq: "1" } }) {
        market_cap
        position_count
      }
    }
  }
}

# Get triple with positions
query GetTripleWithPositions($termId: String!) {
  triple(term_id: $termId) {
    term_id
    subject { label }
    predicate { label }
    object { label }
    positions {
      account_id
      shares
      account {
        label
        image
      }
    }
    counter_positions {
      account_id
      shares
      account {
        label
        image
      }
    }
  }
}
```

#### Positions

```graphql
# Get user positions
query GetUserPositions($userId: String!) {
  positions(
    where: { account_id: { _eq: $userId } },
    order_by: [{ shares: desc }]
  ) {
    term_id
    shares
    term {
      type
      atom { label image }
      triple {
        subject { label }
        predicate { label }
        object { label }
      }
      vaults(where: { curve_id: { _eq: "1" } }) {
        current_share_price
        market_cap
      }
    }
  }
}

# Get positions on a term
query GetTermPositions($termId: String!, $limit: Int = 50) {
  positions(
    where: { term_id: { _eq: $termId } },
    order_by: [{ shares: desc }],
    limit: $limit
  ) {
    account_id
    shares
    account {
      label
      image
    }
  }
}
```

### Contract Functions

#### Read Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getAtom` | `termId` | `Atom` | Get atom data |
| `getTriple` | `termId` | `Triple` | Get triple data |
| `getPosition` | `account, termId, curveId` | `shares` | Get position shares |
| `getVault` | `termId, curveId` | `Vault` | Get vault state |
| `previewDeposit` | `assets, termId, curveId` | `shares` | Preview deposit |
| `previewRedeem` | `shares, termId, curveId` | `assets` | Preview redemption |
| `getAtomCost` | - | `cost` | Get atom creation cost |
| `getTripleCost` | - | `cost` | Get triple creation cost |

#### Write Functions

| Function | Parameters | Value | Description |
|----------|------------|-------|-------------|
| `createAtoms` | `bytes[] data` | Creation cost | Create atoms |
| `createTriples` | `uint256[] subjectIds, predicateIds, objectIds` | Creation cost | Create triples |
| `deposit` | `receiver, termId, curveId, minShares` | Deposit amount | Stake on term |
| `redeem` | `shares, receiver, termId, curveId, minAssets` | 0 | Unstake from term |
| `batchDeposit` | `receivers[], termIds[], curveIds[], minShares[]` | Total deposit | Batch stake |
| `batchRedeem` | `shares[], receivers[], termIds[], curveIds[], minAssets[]` | 0 | Batch unstake |

#### Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `AtomCreated` | `termId, creator, data, wallet` | Emitted when atom is created |
| `TripleCreated` | `termId, subjectId, predicateId, objectId, creator` | Emitted when triple is created |
| `Deposited` | `sender, receiver, termId, curveId, assets, shares` | Emitted on deposit |
| `Redeemed` | `sender, receiver, termId, curveId, assets, shares` | Emitted on redemption |
| `FeeTransfer` | `sender, receiver, termId, amount, feeType` | Emitted when fees are transferred |

---

## Part XXIII: Data Schemas

### Atom Data Formats

#### Account (Ethereum Address)

```json
{
  "@type": "Account",
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

Or simply the raw address string:
```
0x1234567890abcdef1234567890abcdef12345678
```

#### Person (schema.org)

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Alice Developer",
  "description": "Blockchain engineer and open source contributor",
  "image": "https://example.com/alice.jpg",
  "sameAs": [
    "https://twitter.com/alicedev",
    "https://github.com/alicedev"
  ]
}
```

#### Organization (schema.org)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Protocol Labs",
  "description": "Building the next generation of the internet",
  "url": "https://protocol.ai",
  "logo": "https://protocol.ai/logo.png"
}
```

#### URL

```json
{
  "@type": "URL",
  "url": "https://example.com/page"
}
```

Or simply:
```
https://example.com/page
```

#### Generic Thing

```json
{
  "@context": "https://schema.org",
  "@type": "Thing",
  "name": "Trustworthy",
  "description": "A tag indicating something is considered trustworthy"
}
```

### Triple Semantic Patterns

#### Trust/Reputation

```
Subject: [Person/Organization/Address atom]
Predicate: "has tag" atom (0x6de69cc0ae...)
Object: "trustworthy" atom (0xe9c0e287...)
```

#### Affiliation

```
Subject: [Person atom]
Predicate: "works at" atom
Object: [Organization atom]
```

#### Categorization

```
Subject: [Any atom]
Predicate: "has tag" atom
Object: [Category atom]
```

#### Alias/Alternative Name

```
Subject: [Entity atom]
Predicate: "has alias" atom (0xf8cfb4e3...)
Object: [Name/Label atom]
```

### Position Data Structure

When querying positions, you receive:

```typescript
interface Position {
  id: string;                    // Unique position identifier
  account_id: string;            // Wallet address of the staker
  term_id: string;               // The term (atom or triple) being staked on
  curve_id: number;              // Bonding curve ID (usually 1)
  shares: string;                // Number of shares owned (as string for precision)

  // Relationships (when included in query)
  account?: {
    id: string;
    label: string;
    image: string;
  };
  term?: {
    type: 'atom' | 'triple';
    atom?: Atom;
    triple?: Triple;
    vaults: Vault[];
  };
  vault?: Vault;
}
```

### Vault Data Structure

```typescript
interface Vault {
  term_id: string;               // The term this vault belongs to
  curve_id: number;              // Bonding curve ID
  total_shares: string;          // Total shares issued
  current_share_price: string;   // Current price per share in wei
  market_cap: string;            // Total value locked in wei
  position_count: number;        // Number of unique stakers
}
```

### Account Data Structure

```typescript
interface Account {
  id: string;                    // Wallet address
  atom_id: string | null;        // Associated atom term_id (if exists)
  label: string;                 // Display name (ENS or address)
  image: string | null;          // Avatar URL
  type: 'Default' | 'AtomWallet' | 'ProtocolVault';

  // Relationships
  atom?: Atom;
  positions?: Position[];
}
```

---

## Part XXIV: Glossary of Abbreviations

For quick reference, here are common abbreviations used throughout the codebase and documentation:

| Abbreviation | Full Form | Context |
|--------------|-----------|---------|
| API | Application Programming Interface | GraphQL API, REST API |
| ABI | Application Binary Interface | Smart contract interface |
| CAIP | Chain Agnostic Improvement Proposal | Cross-chain addressing |
| CAIP-10 | CAIP for Account IDs | Format: `eip155:chainId:address` |
| CI/CD | Continuous Integration/Continuous Deployment | Automation pipelines |
| DAO | Decentralized Autonomous Organization | Governance structure |
| DeFi | Decentralized Finance | Financial protocols |
| DID | Decentralized Identifier | W3C identity standard |
| E2E | End-to-End | Testing methodology |
| ENS | Ethereum Name Service | Human-readable addresses |
| EOA | Externally Owned Account | Regular wallet (vs contract) |
| ERC | Ethereum Request for Comments | Token standards |
| ERC-20 | Fungible Token Standard | TRUST token |
| ERC-4626 | Tokenized Vault Standard | Vault implementation |
| EVM | Ethereum Virtual Machine | Smart contract runtime |
| GQL | GraphQL | Query language |
| IPFS | InterPlanetary File System | Decentralized storage |
| JSON-LD | JSON for Linking Data | Structured data format |
| L2 | Layer 2 | Scaling solution |
| LLM | Large Language Model | AI models |
| MEV | Maximal Extractable Value | Block ordering value |
| MCP | Model Context Protocol | AI tool protocol |
| NFT | Non-Fungible Token | Unique tokens |
| OTC | Over-The-Counter | Direct trading |
| P2P | Peer-to-Peer | Direct connections |
| RPC | Remote Procedure Call | Blockchain node interface |
| SDK | Software Development Kit | Developer libraries |
| SSR | Server-Side Rendering | React rendering mode |
| TTL | Time To Live | Cache duration |
| UI/UX | User Interface/User Experience | Design |
| veTRUST | Vote-Escrowed TRUST | Locked governance token |
| ZK | Zero-Knowledge | Privacy proofs |

---

## Part XXV: Frequently Asked Questions

### General Questions

**Q: What is Intuition?**
A: Intuition is a decentralized protocol for creating and querying a global knowledge graph. It allows anyone to make claims about anything and back those claims with economic stake, creating a permissionless reputation and knowledge system.

**Q: How is Intuition different from traditional rating systems?**
A: Unlike traditional ratings (stars, upvotes), Intuition signals require economic stake. This makes false information costly to create and maintain, while rewarding accurate information discovery.

**Q: Can I use Intuition without holding TRUST tokens?**
A: You can read data from the knowledge graph without tokens. However, creating atoms, triples, or staking requires TRUST tokens.

**Q: Is my data on-chain or off-chain?**
A: Core data (atoms, triples, positions) is on-chain. Metadata enrichment (ENS names, IPFS content) is resolved off-chain and stored in the indexer database.

### Technical Questions

**Q: Why does the indexer have a delay?**
A: The indexer must process blockchain events, resolve metadata, and update the database. This typically takes 4-10 seconds after a transaction confirms.

**Q: Can I run my own node?**
A: Yes, the intuition-rs codebase is open source. You can run your own consumer, resolver, and Hasura instance.

**Q: How do I handle IPFS images?**
A: Convert `ipfs://` URLs to gateway URLs: `ipfs://QmHash` → `https://ipfs.io/ipfs/QmHash`

**Q: What's the difference between term_id and id?**
A: `term_id` is the deterministic hash of content (atoms/triples). `id` in some contexts is a database primary key. Use `term_id` for protocol operations.

### Economic Questions

**Q: How is share price determined?**
A: Share prices follow bonding curves. The more stake in a vault, the higher the share price. Early stakers get more shares per TRUST.

**Q: What happens to my stake if I'm wrong?**
A: Your stake remains until you redeem. If others disagree, they stake on the counter-vault. Your stake value may decrease if others redeem, but you don't lose tokens unless you redeem at a loss.

**Q: Are there fees?**
A: Yes. Entry fees go to existing stakers. Exit fees go partly to remaining stakers and partly to the protocol. Creation fees go to the protocol treasury.

### MetaMask Snap Questions

**Q: Does the Snap work with regular MetaMask?**
A: Currently, Snaps require MetaMask Flask (developer version) or wait for Snaps to be fully released in production MetaMask.

**Q: Can the Snap modify my transactions?**
A: No. The Snap only provides insights. It cannot modify, block, or auto-approve transactions.

**Q: What data does the Snap access?**
A: The Snap sees: destination address, transaction origin (dApp URL), and optionally the connected account. It queries public Intuition data about these addresses.

---

## Conclusion

The Intuition Protocol and Hive Mind ecosystem represent a comprehensive approach to decentralized knowledge management and trust signaling. From the foundational smart contracts through the backend indexing services to the user-facing applications, each component plays a crucial role in the overall system.

### Key Architectural Decisions

1. **Content-addressed identity**: Using `keccak256` hashes ensures deterministic, collision-free identifiers.

2. **Term abstraction**: Unifying atoms and triples under a single "term" concept simplifies vault and position management.

3. **Bonding curves**: Dynamic pricing creates market incentives for information discovery while preventing manipulation.

4. **Counter-vaults**: Enabling both FOR and AGAINST positions allows nuanced expression of belief.

5. **Economic signals**: Requiring stake for all signals makes information costly to fake.

### Future Considerations

As the ecosystem evolves, consider:

1. **Cross-chain expansion**: Supporting atoms and triples on multiple chains
2. **Privacy features**: Zero-knowledge proofs for private signaling
3. **Advanced curves**: More sophisticated bonding curve formulas
4. **Social features**: Direct messaging between stakers
5. **AI integration**: Using knowledge graph data to train models

### Resources

- **Protocol documentation**: https://docs.intuition.systems
- **API reference**: https://mainnet.intuition.sh/graphql
- **GitHub repositories**: https://github.com/0xintuition
- **Community**: Discord, Twitter, Telegram

---

*This document was generated through comprehensive analysis of the Intuition and Hive Mind codebases. It reflects the state of the system as of January 2026 and should be updated as the protocol evolves.*

---

*End of Document*
