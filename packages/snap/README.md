# Hive Mind Snap

A MetaMask Snap that displays real-time trust and reputation data from the [Intuition](https://intuition.systems) knowledge graph during transaction signing.

## What Does This Snap Do?

When you're about to send a transaction to an address, the Hive Mind Snap shows you:

- **Trust Signals** — How many people have staked that the address is trustworthy (or not)
- **Aliases** — Community-assigned labels for the address
- **Stake Amounts** — The economic weight behind each trust signal
- **Your Position** — Your own trust/distrust stake displayed prominently as the strongest signal
- **dApp Origin Trust** — Trust data for the dApp you're interacting with
- **Your Trust Circle** — See which of your trusted contacts have staked on this address (sorted by stake)

This helps you make informed decisions before interacting with unknown addresses or dApps.

## Features

| Feature | Description |
|---------|-------------|
| **Transaction Insights** | `onTransaction` hook displays trust data before you sign |
| **Your Position** | Prominently displays your own trust/distrust stake as the strongest signal |
| **Trust Triple Display** | Shows support/oppose positions on `[address] has tag trustworthy` |
| **dApp Origin Trust** | Shows trust data for the dApp origin (transaction source) |
| **Your Trust Circle** | Highlights when your trusted contacts have staked on an address (sorted by stake) |
| **Distribution Analysis** | Analyzes stake distribution health (concentrated vs. distributed) |
| **Alias Display** | Shows community-assigned aliases for addresses |
| **Multi-chain Support** | Works on Intuition Testnet (chain ID: 13579) and Mainnet (chain ID: 1155) |
| **Interactive UI** | Links to create trust signals or view more data on the web |
| **Persistent Cache** | Trust circle cached for 1 hour for optimal performance |

## Installation

### From npm

The Snap is published to npm and can be installed directly through MetaMask:

- **Package name**: `@hivemindhq/snap`
- **npm**: https://www.npmjs.com/package/@hivemindhq/snap

### For Development

See the [Development](#development) section below.

## Permissions

This Snap requires the following permissions:

| Permission | Purpose |
|------------|---------|
| `endowment:transaction-insight` | Display insights before transaction signing |
| `endowment:page-home` | Custom home page in MetaMask |
| `endowment:network-access` | Query the Intuition GraphQL API |
| `endowment:rpc` | Communicate with dapps |
| `snap_manageState` | Cache trusted circle data for performance |

## Development

### Prerequisites

- [MetaMask Flask](https://docs.metamask.io/snaps/get-started/install-flask) (development version of MetaMask)
- Node.js ≥ 18.6.0
- Yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/hivemindhq-io/snap.git
   cd intuition-snap
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start the development server:
   ```bash
   yarn start
   ```

4. Open `http://localhost:8000` and connect the Snap to MetaMask Flask

### Chain Configuration

By default, the Snap connects to **Intuition Testnet**. To use mainnet:

```bash
yarn start:mainnet
```

Or explicitly specify testnet:

```bash
yarn start:testnet
```

## Testing

### Automated Tests

Run the test suite:

```bash
yarn test
```

Tests use [`@metamask/snaps-jest`](https://github.com/MetaMask/snaps/tree/main/packages/snaps-jest) for Snap-specific testing utilities.

**What's tested:**
- `onHomePage` handler — Renders correctly with expected content
- `Account.tsx` components — All UI rendering variations (26 tests)

### Manual E2E Testing

The `onTransaction` handler requires network access to the Intuition GraphQL API. Because `@metamask/snaps-jest` runs the Snap in an isolated worker process, network requests cannot be mocked from the test process.

**To test transaction insights:**

1. Start the development server: `yarn start`
2. Open http://localhost:8000 in a browser with MetaMask Flask
3. Install the Snap
4. Initiate a transaction on Intuition Testnet/Mainnet
5. Verify trust data displays correctly in the transaction confirmation

## Architecture

```
src/
├── index.tsx           # Entry point, exports handlers
├── onTransaction.tsx   # Transaction insight handler
├── account.tsx         # Account (destination) data fetching
├── origin.tsx          # dApp origin data fetching
├── distribution.ts     # Stake distribution analysis
├── queries.ts          # GraphQL queries for Intuition API
├── config.ts           # Chain configuration (testnet/mainnet)
├── types.ts            # TypeScript type definitions
├── util.ts             # Utility functions
├── components/         # JSX UI components
│   ├── Account.tsx     # Destination address display
│   ├── Origin.tsx      # dApp origin display
│   ├── TrustedCircle.tsx  # Trust circle display
│   ├── UserPosition.tsx   # User's own position display
│   ├── UnifiedFooter.tsx  # Combined footer CTAs
│   ├── Footer/         # Account footer actions
│   └── OriginFooter/   # Origin footer actions
├── trusted-circle/     # Trusted circle module
│   ├── service.ts      # API & business logic
│   ├── cache.ts        # Persistent cache
│   └── types.ts        # Type definitions
├── images/             # Snap icon assets
└── vendors/            # Vendor configuration (git-ignored)
```

## Configuration

Chain settings are defined in `src/config.ts`:

| Network | Chain ID | RPC URL | Currency |
|---------|----------|---------|----------|
| Testnet | 13579 | `https://testnet.rpc.intuition.systems` | tTRUST |
| Mainnet | 1155 | `https://rpc.intuition.systems` | TRUST |

### Atoms Used

The Snap queries the Intuition knowledge graph using these predefined atoms:

| Atom Name | Atom ID (term_id) | Purpose |
|-----------|-------------------|---------|
| `hasTag` | `0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd` | Predicate for trust triples |
| `trustworthy` | `0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a` | The "trustworthy" characteristic |
| `hasAlias` | `0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6` | Predicate for alias relationships |

**Note**: These atom IDs are the same on both Intuition Testnet and Mainnet, as atoms are chain-agnostic identifiers in the Intuition protocol.

### Community & Distribution Indicators

The Snap displays two key indicators to help users assess trust signals:

#### Community (Trust Level)

Based on FOR vs AGAINST market cap ratio:

| Badge | Threshold |
|-------|-----------|
| **Trusted** 🟢 | ≥70% FOR |
| **Mixed** 🟡 | 30-70% FOR |
| **Untrusted** 🟡 | <30% FOR |

#### Distribution Status

Uses Gini coefficient + top-1 concentration:

| Status | Criteria |
|--------|----------|
| **Distributed** 🟢 | Gini ≤0.35 and top holder <30% |
| **Moderate** 🟡 | Gini 0.35-0.55 |
| **Concentrated** ⚠️ | Gini 0.55-0.75 or top holder 50-80% |
| **Whale** ⛔️ | Top holder ≥80% (always triggers) |

*Minimum 3 stakers needed for meaningful Gini analysis.*

## Building

```bash
# Build the snap bundle
yarn build

# Clean and rebuild
yarn build:clean
```

The built bundle is output to `dist/bundle.js`.

## Linting

```bash
# Run all linters
yarn lint

# Fix auto-fixable issues
yarn lint:fix
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`yarn test`)
- Code passes linting (`yarn lint`)
- No `console.*` statements in production code

## License

This project is dual-licensed under [Apache 2.0](../../LICENSE.APACHE2) and [MIT](../../LICENSE.MIT0).

## Links

- [Intuition Documentation](https://docs.intuition.systems)
- [MetaMask Snaps Documentation](https://docs.metamask.io/snaps/)
- [Repository](https://github.com/hivemindhq-io/snap)
