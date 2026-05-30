# Contract Patterns

> **Purpose**: Smart contract interaction patterns for creating atoms/triples and staking.

---

## Prerequisites

**Package:** `@0xintuition/protocol`

**Default Values:**
- `curve_id`: `1n` (bigint) — **write default only**. The UI does not yet
  support per-curve staking, so `deposit` and `redeem` pin `curveId = 1n`
  intentionally. **Read** queries must aggregate across all curves; see
  [GRAPHQL-PATTERNS.md](./GRAPHQL-PATTERNS.md) Critical Rule #4.
- Slippage: 1% — `(preview * 99n) / 100n`

---

## Critical Rules

1. **Always use preview functions** before transactions to calculate fees
2. **Include slippage protection** via `minShares` / `minAssets`
3. **Check atom existence** before creating
4. **Use correct chain** — prompt user to switch if needed

---

## Pattern 1: Check Atom Existence

Before creating, verify the atom doesn't already exist:

```typescript
import { findAtomIds } from '@0xintuition/sdk/experimental';

const atomData = toHex(JSON.stringify({ '@type': 'Person', name: 'Alice' }));
const existing = await findAtomIds(graphqlClient, [atomData]);

if (existing[0]) {
  console.log('Atom exists:', existing[0]);
  // Use existing atom
} else {
  // Safe to create
}
```

---

## Pattern 2: Create Atoms

```typescript
import { multiVaultCreateAtoms, multiVaultGetAtomCost } from '@0xintuition/protocol';
import { toHex } from 'viem';

// 1. Get creation cost
const { atomCost, minDeposit } = await multiVaultGetAtomCost(publicClient, {
  address: contractAddress,
});

// 2. Prepare atom data (hex-encoded)
const atomData = toHex(JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Alice',
}));

// 3. Create atom
const tx = await multiVaultCreateAtoms(walletClient, {
  address: contractAddress,
  args: [[atomData]],  // Array of atom data
  value: atomCost + minDeposit,
});

// 4. Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

// 5. Parse created atom ID from events
const atomCreatedEvent = parseEventLogs({
  abi: multiVaultAbi,
  logs: receipt.logs,
  eventName: 'AtomCreated'
});
const newAtomId = atomCreatedEvent[0].args.termId;
```

---

## Pattern 3: Create Triples

```typescript
import { multiVaultCreateTriples, multiVaultGetTripleCost } from '@0xintuition/protocol';

// 1. Get creation cost
const { tripleCost, minDeposit } = await multiVaultGetTripleCost(publicClient, {
  address: contractAddress,
});

// 2. Create triple (arrays for batch support)
const tx = await multiVaultCreateTriples(walletClient, {
  address: contractAddress,
  args: [
    [subjectId],    // Subject atom term_ids
    [predicateId],  // Predicate atom term_ids
    [objectId],     // Object atom term_ids
  ],
  value: tripleCost + minDeposit,
});
```

---

## Pattern 4: Deposit (Stake FOR)

```typescript
import { multiVaultDeposit, multiVaultPreviewDeposit } from '@0xintuition/protocol';

// 1. Preview to get expected shares
const preview = await multiVaultPreviewDeposit(publicClient, {
  address: contractAddress,
  args: [depositAmount, termId, 1n],  // curve_id = 1 (write default — see Prerequisites)
});

// 2. Calculate minimum shares with slippage
const minShares = (preview.shares * 99n) / 100n;  // 1% slippage

// 3. Execute deposit
const tx = await multiVaultDeposit(walletClient, {
  address: contractAddress,
  args: [
    receiverAddress,  // Usually the sender
    termId,           // Atom or triple term_id
    1n,               // curve_id
    minShares,        // Slippage protection
  ],
  value: depositAmount,
});
```

---

## Pattern 5: Deposit AGAINST a Triple

To stake against a claim, deposit into the **counter vault**:

```typescript
// 1. Get counter term ID
const counterTermId = await publicClient.readContract({
  address: contractAddress,
  abi: multiVaultAbi,
  functionName: 'tripleCounterTermId',
  args: [tripleTermId],
});

// 2. Preview and deposit (same as Pattern 4, but use counterTermId)
const preview = await multiVaultPreviewDeposit(publicClient, {
  address: contractAddress,
  args: [depositAmount, counterTermId, 1n],
});

const minShares = (preview.shares * 99n) / 100n;

const tx = await multiVaultDeposit(walletClient, {
  address: contractAddress,
  args: [receiverAddress, counterTermId, 1n, minShares],
  value: depositAmount,
});
```

---

## Pattern 6: Redeem (Unstake)

```typescript
import { multiVaultRedeem, multiVaultPreviewRedeem } from '@0xintuition/protocol';

// 1. Preview to get expected assets
const preview = await multiVaultPreviewRedeem(publicClient, {
  address: contractAddress,
  args: [sharesToRedeem, termId, 1n],
});

// 2. Calculate minimum assets with slippage
const minAssets = (preview.assets * 99n) / 100n;

// 3. Execute redemption
const tx = await multiVaultRedeem(walletClient, {
  address: contractAddress,
  args: [
    sharesToRedeem,
    receiverAddress,
    termId,
    1n,         // curve_id
    minAssets,  // Slippage protection
  ],
});
```

---

## Pattern 7: Check and Switch Chain

```typescript
async function ensureCorrectChain(walletClient: WalletClient, expectedChainId: number) {
  const currentChainId = await walletClient.getChainId();
  
  if (currentChainId !== expectedChainId) {
    try {
      await walletClient.switchChain({ id: expectedChainId });
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not in wallet, add it first
        await walletClient.addChain({ chain: intuitionChain });
        await walletClient.switchChain({ id: expectedChainId });
      } else {
        throw error;
      }
    }
  }
}

// Usage before any transaction
await ensureCorrectChain(walletClient, 1155);  // Mainnet
```

---

## Contract Function Reference

### Read Functions

| Function | Parameters | Returns |
|----------|------------|---------|
| `getAtom` | `termId` | Atom data |
| `getTriple` | `termId` | Triple data |
| `getPosition` | `account, termId, curveId` | shares (bigint) |
| `previewDeposit` | `assets, termId, curveId` | shares (bigint) |
| `previewRedeem` | `shares, termId, curveId` | assets (bigint) |
| `getAtomCost` | — | { atomCost, minDeposit } |
| `getTripleCost` | — | { tripleCost, minDeposit } |
| `tripleCounterTermId` | `tripleTermId` | counterTermId |

### Write Functions

| Function | Parameters | Value Required |
|----------|------------|----------------|
| `createAtoms` | `bytes[] data` | atomCost + minDeposit |
| `createTriples` | `subjectIds[], predicateIds[], objectIds[]` | tripleCost + minDeposit |
| `deposit` | `receiver, termId, curveId, minShares` | Deposit amount |
| `redeem` | `shares, receiver, termId, curveId, minAssets` | 0 |

### Events

| Event | Emitted When |
|-------|--------------|
| `AtomCreated` | Atom is created |
| `TripleCreated` | Triple is created |
| `Deposited` | User stakes |
| `Redeemed` | User unstakes |
| `FeeTransfer` | Fees are transferred |

---

## Common Mistakes

### ❌ Forgetting Fees

```typescript
// WRONG - will revert with insufficient value
const tx = await multiVaultDeposit(..., { value: depositAmount });
```

### ✅ Use Preview for Total Cost

```typescript
// CORRECT - include all fees
const preview = await multiVaultPreviewDeposit(...);
// Use preview to verify expected outcome
```

---

### ❌ No Slippage Protection

```typescript
// WRONG - can lose value if price moves
args: [..., 0n]  // minShares = 0
```

### ✅ Calculate Minimum

```typescript
// CORRECT - protect against price movement
const minShares = (preview.shares * 99n) / 100n;
args: [..., minShares]
```

---

### ❌ Creating Duplicate Atoms

```typescript
// WRONG - will revert if atom exists
await multiVaultCreateAtoms(...);
```

### ✅ Check First

```typescript
// CORRECT
const existing = await findAtomIds(graphqlClient, [atomData]);
if (!existing[0]) {
  await multiVaultCreateAtoms(...);
}
```

---

*See also: [GRAPHQL-PATTERNS.md](./GRAPHQL-PATTERNS.md) for querying data*

*Last updated: January 21, 2026*
