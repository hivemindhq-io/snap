# Hive Mind Explorer Glossary

> A comprehensive glossary of terms used in the Hive Mind Explorer and Intuition Protocol ecosystem.

**Last Updated:** November 29, 2025

---

## Table of Contents

1. [Intuition Protocol Core Concepts](#intuition-protocol-core-concepts)
2. [Economic & Tokenomics Terms](#economic--tokenomics-terms)
3. [Technical Infrastructure](#technical-infrastructure)
4. [Smart Contract Terms](#smart-contract-terms)
5. [Data & API Terms](#data--api-terms)
6. [Frontend & UI Terms](#frontend--ui-terms)
7. [Web3 & Blockchain Terms](#web3--blockchain-terms)
8. [Abbreviations & Acronyms](#abbreviations--acronyms)

---

## Intuition Protocol Core Concepts

### Atom
The **fundamental unit** of information in the Intuition knowledge graph. An atom represents a discrete entity, concept, or idea that can be referenced and combined to form triples.

**Types of Atoms:**
- **Person Atom**: Represents an individual (e.g., "Vitalik Buterin")
- **Organization Atom**: Represents a company, DAO, or institution
- **Thing Atom**: Generic object or concept
- **Account Atom**: Represents a blockchain address
- **Predicate Atom**: Special atom defining relationships (e.g., "is", "trusts", "owns")

**On-chain Properties:**
- `term_id`: Unique on-chain identifier
- `data`: IPFS hash, URL, or direct data pointer
- `creator_id`: Address that created the atom
- `vault_id`: Associated vault for staking

---

### Triple
A **semantic statement** connecting three atoms in Subject-Predicate-Object structure. Triples express claims or relationships in the knowledge graph.

**Structure:**
```
[Subject Atom] → [Predicate Atom] → [Object Atom]
"Ethereum"     → "is"             → "decentralized"
```

**Key Properties:**
- Has TWO vaults (Support Vault and Counter Vault)
- Can be staked FOR (support) or AGAINST (dispute)
- Creates a natural prediction market for truth

---

### Knowledge Graph
The **interconnected network** of atoms and triples that forms Intuition's decentralized database of information. Unlike traditional databases, the knowledge graph:
- Is permissionless (anyone can add data)
- Is economically weighted (stakes indicate importance)
- Is semantically structured (RDF-like relationships)

---

### Claim
Synonym for **Triple**. A statement asserting a relationship between entities. Claims are neither automatically true nor false—their validity is determined by community staking.

---

### Counter-Triple
The **negation** of a triple. Every triple automatically has a counter-triple representing the opposite claim. Staking on the counter-triple means you dispute the original claim.

---

### Identity
In Intuition context, refers to an **Atom representing a person, organization, or account**. Identities can accumulate reputation through associated triples and stakes.

---

## Economic & Tokenomics Terms

### TRUST
The **native ERC-20 governance and utility token** of the Intuition network. Used for:
- Creating atoms and triples (creation fees)
- Staking on claims (economic signaling)
- Governance voting
- Node operator bonding

**Note:** On testnet, the token is called **tTRUST** (test TRUST).

---

### Vault
An **economic container** that holds staked funds for an atom or triple. Vaults:
- Issue shares to stakers based on bonding curves
- Track Total Value Locked (TVL)
- Manage entry and exit fees
- Distribute fees to existing shareholders

**Vault Types:**
- **Atom Vault**: Single vault per atom
- **Support Vault**: For stakes supporting a triple
- **Counter Vault**: For stakes opposing a triple

---

### Staking
The act of **depositing tokens** into a vault to signal belief or conviction. Staking:
- Adds economic weight to information
- Earns rewards from entry fees paid by later stakers
- Influences visibility and ranking
- Builds on-chain reputation

---

### Shares
**Units of ownership** in a vault. When you stake, you receive shares proportional to your deposit and the current share price. Shares:
- Represent your claim to the vault's assets
- Can be redeemed for underlying tokens (minus exit fees)
- Price is determined by the bonding curve

---

### Bonding Curve
A **mathematical function** that determines share prices based on supply. As more people stake, the price increases.

**Curve Types:**
| Type | Formula | Characteristics |
|------|---------|-----------------|
| **Linear** | P = mx + b | Steady, predictable |
| **Exponential/Quadratic** | P = ax² | Rewards early stakers heavily |
| **Sigmoid** | P = L/(1+e^(-k(x-x₀))) | S-curve with plateau |

---

### Entry Fee
Fee paid **when depositing** into a vault. Distributed pro-rata to existing shareholders. Incentivizes early staking.

---

### Exit Fee
Fee paid **when redeeming** shares from a vault. Distributed to remaining shareholders. Discourages rapid speculation.

---

### Protocol Fee
A percentage of fees that goes to the **Intuition protocol treasury** for development and operations.

---

### TVL (Total Value Locked)
The **total amount of tokens** staked in a vault or across the entire protocol.

---

### Share Price
The **current cost** to acquire one share in a vault. Determined by the bonding curve formula based on total shares outstanding.

---

### Market Cap
For vaults: `Total Shares × Current Share Price`. Indicates the total economic weight behind an atom or triple.

---

### Position
A user's **staking record** in a specific vault, including:
- Number of shares owned
- Total assets deposited
- Unrealized gains/losses

---

### Signal
An **economic action** (deposit or redemption) that indicates sentiment. Signals are tracked as events and contribute to trend analysis.

---

### Relative Strength
A metric indicating **how strong** a signal is relative to the vault's total activity. High relative strength = significant conviction.

---

### veTRUST (Vote-Escrowed TRUST)
TRUST tokens **locked for a period** in exchange for:
- Boosted voting power
- Higher reward multipliers
- Governance participation rights

Inspired by Curve's veTokenomics model.

---

### Emissions
**New tokens distributed** over time as rewards. Intuition uses a decaying emission schedule that front-loads rewards to early participants.

---

### System Utilization
A protocol-level metric measuring **overall network usage**. Affects emission rates—if utilization is low, emissions slow down to prevent inflation without value creation.

---

### Personal Utilization
An individual user's **activity level** that affects their reward eligibility. Active curators earn more than passive stakers.

---

## Technical Infrastructure

### MultiVault
The **main smart contract** that manages all vaults, atoms, and triples. Single contract architecture for gas efficiency.

---

### Hasura
An **open-source GraphQL engine** that sits on top of PostgreSQL. Intuition uses Hasura to expose indexed blockchain data via GraphQL API.

---

### Indexer
A service (written in Rust in `intuition-rs`) that **reads blockchain events** and stores structured data in a database for efficient querying.

---

### Consumer
A component in `intuition-rs` that **processes events** from the blockchain. Types:
- **Raw Consumer**: Processes raw blockchain events
- **Decoded Consumer**: Interprets event data
- **Resolver**: Enriches data with metadata

---

### IPFS (InterPlanetary File System)
A **distributed storage network** used to store atom metadata (JSON-LD documents, images). Atoms reference IPFS via `ipfs://` URIs.

---

### IPFS Gateway
An HTTP service that allows **fetching IPFS content** via standard URLs. Example: `https://ipfs.io/ipfs/{hash}`

---

### Pinata
A **popular IPFS pinning service** used by Intuition for reliable IPFS storage.

---

### GraphQL
A **query language for APIs** that allows clients to request exactly the data they need. Hive Mind uses GraphQL to fetch atom, triple, and position data.

---

### Substreams
A **blockchain data streaming** technology used for efficient indexing. Alternative to traditional event-based indexing.

---

## Smart Contract Terms

### term_id
The **unique on-chain identifier** for an atom. Also called `atom_id` in some contexts.

---

### vault_id
The **unique identifier** for a vault. For atoms, vault_id = term_id. For triples, separate vault_ids for support and counter vaults.

---

### ABI (Application Binary Interface)
The **interface definition** for a smart contract, describing available functions and events. Used by frontend to interact with contracts.

---

### createAtom()
Smart contract function to **create a new atom**. Requires payment of atom creation fee.

---

### createTriple()
Smart contract function to **create a new triple** by linking three atom IDs. Requires payment of triple creation fee.

---

### depositAtom() / depositTriple()
Smart contract functions to **stake tokens** on atoms or triples.

---

### redeemAtom() / redeemTriple()
Smart contract functions to **withdraw stake** (redeem shares for tokens).

---

### getAtomCost() / getTripleCost()
Smart contract view functions returning the **current creation cost** including all fees.

---

### atomConfig / tripleConfig / generalConfig
Smart contract struct returns containing **protocol configuration** parameters.

---

### vaultFees
Smart contract function returning **fee percentages** for a specific vault (entry, exit, protocol).

---

## Data & API Terms

### Schema.org
A **vocabulary standard** (JSON-LD) used for atom metadata. Ensures interoperability and semantic richness.

Example:
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Vitalik Buterin"
}
```

---

### JSON-LD
**JSON for Linked Data**. A format for structured data that atoms use for rich metadata storage on IPFS.

---

### RDF (Resource Description Framework)
The **semantic web standard** that Intuition's triple structure follows. Subject-Predicate-Object format.

---

### Fragment (GraphQL)
A **reusable piece** of a GraphQL query. Hive Mind uses fragments for consistent field selection across queries.

---

### Query
A GraphQL operation that **fetches data** without modifying it.

---

### Mutation
A GraphQL operation that **modifies data**. Example: pinning data to IPFS.

---

### Result<T, E>
A **type pattern** used in Hive Mind services for explicit error handling:
```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: E }
```

---

### Zod Schema
A **runtime validation schema** used to ensure API responses match expected shapes. Provides type safety at runtime.

---

## Frontend & UI Terms

### Modal
A **dialog overlay** that appears over the main content. Used for forms, confirmations, and focused tasks.

**Modal Types in Hive Mind:**
- **Destination**: Can be opened via URL
- **Transient**: Standard modal without URL state
- **Overlay**: Can stack on other modals

---

### Modal Stack
The **ordered list** of currently open modals. Overlay modals can push onto the stack without closing the previous modal.

---

### Toast
A **brief notification message** that appears temporarily. Used for success/error feedback.

---

### Skeleton
A **loading placeholder** that mimics the shape of content being loaded. Better UX than spinners for data-heavy pages.

---

### shadcn/ui
A **component collection** built on Radix UI primitives. Provides accessible, customizable UI components.

---

### Radix UI
**Headless UI primitives** library providing accessible behavior without styling. Foundation for shadcn/ui.

---

### TanStack Router
A **type-safe routing library** for React. Hive Mind uses file-based routing with TanStack Router.

---

### TanStack Query (React Query)
A **data fetching library** that handles caching, synchronization, and server state management.

---

### Zustand
A **lightweight state management** library. Hive Mind uses Zustand for client-side state (theme, currency, dialogs).

---

### Provider
A **React context pattern** for passing data through the component tree. Example: `WagmiProvider`, `QueryClientProvider`.

---

## Web3 & Blockchain Terms

### Wallet
A **software or hardware device** that holds cryptographic keys for signing transactions. Examples: MetaMask, WalletConnect.

---

### Wagmi
A **React hooks library** for Ethereum. Provides hooks like `useAccount`, `useConnect`, `useWriteContract`.

---

### Viem
A **TypeScript Ethereum client** library. Lower-level than Wagmi, used for direct contract interactions.

---

### Public Client
A **viem client** for read-only blockchain operations (reading contract state, fetching transactions).

---

### Wallet Client
A **viem client** for write operations (sending transactions). Requires a connected wallet.

---

### Transaction Hash
A **unique identifier** for a blockchain transaction. Format: `0x{64 hex characters}`.

---

### Block Number
The **sequential index** of a block in the blockchain. Higher = more recent.

---

### Block Timestamp
The **Unix timestamp** when a block was mined.

---

### Gas
The **computational cost** unit for Ethereum operations. Users pay gas fees for transactions.

---

### Chain ID
A **unique identifier** for a blockchain network:
- Intuition Mainnet: `1155`
- Intuition Testnet: `13579`

---

### ENS (Ethereum Name Service)
A **naming system** that maps human-readable names (e.g., `vitalik.eth`) to Ethereum addresses.

---

### Checksummed Address
An Ethereum address with **mixed-case letters** for error detection (EIP-55). Example: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

**This is the one canonical address form across Hive Mind.** All indexed addresses (`account_id`, `creator_id`, `accounts.id`, address-typed `atoms.data`) are stored checksummed. Match them in GraphQL with `_eq` (never `_ilike`), compare them with `getAddress(a) === getAddress(b)` (never `.toLowerCase()`), and never store, cache, or display a lowercased (non-canonical) address.

---

### ERC-20
The **token standard** for fungible tokens on Ethereum. TRUST is an ERC-20 token.

---

### MetaMask
The most popular **browser extension wallet** for Ethereum.

---

### WalletConnect
A **protocol** for connecting mobile wallets to dApps via QR code scanning.

---

### MetaMask Snap
An **extension system** for MetaMask allowing third-party functionality. Intuition has a Snap for displaying trust data.

---

## Abbreviations & Acronyms

| Abbreviation | Full Term |
|--------------|-----------|
| **ABI** | Application Binary Interface |
| **API** | Application Programming Interface |
| **CTA** | Call to Action |
| **DAO** | Decentralized Autonomous Organization |
| **dApp** | Decentralized Application |
| **ENS** | Ethereum Name Service |
| **EOA** | Externally Owned Account |
| **ERC** | Ethereum Request for Comments (standard) |
| **ETH** | Ether (Ethereum's native currency) |
| **EVM** | Ethereum Virtual Machine |
| **IPFS** | InterPlanetary File System |
| **JSON** | JavaScript Object Notation |
| **JSON-LD** | JSON for Linked Data |
| **RDF** | Resource Description Framework |
| **RPC** | Remote Procedure Call |
| **SDK** | Software Development Kit |
| **SQS** | Simple Queue Service (AWS) |
| **TVL** | Total Value Locked |
| **TX/Tx** | Transaction |
| **UI** | User Interface |
| **UX** | User Experience |
| **URI** | Uniform Resource Identifier |
| **URL** | Uniform Resource Locator |
| **ve** | Vote-Escrowed (as in veTRUST) |
| **WASM** | WebAssembly |

---

## Domain-Specific Identifiers

### Predicate Atom IDs (Testnet)

| Predicate | Description | Config Key |
|-----------|-------------|------------|
| `hasAlias` | Links entity to alias | `hasAliasAtomId` |
| `hasTag` | Links entity to trait | `hasTagAtomId` |
| `trustworthy` | The "trustworthy" trait | `trustworthyAtomId` |

---

## Quick Reference: Common Patterns

### "Subject has tag trustworthy" Triple
```
Subject: [Any Person/Org Atom]
Predicate: "has tag" (hasTagAtomId)
Object: "trustworthy" (trustworthyAtomId)
```

### "Subject has alias X" Triple
```
Subject: [Any Atom]
Predicate: "has alias" (hasAliasAtomId)
Object: [String Atom with alias text]
```

---

*This glossary is maintained alongside the codebase. For protocol-level documentation, see [CONCEPTS.md](./CONCEPTS.md) and [TRUST-WHITEPAPER-SUMMARY.md](./TRUST-WHITEPAPER-SUMMARY.md).*

