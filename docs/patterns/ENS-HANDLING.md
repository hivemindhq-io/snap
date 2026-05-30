# ENS Handling

> **Address canonicalization (STRICT):** Every Ethereum address is **EIP-55 checksummed** — that is the one canonical form. Extract the address from `data` first (it holds the full checksummed address), fall back to `label`, and run `viem.getAddress()` on any external input. Match in GraphQL with `_eq` (never `_ilike`) and compare in code with `getAddress(a) === getAddress(b)` (never `.toLowerCase()`). Never store, cache, or display a lowercased (non-canonical) address.

> **Purpose**: Critical patterns for handling ENS-resolved atoms. This is one of the most common sources of bugs.

---

## The Problem

When an Ethereum address has an ENS name, the Intuition resolver enriches the atom:

| Field | Non-ENS Atom | ENS-Resolved Atom |
|-------|--------------|-------------------|
| `label` | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` | `vitalik.eth` |
| `data` | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` |

**The wallet address moves from `label` to `data`, and `label` becomes the ENS name.**

---

## Why This Matters

When matching atoms to wallet addresses (e.g., in trust circle), using only `label` fails:

```typescript
// ❌ WRONG - fails for ENS-resolved atoms
const walletAddress = subject.label;  // "vitalik.eth" - not an address!

// Comparison fails:
walletAddress === position.account_id  // "vitalik.eth" !== "0xd8da..."
```

---

## The Solution

Always check `data` first, then fall back to `label`:

```typescript
function extractWalletAddress(subject: { label?: string; data?: string }): string | null {
  const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/i.test(v);
  
  // Check data first (where ENS-resolved addresses live)
  if (subject.data && isEvmAddress(subject.data)) {
    return getAddress(subject.data);
  }
  
  // Fallback to label for non-ENS atoms
  if (subject.label && isEvmAddress(subject.label)) {
    return getAddress(subject.label);
  }
  
  return null;
}
```

---

## Complete Pattern

```typescript
// Type guard for EVM addresses
function isEvmAddress(value: string | null | undefined): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/i.test(value);
}

// Extract wallet address from atom
function getWalletFromAtom(atom: { label?: string; data?: string }): string | null {
  // Priority: data (for ENS), then label (for non-ENS)
  if (isEvmAddress(atom.data)) {
    return getAddress(atom.data);
  }
  if (isEvmAddress(atom.label)) {
    return getAddress(atom.label);
  }
  return null;
}

// Get display name (prefer ENS, fall back to truncated address)
function getDisplayName(atom: { label?: string; data?: string }): string {
  const wallet = getWalletFromAtom(atom);
  
  // If label is ENS name, use it
  if (atom.label && !isEvmAddress(atom.label)) {
    return atom.label;
  }
  
  // Otherwise truncate the address
  if (wallet) {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  }
  
  return atom.label || 'Unknown';
}
```

---

## Usage in Trust Circle

The trust circle is built from `[I] → [follow] → [target]` triples, so the followed account is the triple's **object** (not the subject — that's always the shared `I` atom):

```typescript
// Building a map of trusted contacts
const contactMap = new Map<string, { accountId: string; label: string }>();

for (const position of userFollowPositions) {
  const object = position.term.triple.object;
  
  // CORRECT: Extract wallet from data first
  const walletAddress = getWalletFromAtom(object);
  
  if (walletAddress) {
    contactMap.set(getAddress(walletAddress), {
      accountId: walletAddress,
      label: object.label || walletAddress,  // Keep ENS name for display
    });
  }
}

// Later, when matching positions:
for (const position of targetPositions) {
  const contact = contactMap.get(getAddress(position.account_id));
  if (contact) {
    // Found a trusted contact who staked!
    console.log(`${contact.label} also staked on this`);
  }
}
```

---

## GraphQL Query Pattern

When querying for the trust circle, always fetch both fields on the followed account (the triple's `object`):

```graphql
query GetTrustCircle($userId: String!, $iAtomId: String!, $followAtomId: String!) {
  positions(where: {
    account_id: { _eq: $userId },
    term: { triple: { subject_id: { _eq: $iAtomId }, predicate_id: { _eq: $followAtomId } } }
  }) {
    term {
      triple {
        object {
          label  # ENS name OR address (for display)
          data   # Wallet address (for matching)
        }
      }
    }
  }
}
```

---

## Common Mistakes

### ❌ Using Only Label

```typescript
const address = subject.label;
// "vitalik.eth" for ENS-resolved, fails matching
```

### ✅ Check Data First

```typescript
const address = isEvmAddress(subject.data) ? subject.data : subject.label;
```

---

### ❌ Lowercasing Addresses

```typescript
// WRONG — lowercase is non-canonical; never "normalize" an address this way
walletA.toLowerCase() === walletB.toLowerCase()
```

### ✅ Compare Canonical (Checksummed) Addresses

```typescript
// Indexer data is already EIP-55 checksummed; run getAddress() on any external input
getAddress(walletA) === getAddress(walletB)
```

---

### ❌ Assuming All Atoms Have Addresses

```typescript
// Will throw for non-address atoms (concepts, URLs, etc.)
const address = subject.data;
someFunction(address);  // undefined!
```

### ✅ Guard with Type Check

```typescript
const address = getWalletFromAtom(subject);
if (address) {
  someFunction(address);
}
```

---

## Quick Reference

| Atom Type | `label` | `data` | Use for Matching |
|-----------|---------|--------|------------------|
| Non-ENS address | `0xabc...` | `0xabc...` | Either (same) |
| ENS-resolved | `vitalik.eth` | `0xd8da...` | `data` |
| Person/Org | `Alice` | `{"@type":"Person"...}` | N/A (not address) |
| URL | `example.com` | `https://example.com` | N/A (not address) |

---

## Decision Tree

```
Is subject.data a valid EVM address?
├── Yes → Use subject.data for matching
│         Use subject.label for display (may be ENS)
└── No  → Is subject.label a valid EVM address?
          ├── Yes → Use subject.label for both
          └── No  → Not an address atom
```

---

*This pattern is critical for: Trust Circle, Position Lookups, Account Matching*

*See also: [TRUST-CIRCLE.md](./TRUST-CIRCLE.md) for full implementation*

*Last updated: January 21, 2026*
