# Trust Light System

The **Signal** row displays a single composite colored light on its own row, separate from the **Trustworthy** percentage. It reflects the **weakest** of four independent trust dimensions — if any dimension has a concern, the light downgrades accordingly.

The separation ensures no confusion between the trust consensus percentage and the overall health indicator.

## Dimensions

| Dimension | What it measures | 🟢 Green | 🟡 Yellow | 🔴 Red |
|---|---|---|---|---|
| **Trust %** | Community consensus (FOR vs total) | ≥ 90% | 70–89% | < 70% |
| **Staker count** | Amount of independent opinions | ≥ 3 stakers | 1–2 stakers | — |
| **Top-1 concentration** | Largest single staker's share | < 25% | 25–74% | ≥ 75% |
| **Collusion resistance** | Nakamoto coefficient (min. entities to control majority) | ≥ 5 entities | 3–4 entities | 1–2 entities |

> The Nakamoto dimension is only evaluated when ≥ 5 stakers exist. Below that, staker count already captures the sparsity concern.

## How it works

The light is always as cautious as its weakest link:

- **🟢 Green** — All four dimensions are healthy. No advisory text shown.
- **🟡 Yellow** — At least one dimension has a moderate concern. Advisory text explains which.
- **🔴 Red** — At least one dimension is critically unhealthy.

## Examples

| Scenario | Trust % | Stakers | Top-1 | Nakamoto | Light | Why |
|---|---|---|---|---|---|---|
| Healthy vault | 95% | 12 | 15% | 6 | 🟢 | All dimensions green |
| Whale-dominated | 100% | 6 | 84% | 1 | 🔴 | Nakamoto = 1 (red) |
| Early vault | 100% | 2 | 60% | — | 🟡 | Only 2 stakers (yellow) |
| Disputed | 65% | 20 | 10% | 8 | 🔴 | Trust < 70% (red) |
| Cartel of 3 | 100% | 100 | 33% | 2 | 🔴 | Nakamoto = 2 (red), despite 100 stakers |
| Moderate cartel | 90% | 10 | 30% | 4 | 🟡 | Nakamoto = 4 (yellow) + concentration (yellow) |

## Advisory text

When the light is yellow or red, a text summary appears explaining the concern(s), with the total staked amount in parentheses for context. Silence (no advisory) means the green light — everything checks out.
