# Detecting the Hive Mind Snap & Nudging Install

How our web/extension surfaces detect whether the Hive Mind snap is installed in
the user's MetaMask, and prompt them to install it if not.

- **Snap ID:** `npm:@hivemindhq/snap`
- **Core APIs:** `wallet_getSnaps` (detect) + `wallet_requestSnaps` (install/connect)

## Key facts

- `wallet_getSnaps` returns **only** snaps connected to *your* origin — it is not a
  global enumeration (privacy). So a surface sees our snap only after it has
  permission to it.
- `initialConnections` (in `snap.manifest.json`) grants an origin an **automatic
  connection**, so `wallet_getSnaps` returns the snap with **no connection prompt**.
- `initialConnections` removes the *connection* prompt only. The MetaMask
  **install** prompt still appears when the snap is missing — which is exactly
  the nudge we want.

## Manifest setup

```json
// packages/snap/snap.manifest.json
"initialConnections": {
  "https://hivemindhq.io": {},
  "https://explorer.hivemindhq.io": {},
  "chrome-extension://olafjk...": {}
}
```

Origin matching is exact. Gotchas:

- **Extension ID:** `olafjk...` is the published Chrome Web Store ID. An
  unpacked/dev build has a *different* ID unless pinned via a manifest `key`.
  Firefox/Edge also differ. Add dev IDs while testing; strip before publishing
  (same hygiene as `localhost`).
- Keep `localhost` / dev entries out of the published manifest.

## Per-surface mechanics

The snap detection code is identical everywhere; only how each surface obtains
the EIP-1193 provider differs.

| Surface | Provider source | Origin MetaMask sees |
|---|---|---|
| `hivemind-explorer` (web) | injected `window.ethereum` / EIP-6963 | `https://explorer.hivemindhq.io` |
| `marketing-website` (web) | injected `window.ethereum` / EIP-6963 | `https://hivemindhq.io` |
| `hivemind-extension` | `createExternalExtensionProvider` (`@metamask/providers`) | `chrome-extension://<id>` |

**Extension note:** the external-extension provider is a real EIP-1193 provider
in the sidepanel/background context — no web page needed. MetaMask derives its
origin as `new URL(sender.url).origin` → `chrome-extension://<id>` (the same
origin our `eth_accounts` permission already uses), so `initialConnections`
matches it. Existing connector: `src/lib/connectors/metamask-connector.ts`.

**Marketing site note:** users rarely connect a wallet on the marketing site, so
detection has no provider to run against most of the time. Treat it as optional
— prefer a plain "Install the snap" CTA/deep link there over a live check.

## Detect-then-nudge flow

```ts
const SNAP_ID = 'npm:@hivemindhq/snap'

async function ensureSnap(provider) {
  const snaps = await provider.request({ method: 'wallet_getSnaps' })

  // Installed + auto-connected (no popup, thanks to initialConnections)
  if (Object.keys(snaps).includes(SNAP_ID)) return snaps[SNAP_ID]

  // Missing → user sees a real install prompt. Already-installed = no popup.
  const result = await provider.request({
    method: 'wallet_requestSnaps',
    params: { [SNAP_ID]: {} },
  })
  return result[SNAP_ID] // includes `enabled: false` if user disabled it
}
```

- Check `enabled` on the returned entry — a user can have it installed but disabled.
- Detection/install does **not** require `endowment:rpc`. That permission
  (already present, `dapps: true`) is only needed to *invoke* the snap's own RPC.

## To verify once

- Confirm MetaMask's snap-install popup renders correctly when triggered from the
  **external-extension** connection (uncommon combo; quick to eyeball).

## References

- [Connect to a Snap](https://docs.metamask.io/snaps/how-to/connect-to-a-snap/)
- [Allow automatic connections](https://docs.metamask.io/snaps/how-to/allow-automatic-connections/)
- [`wallet_getSnaps`](https://docs.metamask.io/snaps/reference/snaps-api/wallet_getsnaps/)
- [`wallet_requestSnaps`](https://docs.metamask.io/snaps/reference/snaps-api/wallet_requestsnaps/)
