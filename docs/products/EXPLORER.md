# Hive Mind Explorer

> **Purpose**: Product-specific context for working on the hivemind-explorer web application.

---

## Overview

The Explorer is a **web application for browsing and interacting with the Intuition knowledge graph**.

**Location:** `/hivemind/hivemind-explorer`

---

## Features

| Feature | Description |
|---------|-------------|
| Atom Browser | Browse and search all atoms |
| Triple Explorer | View claims and stake distributions |
| User Profiles | See positions, created atoms/triples |
| Staking Interface | Stake FOR or AGAINST claims |
| Creation Tools | Create new atoms and triples |

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React | UI framework |
| TypeScript | Type safety |
| TanStack Router | File-based routing |
| React Query | Server state management |
| Zustand | Client state management |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| viem / wagmi | Web3 interactions |

---

## Project Structure

```
hivemind-explorer/
├── config/
│   └── app.config.ts        # Chain config, well-known atom IDs
├── src/
│   ├── routes/              # Page components (TanStack Router)
│   ├── components/          # Reusable UI components
│   ├── features/            # Feature-specific code
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Data fetching services
│   ├── graphql/             # GraphQL queries and fragments
│   ├── util/                # Utilities
│   │   └── multivault-wrapper.ts  # Contract interactions
│   └── lib/                 # Shared libraries
├── docs/                    # Documentation (you are here)
└── public/                  # Static assets
```

---

## Key Files

| Purpose | Path |
|---------|------|
| App config | `config/app.config.ts` |
| MultiVault wrapper | `src/util/multivault-wrapper.ts` |
| GraphQL queries | `src/graphql/*.graphql` |
| Modal system | `src/features/modals/` |
| Atom display | `src/components/AtomCard.tsx` |
| Triple display | `src/components/TripleCard.tsx` |
| Staking UI | `src/components/StakeForm.tsx` |

---

## Routing

Uses TanStack Router with file-based routing:

```
src/routes/
├── __root.tsx           # Root layout
├── index.tsx            # Home page (/)
├── atoms/
│   ├── index.tsx        # Atom list (/atoms)
│   └── $termId.tsx      # Atom detail (/atoms/:termId)
├── triples/
│   ├── index.tsx        # Triple list (/triples)
│   └── $termId.tsx      # Triple detail (/triples/:termId)
└── profile/
    └── $address.tsx     # User profile (/profile/:address)
```

---

## State Management

### Server State (React Query)

```typescript
// Example: Fetch atom data
const { data: atom, isLoading } = useQuery({
  queryKey: ['atom', termId],
  queryFn: () => fetchAtom(termId),
  staleTime: 60 * 1000,  // 1 minute
});
```

### Client State (Zustand)

```typescript
// Example: Modal state
const useModalStore = create((set) => ({
  isOpen: false,
  modalType: null,
  open: (type) => set({ isOpen: true, modalType: type }),
  close: () => set({ isOpen: false, modalType: null }),
}));
```

---

## Common Patterns

### Displaying Atoms

```typescript
import { AtomCard } from '@/components/AtomCard';
import { formatIpfsUrl } from '@/util/format';

function AtomDisplay({ atom }) {
  return (
    <AtomCard
      termId={atom.term_id}
      label={atom.label}
      image={formatIpfsUrl(atom.image)}
      type={atom.type}
    />
  );
}
```

### Staking Flow

1. User clicks "Stake" button
2. Open staking modal with term context
3. User enters amount, selects FOR/AGAINST
4. Preview shares via `previewDeposit`
5. Execute transaction
6. Wait for confirmation
7. Invalidate queries to refresh UI

### IPFS Image Handling

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

## Configuration

### `config/app.config.ts`

```typescript
export const chainConfigs = {
  mainnet: {
    chainId: 1155,
    chainName: 'Intuition Mainnet',
    graphqlOrigin: 'https://mainnet.intuition.sh',
    rpcUrl: 'https://rpc.intuition.systems',
    multiVaultAddress: '0x...',
    wellKnownAtoms: {
      hasTagAtomId: '0x6de69cc0ae...',
      trustworthyAtomId: '0xe9c0e287...',
    }
  }
};
```

---

## Testing Locally

```bash
cd hivemind-explorer
pnpm install
pnpm dev          # Start dev server (usually port 5173)
```

---

## Common Tasks

### Add a New Route

1. Create file in `src/routes/` following naming convention
2. Export default component
3. TanStack Router auto-generates types

### Add a New Hook

1. Create in `src/hooks/`
2. Use `useQuery` for data fetching
3. Export from `src/hooks/index.ts`

### Add a GraphQL Query

1. Create `.graphql` file in `src/graphql/`
2. Run codegen (if configured)
3. Import generated hook

### Add Contract Interaction

1. Use functions from `@0xintuition/protocol`
2. Wrap in `src/util/multivault-wrapper.ts` if needed
3. Handle wallet connection and chain switching

---

## Integration Points

| Dependency | Purpose |
|------------|---------|
| `hivemind-core` | Shared UI components |
| `@0xintuition/protocol` | Contract interactions |
| `@0xintuition/graphql` | GraphQL client |
| Intuition GraphQL API | Data source |
| MultiVault contract | On-chain operations |

---

## Gotchas

1. **Indexer delay**: After transactions, wait 4-10 seconds before querying
2. **IPFS images**: Must convert `ipfs://` URLs to gateway URLs
3. **Address matching**: Use `_eq` on the EIP-55 checksummed address (via `viem.getAddress()`) — never `_ilike`, never lowercase
4. **Chain switching**: Always check chain before transactions

---

*See also: [../concepts/ARCHITECTURE.md](../concepts/ARCHITECTURE.md) for system overview*

*Last updated: January 21, 2026*
