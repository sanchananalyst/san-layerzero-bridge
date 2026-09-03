# Production Rate-Limit Policy

## Frozen Phase 5A.4 operating tiers

These are governance-controlled **policy values only**. They were not applied
on-chain and are not immutable bridge bytecode. SAN has six decimals, so one SAN
equals 1,000,000 raw units. The task prompt's `500000000` canary raw value would
equal only 500 SAN; the correct raw value for 500,000 SAN is
`500000000000`.

| Tier         | Capacity per direction |      Raw capacity | Solana refill/second raw |      Robinhood refill/window | Status                    |
| ------------ | ---------------------: | ----------------: | -----------------------: | ---------------------------: | ------------------------- |
| CANARY       |            500,000 SAN |    `500000000000` |                `5787037` |    `500000000000` / `86400s` | first activation only     |
| EARLY PUBLIC |         30,000,000 SAN |  `30000000000000` |              `347222222` |  `30000000000000` / `86400s` | governance graduation     |
| NORMAL       |         50,000,000 SAN |  `50000000000000` |              `578703703` |  `50000000000000` / `86400s` | evidence-gated target     |
| MATURE       |        100,000,000 SAN | `100000000000000` |             `1157407407` | `100000000000000` / `86400s` | later governance decision |

Solana refill rates use floor division by 86,400 so they never exceed the
nominal daily amount. Each selected tier applies independently and exactly to
all four configured controls: Solana outbound, Solana inbound, Robinhood
outbound, and Robinhood inbound. Missing, zero, reversed, mixed-tier, or
otherwise mismatched directions fail closed.

These token buckets permit an immediate full-capacity burst followed by refill;
they are not strict rolling-24-hour caps. Solana also cross-refills its opposite
direction, so those two controls limit net imbalance more closely than gross
volume. The detailed economic and implementation model is in
`FINAL_RATE_LIMIT_ANALYSIS.md`.

## Economic basis

The measurement snapshot used for this freeze is:

- SAN price: **$0.00142459**;
- current 24-hour market volume: approximately **$30,969**; and
- planned PumpSwap liquidity: approximately **$110,964**.

|   Amount | Approximate value at measured price |
| -------: | ----------------------------------: |
|  50M SAN |                             $71,230 |
| 100M SAN |                            $142,459 |
| 250M SAN |                            $356,148 |
| 500M SAN |                            $712,295 |

The 50M profile is not presently a throughput bottleneck relative to observed
market activity. It becomes a meaningful constraint only after substantial
growth in legitimate _directional bridge demand_. DEX volume is not bridge
demand: trades can occur without bridging, and market makers can rebalance from
inventory already held on both chains. Bridge flow and limiter utilization must
therefore be monitored separately from DEX volume.

Governance may raise a profile without changing bridge code, but every increase
raises the amount exposed to catastrophic loss before pause and response. A
review is triggered by repeated directional utilization in the **60–80%**
range, or by any of: 2x volume growth, a material liquidity increase, a material
SAN price increase, or a documented arbitrage/rebalancing constraint. A trigger
starts analysis; it does not authorize a change.

## Solana capacity-change hazard

`PeerConfig::set_capacity` sets the bucket's tokens to the new capacity. A
Solana capacity change therefore resets that bucket to full availability and is
an immediate capacity grant—even if the old bucket was partly depleted.

Every Solana production capacity increase must:

1. occur while both bridge applications are paused;
2. be approved by the designated production multisig;
3. be independently simulated with decoded instructions and expected state;
4. be independently read back after execution; and
5. be reviewed as an immediate grant of the full new capacity.

Never change a limiter merely to clear a pending transfer. The EVM limiter's
capacity-change semantics differ and preserve/clamp accrued availability, so
operators must not assume the two implementations behave alike.

## Graduation and rollback

Canary activation is public and permissionless once unpaused; 500,000 SAN is a
capacity, not a reserved operator transfer. Move to EARLY PUBLIC only after the
canary observation window and a distinct governance approval. Move to NORMAL
only with measured demand and incident-free operational evidence. MATURE is not
part of initial activation and requires a later explicit risk decision. A
pause, incident, invariant failure, monitoring gap, metadata drift, or anomalous
utilization blocks graduation and should prompt review or rollback.
