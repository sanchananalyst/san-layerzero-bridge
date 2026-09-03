# Final SAN Rate-Limit Economic Analysis

## Status and conclusion

This is a Phase 5A.4, pre-mainnet, read-only economic and security analysis.
It does not authorize deployment, wiring, configuration, liquidity creation,
unpausing, or Phase 5B.

**Conclusion:** 50 million SAN per nominal day is not too restrictive for the
currently observed market or the modeled $100,000 Robinhood pool. At the
snapshot price it is $71,229.50, about 2.30 times all observed SAN 24-hour
volume, and more than six times the SAN inventory needed for the conservative
side of a modeled 50% pool-price correction. The preliminary
100M/250M/500M public progression is too permissive for the current liquidity,
volume, and incident-response evidence.

The recommended progression remains:

| Stage        | Capacity and nominal refill per direction | Snapshot one-bucket value | Decision                                                          |
| ------------ | ----------------------------------------: | ------------------------: | ----------------------------------------------------------------- |
| Canary       |              500,000 SAN / 86,400 seconds |                      $712 | Retain; temporary validation ceiling, not a trading-capacity tier |
| Early public |           30,000,000 SAN / 86,400 seconds |                   $42,738 | Retain; lower than the 100M hypothesis                            |
| Normal       |           50,000,000 SAN / 86,400 seconds |                   $71,230 | Retain; sufficient for present evidence                           |
| Mature       |          100,000,000 SAN / 86,400 seconds |                  $142,459 | Use only after measured directional demand and governance review  |

250M and 500M remain stress cases, not standing maturity tiers. A 250M bucket
is 25% of the modeled 1B supply and $356,148 at the snapshot price; a 500M
bucket is 50% and $712,295. Neither is justified by a $100,000 pool or roughly
$31,000/day of current trading volume.

## Canonical identity and market snapshot

The only token analyzed is the six-decimal Solana mint:

```text
GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump
```

CoinGecko's response identifies that exact mint as `san-chan`; GeckoTerminal
and DexScreener identify PumpSwap pool
`E4dZyLB1ousbEnXKhXUrvK6Ern2cRe456KsMWC6BHgTC` with that mint as the base
token. Tokens with similar names were excluded.

### Primary snapshot

| Metric                       |               Value | Timestamp / treatment                                                                                  |
| ---------------------------- | ------------------: | ------------------------------------------------------------------------------------------------------ |
| SAN price                    |     **$0.00142459** | CoinGecko `last_updated`: 2026-09-03T15:27:50Z                                                         |
| 24h total volume             |         **$30,969** | CoinGecko, same update                                                                                 |
| Approximate 7d volume        |        **$231,916** | Sum of seven daily API observations from 2026-08-28 through 2026-09-03 00:00 UTC; see limitation below |
| Approximate 7d daily average |     **$33,131/day** | $231,916 / 7                                                                                           |
| Market cap                   |      **$1,420,438** | CoinGecko, same update                                                                                 |
| Circulating supply           | **996,198,816 SAN** | CoinGecko, same update; candidate tables use the requested normalized 1B supply                        |
| Total supply                 |     999,998,816 SAN | CoinGecko, same update                                                                                 |
| PumpSwap 24h volume          |             $30,416 | GeckoTerminal fetched 2026-09-03T15:32:56Z-15:32:57Z                                                   |
| PumpSwap liquidity           |        **$110,964** | GeckoTerminal, same fetch window                                                                       |
| CoinGecko +2% depth          |       **$2,182.05** | CoinGecko market page fetched 2026-09-03T15:29:46Z                                                     |
| CoinGecko -2% depth          |       **$2,175.49** | CoinGecko market page fetched 2026-09-03T15:29:46Z                                                     |
| WETH modeling price          |           $2,489.45 | CoinGecko `last_updated_at`: 2026-09-03T15:30:40Z                                                      |

The independent DexScreener read at 2026-09-03T15:32:56Z reported $0.001461,
$31,408 of 24-hour volume, and $113,620 of liquidity for the same pool. The
small differences are normal snapshot/provider differences. All calculations
below use the single internally consistent CoinGecko price of $0.00142459 and
24-hour volume of $30,969. PumpSwap liquidity is an observed Solana SAN/WSOL
pool; it is not the planned Robinhood SAN/WETH pool.

The 7d number is an approximation, not an exchange-provided cumulative
counter. CoinGecko's seven daily `total_volumes` observations were $47,836,
$29,174, $17,006, $18,717, $30,244, $23,166, and $65,773. The partial rolling
observation at 2026-09-03T15:28Z was excluded to avoid overlapping the final
complete daily sample.

### Exact public sources

- CoinGecko canonical asset API:
  <https://api.coingecko.com/api/v3/coins/san-chan?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false&sparkline=false>
- CoinGecko seven-day series:
  <https://api.coingecko.com/api/v3/coins/san-chan/market_chart?vs_currency=usd&days=7&interval=daily>
- CoinGecko market/depth page: <https://www.coingecko.com/en/coins/san-chan>
- GeckoTerminal pools by canonical mint:
  <https://api.geckoterminal.com/api/v2/networks/solana/tokens/GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump/pools?page=1>
- DexScreener pairs by canonical mint:
  <https://api.dexscreener.com/latest/dex/tokens/GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump>
- CoinGecko ETH/USD reference:
  <https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_last_updated_at=true>

## Methodology and assumptions

- Candidate capacities are 50M, 100M, 250M, 500M, and 1B SAN in each local
  directional bucket.
- Supply percentages use the requested normalized 1,000,000,000 SAN. Using
  CoinGecko's 996.199M estimated circulating supply changes them only slightly.
- The future Robinhood pool is modeled as $100,000 total value, initially
  $50,000 SAN and $50,000 WETH.
- Constant-product calculations assume no fee, no concentrated liquidity, no
  competing venue, no gas or LayerZero fee, no latency, no MEV, and an
  unchanged external price during correction.
- “WETH value” is the USD value of WETH at $2,489.45/WETH. The modeled initial
  reserves are approximately 35.098M SAN and 20.085 WETH.
- Capacity is compared with **directional cross-chain inventory movement**, not
  with gross DEX volume. Stress percentages are assumptions, not predictions.
- “One full refill” means the initial full bucket plus one additional capacity
  admitted over time: total throughput up to `2C`. “Two full refills” means
  total throughput up to `3C`, assuming no pause and enough assets/messages.
- These are token buckets, not strict rolling 24-hour caps.

Implementation behavior was inspected directly in `contracts/SanOFT.sol`,
`programs/oft/src/state/peer_config.rs`,
`programs/oft/src/instructions/set_peer_config.rs`,
`programs/oft/src/instructions/send.rs`, and
`programs/oft/src/instructions/lz_receive.rs`. Production profile/checker
behavior was inspected in `scripts/productionRateLimitPolicy.ts` and
`scripts/checkProductionMainnet.ts`.

## Candidate limits at the current snapshot

| Candidate | SAN represented |   USD value | % of 1B supply | % of planned $100k pool | Multiple of current 24h volume | Multiple of market cap | Initial full bucket | Initial + one full refill |
| --------- | --------------: | ----------: | -------------: | ----------------------: | -----------------------------: | ---------------------: | ------------------: | ------------------------: |
| 50M       |      50,000,000 |  $71,229.50 |             5% |                  71.23% |                          2.30x |                 0.050x |       50M / $71,230 |           100M / $142,459 |
| 100M      |     100,000,000 |    $142,459 |            10% |                 142.46% |                          4.60x |                 0.100x |     100M / $142,459 |           200M / $284,918 |
| 250M      |     250,000,000 | $356,147.50 |            25% |                 356.15% |                         11.50x |                 0.251x |     250M / $356,148 |           500M / $712,295 |
| 500M      |     500,000,000 |    $712,295 |            50% |                 712.30% |                         23.00x |                 0.501x |     500M / $712,295 |           1B / $1,424,590 |
| 1B        |   1,000,000,000 |  $1,424,590 |           100% |               1,424.59% |                         46.00x |                 1.003x |     1B / $1,424,590 |           2B / $2,849,180 |

The 1B and multi-refill rows are mathematical throughput ceilings. Actual loss
cannot exceed assets that exist and are reachable: current circulating supply,
Robinhood representation supply, and Solana escrow are independent hard
constraints. The rows remain useful because recycled inventory, Solana
cross-refill, and delayed incident response can make cumulative gross throughput
larger than a single bucket.

## Volume is not bridge demand

Five different flows must not be collapsed into one “volume” number:

| Category                              | What it measures                                                                       | Effect on required bridge capacity                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. DEX trading volume                 | Gross swaps, often the same inventory changing hands repeatedly                        | Usually the largest displayed number and the weakest direct proxy. It can be high with zero bridge use.                                                                    |
| B. Genuine cross-chain user transfers | Users changing the chain on which they hold SAN                                        | Directly consumes source outbound and destination inbound capacity. It may be one-way and persistent.                                                                      |
| C. Market-maker inventory rebalancing | Replenishment after local buys/sells exhaust one side of an MM's inventory             | Consumes only the **net** inventory imbalance not covered by local holdings or offsetting customer flow.                                                                   |
| D. Arbitrage-driven movement          | Inventory moved to repair cross-chain price differences                                | A pool trade need not cause a bridge transfer. Existing Robinhood SAN/WETH, borrowed inventory, or opposite flow can satisfy it. Later net rebalancing may use the bridge. |
| E. Malicious/abnormal outflow         | Forged/authenticated-bad messages, compromised governance, exploit flow, or panic exit | Can attempt to consume the entire available bucket immediately and continue as it refills. This drives the security ceiling, not ordinary volume estimates.                |

Therefore `$1M DEX volume = $1M bridge demand` is false. A rate policy should
use measured per-direction bridge utilization and inventory data, while total
volume is only a context and stress input.

## Arbitrage stress model

Let aligned pool reserves be `R = 35,097,818 SAN` and `Q = $50,000 of WETH`.
For a pool price `d` above the Solana reference, the zero-fee constant-product
correction sells approximately `R * (sqrt(1+d)-1)` SAN into the pool and
withdraws `Q * (1-1/sqrt(1+d))` of WETH value. For a pool price below the
reference by the reciprocal factor, the correction deposits
`Q * (sqrt(1+d)-1)` of WETH value and withdraws
`R * (1-1/sqrt(1+d))` SAN.

| Dislocation | Pool SAN too expensive: SAN sold in |      WETH withdrawn | Pool SAN too cheap: WETH deposited | SAN withdrawn |
| ----------- | ----------------------------------: | ------------------: | ---------------------------------: | ------------: |
| 5%          |                         866,743 SAN | $1,205 / 0.484 WETH |                $1,235 / 0.496 WETH |   845,855 SAN |
| 10%         |                       1,713,084 SAN | $2,327 / 0.935 WETH |                $2,440 / 0.980 WETH | 1,633,362 SAN |
| 20%         |                       3,349,915 SAN | $4,356 / 1.750 WETH |                $4,772 / 1.917 WETH | 3,058,040 SAN |
| 30%         |                       4,919,852 SAN | $6,147 / 2.469 WETH |                $7,009 / 2.815 WETH | 4,314,995 SAN |
| 50%         |                       7,888,055 SAN | $9,175 / 3.686 WETH |               $11,237 / 4.514 WETH | 6,440,570 SAN |

“Amount traded through the pool” is the gross input/output in the table.
“Amount that must cross the SAN bridge immediately” ranges from zero to the SAN
leg:

- When SAN is expensive on Robinhood, an arbitrageur with at least the listed
  Robinhood SAN inventory can sell locally and bridge nothing immediately. If
  local inventory is insufficient, up to the SAN-in amount may have to arrive
  from Solana, subject to latency and capacity.
- When SAN is cheap on Robinhood, the arbitrageur needs WETH, buys SAN from the
  pool, and needs no SAN bridge transfer to execute the trade. Up to the SAN-out
  amount may later return to Solana to restore inventory or realize the trade.
- Opposite customer flow, another market maker, borrowing, or retained
  inventory can reduce or eliminate later bridge demand.
- WETH is not carried by this SAN bridge. Its sourcing is a separate liquidity
  problem.

Even the conservative 50% correction uses only 7.89M SAN, so a 30M early-public
bucket provides about 3.8x headroom and a 50M bucket about 6.3x. This does not
prove price parity: the live Solana ±2% depth is only about $2.18k per side,
fees/latency matter, and price can move during message delivery.

## Volume stress scenarios

The table applies assumed cross-chain inventory shares to gross daily trading
volume. It is a capacity illustration, not a forecast.

| Gross daily trading volume | 10% cross-chain movement | 25% cross-chain movement | 50% cross-chain movement |
| -------------------------- | -----------------------: | -----------------------: | -----------------------: |
| $50k                       |          $5k / 3.51M SAN |       $12.5k / 8.77M SAN |        $25k / 17.55M SAN |
| $100k                      |         $10k / 7.02M SAN |        $25k / 17.55M SAN |        $50k / 35.10M SAN |
| $250k                      |        $25k / 17.55M SAN |      $62.5k / 43.87M SAN |       $125k / 87.74M SAN |
| $500k                      |        $50k / 35.10M SAN |       $125k / 87.74M SAN |      $250k / 175.49M SAN |
| $1M                        |       $100k / 70.20M SAN |      $250k / 175.49M SAN |      $500k / 350.98M SAN |
| $5M                        |      $500k / 350.98M SAN |     $1.25M / 877.45M SAN |       $2.5M / 1.755B SAN |

The $5M/50% case exceeds current supply and is intentionally a stress result;
it demonstrates that gross activity can be incompatible with a one-way daily
inventory assumption and would require recycling, offsetting flow, much deeper
inventory, or a different market structure.

## Rate-limit capacity and bottlenecks

For an assumed fraction of DEX volume that becomes same-direction cross-chain
inventory movement, the following is the maximum gross daily market volume a
full nominal daily refill can support before the bridge becomes the bottleneck:

| Candidate | At 10% bridge share | At 25% bridge share | At 50% bridge share |
| --------- | ------------------: | ------------------: | ------------------: |
| 50M       |           $712k/day |           $285k/day |           $142k/day |
| 100M      |         $1.425M/day |           $570k/day |           $285k/day |
| 250M      |         $3.561M/day |         $1.425M/day |           $712k/day |
| 500M      |         $7.123M/day |         $2.849M/day |         $1.425M/day |
| 1B        |        $14.246M/day |         $5.698M/day |         $2.849M/day |

Using a deliberately conservative 50% cross-chain share for the requested
benchmarks:

| Activity benchmark  | Assumed directional bridge demand | 50M | 100M | 250M | 500M | 1B  |
| ------------------- | --------------------------------: | :-: | :--: | :--: | :--: | :-: |
| Current $30,969/day |              $15,485 / 10.87M SAN | Yes | Yes  | Yes  | Yes  | Yes |
| 2x current          |              $30,969 / 21.74M SAN | Yes | Yes  | Yes  | Yes  | Yes |
| 5x current          |              $77,423 / 54.35M SAN | No  | Yes  | Yes  | Yes  | Yes |
| 10x current         |            $154,845 / 108.69M SAN | No  |  No  | Yes  | Yes  | Yes |
| $1M/day market      |            $500,000 / 350.98M SAN | No  |  No  |  No  | Yes  | Yes |
| $5M/day market      |                $2.5M / 1.755B SAN | No  |  No  |  No  |  No  | No  |

The bridge becomes the bottleneck when same-direction source-outbound or
destination-inbound demand exceeds the smaller currently available bucket. It
can bottleneck earlier than the nominal daily table after a burst, and later
than the table under Solana cross-refill or offsetting flow. A pending transfer
is not evidence that the limit is economically wrong; quotes do not reserve
capacity and an isolated large user can exceed a healthy risk ceiling.

## Security blast radius

The conservative catastrophic-failure model assumes a bad authenticated path
can consume a full available directional bucket and remains undetected while it
refills. It does not assume the rate limit validates the transfer.

| Candidate | One available bucket | % of 1B supply | % of planned pool | Initial + one refill | Initial + two refills |
| --------- | -------------------: | -------------: | ----------------: | -------------------: | --------------------: |
| 50M       |        50M / $71,230 |             5% |               71% |      100M / $142,459 |       150M / $213,689 |
| 100M      |      100M / $142,459 |            10% |              142% |      200M / $284,918 |       300M / $427,377 |
| 250M      |      250M / $356,148 |            25% |              356% |      500M / $712,295 |     750M / $1,068,443 |
| 500M      |      500M / $712,295 |            50% |              712% |      1B / $1,424,590 |     1.5B / $2,136,885 |
| 1B        |      1B / $1,424,590 |           100% |            1,425% |      2B / $2,849,180 |       3B / $4,273,770 |

A rate limit can bound the amount admitted by that bucket at a moment and slow
additional same-direction flow enough for monitoring and pause governance to
react. It cannot:

- prove Endpoint, peer, DVN, Executor, source-finality, or message correctness;
- prevent loss within the available bucket;
- guarantee a pause occurs before refill;
- stop governance from changing/removing a Solana limiter or weakening policy;
- impose a strict gross-volume ceiling on Solana, because opposite traffic
  cross-refills capacity;
- prevent a compromised Solana program upgrade from bypassing the limiter;
- reverse a completed escrow release or remote mint;
- prevent price impact, liquidity loss, MEV, censorship, or denial of service;
- create backing or make cumulative mathematical throughput economically
  realizable when escrow/supply is smaller.

For a fraudulent Robinhood-to-Solana message, actual canonical-SAN loss is also
bounded by Solana escrow and `tvl_ld`, but the Solana inbound bucket is the
critical velocity control. The 500M and 1B cases leave little meaningful
supply-based containment.

## Actual token-bucket behavior

### Robinhood `SanOFT`

The production contract has separate global outbound and inbound buckets.

- **Initial capacity:** each starts full at 500,000 SAN.
- **Refill:** 500,000 SAN over 86,400 seconds initially. Approved profiles set
  `refillAmount = capacity` and `refillDuration = 86,400`.
- **Continuity:** refill is proportional to elapsed whole block-timestamp
  seconds. `Math.mulDiv`, `mulmod`, and a stored fractional remainder preserve
  sub-unit fractions across calls.
- **Accumulation/max:** unused tokens accumulate only to `capacity`; long idle
  time never exceeds it.
- **Reconfiguration:** old state is first settled. New availability is
  `min(old available, new capacity)`. Increasing capacity does **not** create an
  immediate capacity gift; decreasing it clamps availability. The new refill
  rate can still refill faster afterward.
- **After a large transfer:** the exact received/debited amount is deducted;
  capacity then refills continuously until full.
- **Across a 24h boundary:** there is no midnight or window reset. From empty,
  one approved full capacity refills over 86,400 elapsed seconds.
- **Atomicity:** a later failure reverts capacity consumption with the transfer;
  a paused or rate-limited inbound receive remains retryable under Endpoint
  transaction atomicity.

### Solana OFT Adapter

Each peer config has optional outbound and inbound `RateLimiter` values.
Production policy requires both to be present and nonzero.

- **Initial capacity:** an absent limiter provides no limiter at the program
  branch, so production tooling must fail closed. When configured with a
  capacity, `set_capacity` sets `tokens = capacity`; it starts full.
- **Refill:** integer raw units per second, applied on calls using elapsed whole
  seconds. Production uses floor division so nominal 24h refill is never
  exceeded.
- **Continuity:** refill is linear but discrete to seconds and raw units; there
  is no fractional remainder.
- **Accumulation/max:** unused tokens accumulate only to `capacity`.
- **Reconfiguration capacity gift:** **yes.** The actual `set_capacity`
  implementation always resets `tokens` to the new capacity and updates the
  timestamp. Increasing, decreasing, or reapplying capacity therefore grants a
  full bucket immediately. This differs from Robinhood and must be included in
  every governance simulation, decoded proposal, before/after read-back, and
  blast-radius approval.
- **After a large transfer:** outbound consumes outbound tokens and adds the
  same amount to inbound tokens; inbound consumes inbound tokens and adds the
  same amount to outbound tokens, each capped at capacity.
- **Across a 24h boundary:** there is no boundary reset. Floor-rounded 50M
  refills 49,999,999.9392 SAN in 86,400 seconds and reaches the cap on a later
  second. The shortfall is economically negligible but implementation-real.

| Candidate |       Raw capacity | Solana floor refill raw/s | Refilled in 86,400s shortfall |
| --------- | -----------------: | ------------------------: | ----------------------------: |
| 50M       |   `50000000000000` |               `578703703` |                    0.0608 SAN |
| 100M      |  `100000000000000` |              `1157407407` |                    0.0352 SAN |
| 250M      |  `250000000000000` |              `2893518518` |                    0.0448 SAN |
| 500M      |  `500000000000000` |              `5787037037` |                    0.0032 SAN |
| 1B        | `1000000000000000` |             `11574074074` |                    0.0064 SAN |

Solana cross-refill means its buckets principally constrain **net directional
imbalance**, not gross flow. Repeated back-and-forth traffic can exceed either
nominal daily amount. Robinhood's independent time buckets are more likely to
be the steady-state bottleneck under balanced high gross flow.

## Four enforcement directions

| Enforcement point  | End-to-end route    | State change                                                                            | Demand/risk observation                                                                                                                           |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solana outbound    | Solana -> Robinhood | Locks canonical SAN; consumes Solana outbound and refills Solana inbound                | Likely driven by launch deposits and MM inventory seeding; cross-refill can restore it after returns.                                             |
| Robinhood inbound  | Solana -> Robinhood | Mints authenticated `SanOFT`; consumes Robinhood inbound                                | Independent time refill; likely effective bottleneck for sustained deposits. A bad receive can create unbacked representation within this bucket. |
| Robinhood outbound | Robinhood -> Solana | Burns `SanOFT`; consumes Robinhood outbound                                             | Exit, redemption, or panic flow can be lumpy. Independent time refill; likely effective bottleneck for sustained withdrawals.                     |
| Solana inbound     | Robinhood -> Solana | Releases canonical SAN from escrow; consumes Solana inbound and refills Solana outbound | Custody-critical direction. Fraudulent accepted flow directly releases canonical SAN; prior deposits may have cross-refilled this bucket.         |

Every complete transfer must fit both its source-outbound and destination-
inbound bucket, so effective availability is the smaller of the two at the
relevant execution times. Demand should not be assumed symmetric. Early launch
may skew Solana -> Robinhood; a price shock or loss of confidence may reverse
flow sharply. Robinhood -> Solana deserves at least equal conservatism because
it burns the representation and releases canonical escrow. Do not raise that
pair merely to clear a queue.

Matched profiles in all four locations are simplest and are what the current
checker enforces. Any future asymmetric policy needs a separate invariant,
stranding, in-flight-message, and checker review.

## Price-spike sensitivity

The token bucket is SAN-denominated, so dollar loss exposure rises linearly
with price even when configuration never changes.

| SAN price | 50M bucket | 100M bucket | 250M bucket | 500M bucket |   1B bucket |
| --------- | ---------: | ----------: | ----------: | ----------: | ----------: |
| $0.001    |    $50,000 |    $100,000 |    $250,000 |    $500,000 |  $1,000,000 |
| $0.0015   |    $75,000 |    $150,000 |    $375,000 |    $750,000 |  $1,500,000 |
| $0.002    |   $100,000 |    $200,000 |    $500,000 |  $1,000,000 |  $2,000,000 |
| $0.005    |   $250,000 |    $500,000 |  $1,250,000 |  $2,500,000 |  $5,000,000 |
| $0.01     |   $500,000 |  $1,000,000 |  $2,500,000 |  $5,000,000 | $10,000,000 |
| $0.02     | $1,000,000 |  $2,000,000 |  $5,000,000 | $10,000,000 | $20,000,000 |

For initial bucket plus one full refill, multiply each value by two; for two
full refills, multiply by three. At $0.01, today's 50M “normal” token limit
would expose $500,000 immediately—five times the planned pool. Governance must
be willing to **lower the SAN amount as price rises** to preserve a dollar loss
budget. Maturity review must not be an upward-only ratchet.

## Answers to the required questions

### Is 50M SAN/day actually too restrictive for SAN?

**No, not on current evidence.** It is $71,229.50 at the snapshot price,
2.30x all current 24-hour DEX volume, about 2.15x the approximate seven-day
daily average when compared in USD, and 6.3x the conservative SAN leg of a 50%
correction in the modeled $100k pool. Because only net same-direction inventory
movement needs the bridge, current gross volume overstates likely bridge demand.

### At what observed level would 50M become a meaningful bottleneck?

The hard economic threshold is **50M SAN or $71,230 of same-direction bridge
demand per nominal day**, with burst state considered separately. Expressed as
gross DEX volume, that is approximately:

- $142k/day if 50% requires same-direction bridge movement;
- $285k/day if 25% does; or
- $712k/day if 10% does.

Review should start before exhaustion—at repeated 60%-80% directional bucket
use (30M-40M SAN/day)—rather than waiting for failures.

### At what activity level would 100M become a bottleneck?

At **100M SAN or $142,459 of same-direction daily bridge demand**. Equivalent
gross-volume thresholds are about $285k/day at a 50% share, $570k/day at 25%,
or $1.425M/day at 10%.

### At what point does 250M become justified?

Not from current volume, current depth, or the planned pool. Consider 250M only
when all of the following are true:

1. Measured, legitimate directional bridge demand repeatedly approaches
   70%-80% of a 100M bucket (70M-80M SAN/day; roughly $100k-$114k/day now), not
   merely gross DEX volume.
2. The $100k Robinhood pool and market-maker inventory have grown materially,
   with observed reserve and depth evidence.
3. The bridge has incident-free operating history, tested monitoring, and a
   demonstrated pause SLA shorter than the economically relevant refill time.
4. Governance explicitly accepts an immediate 250M / $356k / 25%-of-supply
   bucket and up to 500M / $712k through initial burst plus one refill.
5. SAN price sensitivity is re-run; an equivalent dollar-risk target may
   require fewer, not more, SAN.

At assumed bridge shares, 70M-80M SAN/day corresponds to gross volume around
$199k-$228k/day at 50%, $399k-$456k/day at 25%, or $997k-$1.14M/day at 10%.

## Recommended maturity policy

| Stage        | Recommendation             | Graduation evidence                                                                                                                                                                             |
| ------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canary       | **500k SAN per direction** | Short, separately authorized validation only; complete reconciliation, four-bucket read-back, message evidence, and incident readiness. It is intentionally below ordinary 5% arbitrage demand. |
| Early public | **30M SAN per direction**  | Actual pool reserves; incident-free canary; governance and independent review; fresh price/depth; monitoring and pause coverage.                                                                |
| Normal       | **50M SAN per direction**  | Repeated legitimate use or operational need beyond 30M, stable accounting, proven MM inventory process, and explicit loss-budget approval.                                                      |
| Mature       | **100M SAN per direction** | Repeated 60%-80% use of 50M from legitimate directional demand, materially deeper liquidity, proven pause drills/SLA, and acceptance of 10% supply immediate exposure.                          |

Do not automatically graduate with elapsed time. Do not adopt 250M or 500M as
pre-approved tiers. They require a new economic/security decision. Because a
Solana capacity change grants a full bucket immediately, every tier change must
be executed while paused, account for in-flight messages and current bucket
state, and be independently read back before any separately approved unpause.

The current production policy helper recognizes only 500k, 30M, and 50M. The
100M mature row is an economic recommendation for a possible future review,
not an approved or executable profile. Adding it would be a separate tooling
and policy change with tests, independent review, and explicit authorization;
this task makes no such change.

## Monitoring and increase/decrease triggers

Review, but do not automatically change, limits when:

- 24-hour total volume is at least 2x the approved baseline on multiple days;
- the seven-day average is at least 2x for two consecutive review windows;
- Robinhood pool liquidity or market-maker committed inventory changes
  materially;
- SAN price doubles, crosses an approved dollar-risk band, or makes one bucket
  exceed the approved USD loss budget;
- either end-to-end direction repeatedly uses 60% of the effective bucket;
- utilization repeatedly exceeds 80%, transfers queue, or quotes fail for
  ordinary-size users;
- arbitrageurs report constraints corroborated by bucket telemetry, pool
  reserves, quotes, and net inventory—not reports alone;
- ±2% depth deteriorates, spreads widen, volume concentration changes, or the
  PumpSwap pool migrates;
- pause latency, monitoring coverage, governance membership, finality policy,
  LayerZero configuration, or threat assumptions change.

Increase only by explicit multisig approval after decoded simulation, economic
review, in-flight reconciliation, and four-direction before/after read-back.
Decrease when price appreciation raises USD exposure, liquidity/depth falls,
incident response degrades, abnormal directional flow appears, or ordinary
demand remains well below the risk budget. Never raise a limit solely to make a
pending transfer succeed.

## Limitations and remaining uncertainty

- Market data is volatile, aggregator-derived, and changed by a few percent
  during the collection window. It must be refreshed at every activation or
  limit change.
- The seven-day aggregate is derived from daily API observations rather than a
  canonical exchange counter.
- CoinGecko's depth figure is a venue snapshot and may include routing and
  methodology assumptions not reproduced here.
- The future Robinhood pool does not exist. Actual WETH price, reserves, fee,
  LP concentration, routing, latency, gas, and MM inventory are unknown.
- Constant-product calculations are comparative estimates, not executable
  swap quotes or predictions.
- No historical cross-chain demand exists because the production bridge is not
  deployed. The 10%/25%/50% shares are scenarios only.
- Phase 5A.4 subsequently froze a 30-block Robinhood L2 source-depth policy.
  That value is not Ethereum finality; rate limits and pause do not substitute
  for L1 settlement, rollup correctness, or correct LayerZero configuration.
- A token bucket cannot express a strict rolling-day gross-volume ceiling, and
  Solana cross-refill further separates gross throughput from net exposure.
- Dollar values do not belong on-chain; governance and monitoring must perform
  the conversion externally.

## Validation and mandatory stop

- Created only `docs/FINAL_RATE_LIMIT_ANALYSIS.md` for this task.
- No production bridge code, contract, Solana program, dependency, deployment
  script, or LayerZero configuration was changed.
- No rate limit was set or changed.
- No deployment, wiring, unpause, SAN transfer, approval, burn, mint, or
  liquidity action occurred.
- **Zero blockchain transactions were submitted and zero wallet signatures
  occurred.**
- Phase 5B was not entered.

STOP. Do not proceed to Phase 5B.
