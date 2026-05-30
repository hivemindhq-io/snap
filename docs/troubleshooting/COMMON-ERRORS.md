# Common Errors

> **Purpose**: Quick solutions to frequently encountered errors.

---

## Smart Contract Errors

### "Atom already exists"

**Symptom:** Transaction reverts when creating an atom.

**Cause:** Atom data already registered on-chain.

**Solution:**
```typescript
import { findAtomIds } from '@0xintuition/sdk/experimental';

const existing = await findAtomIds(graphqlClient, [atomData]);
if (existing[0]) {
  // Use existing atom instead of creating
} else {
  await createAtom(atomData);
}
```

---

### "Insufficient value" / Transaction reverts

**Symptom:** Deposit transaction reverts.

**Cause:** Transaction value doesn't include fees.

**Solution:**
```typescript
// Always use preview to see expected outcome
const preview = await multiVaultPreviewDeposit(publicClient, {
  address: contractAddress,
  args: [depositAmount, termId, curveId],
});

// Preview includes fee calculations
```

---

### Slippage / "Shares below minimum"

**Symptom:** Transaction reverts with slippage error.

**Cause:** Share price changed between preview and execution.

**Solution:**
```typescript
// Add slippage tolerance
const minShares = (preview.shares * 99n) / 100n;  // 1% tolerance

const tx = await multiVaultDeposit(walletClient, {
  args: [receiver, termId, curveId, minShares],
  value: depositAmount,
});
```

---

### Wrong Chain

**Symptom:** Transaction fails or unexpected behavior.

**Cause:** Wallet connected to wrong chain.

**Solution:**
```typescript
const currentChainId = await walletClient.getChainId();
if (currentChainId !== EXPECTED_CHAIN_ID) {
  await walletClient.switchChain({ id: EXPECTED_CHAIN_ID });
}
```

---

## GraphQL Errors

### Query Timeout

**Symptom:** GraphQL queries fail with timeout.

**Cause:** Query too complex or fetching too much data.

**Solutions:**
1. Add `limit` to reduce result count:
   ```graphql
   atoms(limit: 50) { ... }
   ```

2. Reduce field selection:
   ```graphql
   atoms { term_id label }  # Only needed fields
   ```

3. Add `where` clauses:
   ```graphql
   atoms(where: { type: { _eq: "Account" } }) { ... }
   ```

---

### "Field not found" / Navigation Error

**Symptom:** Query fails on nested fields.

**Cause:** Wrong relationship navigation.

**Solution:** Navigate through `term` for positions:
```graphql
# ❌ WRONG
positions(where: { triple: { ... } })

# ✅ CORRECT
positions(where: { term: { triple: { ... } } })
```

---

### No Results (Address Matching)

**Symptom:** Query returns empty when data exists.

**Cause:** Querying with a non-canonical (lowercased) address, or `_ilike`-matching a fragmented non-checksummed row instead of the canonical one.

**Solution:** Checksum the address with `viem.getAddress()` and match exactly with `_eq`:
```graphql
# ❌ WRONG — lowercased + fuzzy match (non-canonical)
atoms(where: { data: { _ilike: "0xabc..." } })

# ✅ CORRECT — exact match on the EIP-55 checksummed value
atoms(where: { data: { _eq: "0xAbC..." } })
```

---

## Data Issues

### Position Not Showing After Deposit

**Symptom:** Deposited tokens but position doesn't appear.

**Cause:** Indexer delay (4-10 seconds).

**Solution:**
```typescript
// Wait for indexer
await new Promise(r => setTimeout(r, 5000));

// Invalidate cache
await queryClient.invalidateQueries({ queryKey: ['positions', termId] });
```

---

### Trust Circle Matching Fails

**Symptom:** Trust circle shows no overlap when it should.

**Cause:** Using `label` instead of `data` for ENS-resolved atoms — or reading the
followed account from the triple's `subject` instead of its `object`. The trust circle is
built from `[I] → [follow] → [target]` triples, so the followed account is the `object`
(the subject is always the shared `I` atom).

**Solution:**
```typescript
// ❌ WRONG — followed account is the object, not the subject
const address = position.term.triple.subject.label;  // "vitalik.eth" - not an address!

// ✅ CORRECT
const object = position.term.triple.object;
const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/i.test(v);
const address = isEvmAddress(object.data) ? object.data : object.label;
```

See [../patterns/ENS-HANDLING.md](../patterns/ENS-HANDLING.md) for full pattern.

---

### IPFS Images Not Loading

**Symptom:** Atom images show broken.

**Cause:** Direct `ipfs://` URLs not supported in browsers.

**Solution:**
```typescript
function formatIpfsUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
}
```

---

## Extension Errors

### Wallet Not Connecting

**Symptom:** Connect button doesn't work.

**Causes:**
1. Multiple wallet extensions conflicting
2. MetaMask locked
3. Permissions not granted

**Solutions:**
1. Disable other wallet extensions temporarily
2. Unlock MetaMask, ensure correct network
3. Clear extension storage and reinstall

---

### Content Script Can't Access State

**Symptom:** Content script can't use React hooks.

**Cause:** Content scripts run in isolated context.

**Solution:** Use Chrome messaging:
```typescript
// content-script.ts
chrome.runtime.sendMessage({ type: 'ACTION', data: payload });

// background.ts
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'ACTION') {
    // Handle action
  }
});
```

---

### Changes Not Reflecting

**Symptom:** Code changes don't appear in extension.

**Cause:** Multiple dev servers or cached build.

**Solution:**
```bash
pkill -f plasmo        # Kill all dev servers
pnpm dev               # Restart single server
```

Then reload extension in Chrome.

---

## Snap Errors

### User Address Undefined

**Symptom:** Can't get user's wallet address in Snap.

**Cause:** Using `eth_accounts` which is unreliable in Snaps.

**Solution:**
```typescript
// ❌ UNRELIABLE
const accounts = await ethereum.request({ method: 'eth_accounts' });

// ✅ RELIABLE
const userAddress = transaction.from;
```

---

### Network Requests Blocked

**Symptom:** `fetch` calls fail.

**Cause:** Missing network permission.

**Solution:** Add to `snap.manifest.json`:
```json
{
  "initialPermissions": {
    "endowment:network-access": {}
  }
}
```

---

### State Not Persisting

**Symptom:** Cached data lost between sessions.

**Cause:** Using browser storage (not available in Snaps).

**Solution:**
```typescript
// Use snap_manageState instead
await snap.request({
  method: 'snap_manageState',
  params: {
    operation: 'update',
    newState: { key: value }
  }
});
```

---

### Insight Panel Not Showing

**Symptom:** No Intuition panel during transaction.

**Causes:**
1. Snap not installed
2. Snap disabled
3. Transaction on wrong chain
4. Snap crashed

**Solutions:**
1. Reinstall Snap
2. Enable in MetaMask settings
3. Check transaction is on supported chain (1155)
4. Check Snap logs in MetaMask developer mode

---

## ID Type Confusion

**Symptom:** Comparisons always fail or unexpected behavior.

**Cause:** Mixing up ID types.

| Context | ID Type | Example |
|---------|---------|---------|
| Atom/Triple identity | term_id | `0xfbdbc115dc...` (64 chars) |
| User/staker | wallet address | `0xb14f8ed6cf...` (40 chars) |
| Position lookup | account_id (wallet) | `0xb14f8ed6cf...` |
| ENS atom label | ENS name | `vitalik.eth` |
| ENS atom data | wallet address | `0xd8da6bf...` |

**Solution:** 
1. Check what type of ID you need
2. Compare canonical (EIP-55 checksummed) forms — `getAddress(a) === getAddress(b)`, never lowercase
3. Use correct field for the context

---

## Quick Diagnostic Checklist

| Issue | Check |
|-------|-------|
| Transaction fails | Chain ID, value includes fees |
| Query returns empty | Case sensitivity, correct navigation |
| Data not updating | Indexer delay (wait 5-10s) |
| Trust circle empty | ENS handling (use `data` not `label`) |
| Extension not working | Single dev server, reload extension |
| Snap not showing | Permissions, correct chain |

---

*See also: [SECURITY.md](./SECURITY.md) for security considerations*

*Last updated: January 21, 2026*
