# Production Rate Limits

## Status and recommendation

These are unapplied Phase 5A recommendations. No mainnet account or contract
has been created or configured.

SAN has 6 decimals, so one SAN is `1_000_000` raw units. The recommended
progression is:

| Stage                | Capacity and nominal refill per direction | Purpose                                                 |
| -------------------- | ----------------------------------------: | ------------------------------------------------------- |
| First-mainnet canary |                               500,000 SAN | Temporary validation ceiling only                       |
| Early public launch  |         30,000,000 SAN per 86,400 seconds | Launch setting with arbitrage headroom                  |
| Normal operations    |         50,000,000 SAN per 86,400 seconds | Proposed steady-state setting after evidence and review |

The earlier 100,000 / 1,000,000 / 5,000,000 SAN engineering placeholders are
superseded. The 75,000,000 and 100,000,000 SAN cases remain stress cases, not
recommendations.

Production must explicitly configure **both** Solana limiters for the
Solana/Robinhood peer (`outbound_rate_limiter` and `inbound_rate_limiter`) and
both Robinhood SanOFT buckets. Missing, zero, unreadable, or mismatched required
directional configuration must fail the deployment/wiring preflight closed.

## Market assumptions

The sizing model uses a spot reference of approximately **$0.00137 per SAN**,
observed on 2026-09-01 UTC. Public aggregators showed approximately 1 billion
SAN supply and roughly $24,000-$33,000 of 24-hour market volume. Price and volume
are volatile inputs, not contract parameters. Re-run the model from fresh
market data before each activation or capacity change.

The Robinhood liquidity model assumes:

- approximately $100,000 total SAN/WETH constant-product pool liquidity;
- a balanced pool at the reference price: $50,000 SAN and $50,000 WETH;
- approximately 36.50 million SAN in the SAN-side reserve;
- zero fee and no competing liquidity, routing, latency, or gas effects.

USD values are risk-review aids only. Never encode a USD price in either
contract.

## Candidate comparison

The loss columns show the token-bucket consequence of beginning with a full
bucket: the capacity can leave immediately, and approximately another capacity
can refill over the next 24 hours. These are not strict rolling-window caps.

| Level                  |   Capacity SAN |         Raw capacity | USD at $0.00137 | Approx. supply | % of $100k pool |          Initial burst | Initial burst + next 24h refill |
| ---------------------- | -------------: | -------------------: | --------------: | -------------: | --------------: | ---------------------: | ------------------------------: |
| Canary low             |        100,000 |       `100000000000` |            $137 |          0.01% |           0.14% |     100,000 SAN / $137 |             ~200,000 SAN / $274 |
| **Canary recommended** |    **500,000** |   **`500000000000`** |        **$685** |      **0.05%** |       **0.69%** | **500,000 SAN / $685** |     **~1,000,000 SAN / $1,370** |
| Public candidate       |     20,000,000 |     `20000000000000` |         $27,400 |           2.0% |           27.4% |      20M SAN / $27,400 |              ~40M SAN / $54,800 |
| **Public recommended** | **30,000,000** | **`30000000000000`** |     **$41,100** |       **3.0%** |         **41.1% |  **30M SAN / $41,100** |          **~60M SAN / $82,200** |
| **Normal recommended** | **50,000,000** | **`50000000000000`** |     **$68,500** |       **5.0%** |       **68.5%** |  **50M SAN / $68,500** |        **~100M SAN / $137,000** |
| Stress case            |     75,000,000 |     `75000000000000` |        $102,750 |           7.5% |          102.8% |     75M SAN / $102,750 |            ~150M SAN / $205,500 |
| Stress case            |    100,000,000 |    `100000000000000` |        $137,000 |          10.0% |          137.0% |    100M SAN / $137,000 |            ~200M SAN / $274,000 |

At the snapshot price, the 20M candidate is close to one day of reported total
SAN market volume. The 30M launch recommendation provides more room for a
cross-chain launch and is over eight times the modeled SAN needed to repair a
20% pool divergence. The 50M normal recommendation is over fourteen times that
modeled requirement while holding the initial compromised-direction burst to
5% of supply.

The 75M and 100M cases do not materially improve parity restoration for the
planned pool: even the 50M setting already has substantial headroom. They raise
an initially full bucket's immediate loss ceiling to 7.5%-10% of supply and its
approximate dollar value to more than the entire planned pool. They should be
considered only if measured legitimate demand repeatedly approaches 50M,
liquidity grows substantially, incident response is proven, and governance
explicitly accepts the higher loss velocity.

## Price-parity model

For a balanced constant-product pool with SAN reserve `R`, a pool price that is
`d` above the external price requires approximately
`R * (sqrt(1 + d) - 1)` SAN sold into the pool. The opposite correction removes
approximately `R * (1 - 1 / sqrt(1 + d))` SAN. The sell-in direction is slightly
larger and is the conservative sizing value below.

| Price divergence | SAN sold into pool | Approx. notional | SAN removed in opposite case | Approx. notional |
| ---------------- | -----------------: | ---------------: | ---------------------------: | ---------------: |
| 2%               |        363,157 SAN |             $498 |                  359,579 SAN |             $493 |
| 5%               |        901,280 SAN |           $1,235 |                  879,559 SAN |           $1,205 |
| 10%              |      1,781,345 SAN |           $2,440 |                1,698,446 SAN |           $2,327 |
| 20%              |      3,483,398 SAN |           $4,772 |                3,179,893 SAN |           $4,356 |

A 100k canary bucket cannot independently restore even a 2% modeled divergence;
500k can cover approximately 2% but is deliberately temporary and cannot cover
5%. Neither should remain during ordinary trading. Both 20M and 30M public
candidates comfortably cover the modeled 20% correction. The 30M choice leaves
more room for concurrent user transfers, launch volatility, and model error
without jumping directly to the larger normal-operation loss budget.

This is a capacity check, not a claim that arbitrage will occur. Real reserve
balances, swap fees, WETH price movement, Solana liquidity depth, message
latency, gas, and market-maker inventory can increase the required gross flow.
Before launch, rerun the calculation with the actual pool reserves and test the
full quote/send/delivery/swap loop without weakening a limiter.

## Exact configurations

For EVM, use the raw capacity as the refill amount and `86400` seconds as the
duration. Solana accepts only integer raw units per second, so use floor division
to avoid exceeding the nominal daily refill.

| Level                  | Capacity raw / EVM refill raw | EVM duration | Solana refill/second raw | Raw refilled in 86,400s | Shortfall raw |
| ---------------------- | ----------------------------: | -----------: | -----------------------: | ----------------------: | ------------: |
| Canary low             |                `100000000000` |      `86400` |                `1157407` |           `99999964800` |       `35200` |
| **Canary recommended** |            **`500000000000`** |  **`86400`** |            **`5787037`** |      **`499999996800`** |    **`3200`** |
| Public 20M candidate   |              `20000000000000` |      `86400` |              `231481481` |        `19999999958400` |       `41600` |
| **Public recommended** |          **`30000000000000`** |  **`86400`** |          **`347222222`** |    **`29999999980800`** |   **`19200`** |
| **Normal recommended** |          **`50000000000000`** |  **`86400`** |          **`578703703`** |    **`49999999939200`** |   **`60800`** |
| Stress 75M             |              `75000000000000` |      `86400` |              `868055555` |        `74999999952000` |       `48000` |
| Stress 100M            |             `100000000000000` |      `86400` |             `1157407407` |        `99999999964800` |       `35200` |

The rounding shortfalls are at most 0.0608 SAN per day and do not affect market
capacity. Ceiling division is not recommended because it exceeds the approved
nominal refill.

## Important implementation semantics

These are token buckets, not strict sliding 24-hour limits. A full bucket can be
drained immediately and then refill during the following day. Human risk
approval must use the burst-plus-refill loss model above.

The official Solana OFT implementation also cross-refills the opposite bucket:

- a Solana outbound send consumes the outbound bucket and refills inbound by
  the sent amount;
- a Solana inbound receive consumes the inbound bucket and refills outbound by
  the received amount.

Therefore, its two configured buckets principally limit net directional
imbalance; repeated legitimate or adversarial back-and-forth volume can exceed
either nominal profile. Robinhood's EVM buckets refill independently by time.
If governance requires a strict gross-volume or rolling-window ceiling, the
current controls are insufficient and a separately audited mechanism is needed.

This nuance makes bilateral configuration more important, not less. A future
configuration tool must build all four writes from an explicit peer/direction
matrix and abort before signing if any cell is absent or differs from the
explicitly selected profile. A separate read-only
process must then verify all four capacities, refill values, available tokens,
timestamps, EIDs, and peer identities. A missing limiter must never be treated
as unlimited-by-design.

## Launch progression and future read-back

1. Configure the 500k canary profile in all four effective directions while the
   bridge remains paused. Do not use the capacity as the canary transfer amount.
2. Execute only a separately authorized first-mainnet canary and reconcile
   escrow, supply, messages, and all four limiter states.
3. Move to 30M only with separate authorization, incident-free evidence, actual
   pool reserves, fresh price/volume data, and governance approval.
4. Move to 50M only after measured public demand and operational history justify
   it. Do not automatically graduate by elapsed time.
5. Capacity changes must not unintentionally gift fresh availability. Read back
   current tokens before and after every future change.
6. Never change a limiter merely to make a pending transfer succeed.

Configuration remains blocked until the real OFT Store and SanOFT addresses
exist, multisig authority is active, the token-bucket semantics and dollar loss
budget are approved, independent review is complete, and a separate execution
phase authorizes mainnet transactions.

## Market-data references

- CoinGecko SAN: <https://www.coingecko.com/en/coins/san-chan>
- CoinMarketCap SAN: <https://coinmarketcap.com/currencies/san-chan-project/>
