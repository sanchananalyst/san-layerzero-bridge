# Proposed SAN LayerZero Security Configuration

## Status

This is an unapplied Phase 5A.1 design. No peer, library, DVN, Executor, confirmation, option, pause, or rate-limit setting has been applied.

The current Robinhood defaults contain the deprecated Dead DVN and the two chains' default confirmations do not match. Production SAN must explicitly pin every pathway setting and verify the resolved state after configuration.

## DVN availability

Official metadata verified LayerZero Labs, Nethermind, and Horizen on **both** Solana mainnet and Robinhood mainnet. Their per-chain identities are:

| Provider       | Solana                                         | Robinhood                                    |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| LayerZero Labs | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` | `0xd01ae6905d48315f7be10c7330aecf8360ef5b12` |
| Nethermind     | `GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab` | `0x0ffe02df012299a370d5dd69298a5826eacafdf8` |
| Horizen        | `HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX` | `0x1258a278519c7f4bd997a9c3bfd4aa802a028d89` |

The LayerZero production guidance requires independent operators and at least two effective DVNs for production token bridges. An attestation threshold is a custody boundary: a forged Solana-to-Robinhood message mints unbacked SAN; a forged Robinhood-to-Solana message releases escrow.

## Compared configurations

### Option A — LayerZero Labs and Nethermind both required

`requiredDVNCount = 2`, no optional DVNs.

- Safety: both independent operator pipelines must be compromised to forge a message.
- Liveness/censorship: either DVN can stall the entire pathway.
- Complexity: simplest to reason about and operate.
- Conclusion: secure fail-closed baseline, but one-provider outage is a single liveness failure.

### Option B — LayerZero required, one-of-two additional providers

LayerZero Labs is required; Nethermind and Horizen are optional with `optionalDVNThreshold = 1`.

- Safety: LayerZero Labs plus either Nethermind or Horizen must be compromised, so the minimum forge threshold is two.
- Liveness/censorship: LayerZero Labs is always mandatory. Its outage halts the path even when both other providers are healthy. Either additional provider can be unavailable.
- Conclusion: better provider redundancy than A, but it preserves a single-company LayerZero Labs liveness veto.

### Option C — two-of-three optional threshold

No required DVNs, with LayerZero Labs, Nethermind, and Horizen as optional DVNs and `optionalDVNThreshold = 2`.

- Safety: any two independent providers must be compromised to forge.
- Liveness: one provider may be unavailable or censoring without stalling the channel.
- Complexity: one additional provider, fee stream, operational relationship, and monitoring surface.
- Conclusion: **recommended**, subject to human validation of all three providers' production independence, pricing, service commitments, and both-chain health.

This recommendation follows the installed ULN semantics: every required DVN plus the optional threshold must attest. The SDK/config generator must encode an explicit “no required set” rather than the zero/default sentinel, and must sort DVNs in the program-required byte order. A dry run and read-back are mandatory.

The semantics were traced in the installed/pinned LayerZero checkout at commit `34321ac15e47e0dafd25d66659e2f3d1b9b6db8f`, not inferred from names. EVM `packages/layerzero-v2/evm/messagelib/contracts/uln/UlnBase.sol` and `ReceiveUlnBase.sol` verify every required DVN, then count verified optional DVNs until the threshold is exhausted. Solana `programs/programs/uln/src/state/uln.rs` and `instructions/dvn/commit_verification.rs` implement the same two-stage rule. On both implementations, required count `255` is the explicit NIL sentinel that overrides inherited required DVNs to none; a literal zero means inherit the default. With explicit none, three optional DVNs, and threshold two, exactly any two of the three can satisfy verification in either direction. This agrees with LayerZero's [ULN/DVN configuration guide](https://docs.layerzero.network/v2/developers/evm/configuration/dvn-executor-config) and [production DVN guidance](https://docs.layerzero.network/v2/concepts/modular-security/production-dvn-configuration).

| Configuration                                 | Minimum compromises to forge | Minimum outages to halt | Mandatory company | LayerZero Labs unavailable                |
| --------------------------------------------- | ---------------------------: | ----------------------: | ----------------- | ----------------------------------------- |
| A: LZ + Nethermind required                   |                          `2` |                     `1` | both              | halted                                    |
| B: LZ required; Nethermind/Horizen one-of-two |                          `2` | `1` (LZ), otherwise `2` | LayerZero Labs    | halted                                    |
| C: LZ/Nethermind/Horizen any-two              |                          `2` |                     `2` | none              | remains live through Nethermind + Horizen |

If the team is unwilling to add Horizen, choose Option A and explicitly accept the one-DVN liveness veto. Never use one effective DVN.

## Proposed bidirectional pathway

| Setting                     | Solana → Robinhood                                           | Robinhood → Solana                                           | Rationale                                                         |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Source send library         | Solana ULN302 program `7a4W…dXVH` / resolved message-lib PDA | SendUln302 `0xC391…2de7`                                     | Pin current official ULN302; do not inherit                       |
| Destination receive library | ReceiveUln302 `0xe184…1043`                                  | Solana ULN302 program `7a4W…dXVH` / resolved message-lib PDA | Match the source send library version                             |
| DVNs                        | 2-of-3 LZ Labs, Nethermind, Horizen using Solana identities  | 2-of-3 same providers using Robinhood identities             | two-provider compromise threshold with one outage tolerated       |
| Confirmations               | `32` in Solana send and Robinhood receive                    | `30` in Robinhood send and Solana receive                    | Robinhood value is L2 depth, not Ethereum finality                |
| Executor                    | `AwrbHe…Y7xK` in the Solana source send config               | `0x4208…0A0b` in Robinhood source send config                | current official LayerZero Executor workers; pin explicitly       |
| Max message size            | explicit value sufficient for the supported OFT payload      | explicit value sufficient for the supported OFT payload      | benchmark standard send and reject accidental default inheritance |

In ULN, confirmations are **source-chain block confirmations** a DVN waits before verification. On Solana, `32` means 32 slots/blocks after the source event. On Robinhood, `30` means 30 Robinhood/Nitro L2 blocks after the source event. It is not the Arbitrum Ethereum fraud-proof challenge period, proof of L1 batch posting, or Ethereum L1 finality. See `docs/ROBINHOOD_FINALITY_POLICY.md`.

Executor concentration remains: LayerZero has one Executor per pathway. Delivery is permissionless after verification, but the team must test manual delivery/retry and monitor Executor health before launch.

## Enforced execution options

Proposed launch baseline for standard OFT `SEND` (`msgType = 1`) in both directions:

```text
LZ_RECEIVE gas/compute = 200,000
LZ_RECEIVE value       = 0
```

- Destination Robinhood interprets `200,000` as EVM gas. It is deliberately above simple OFT examples, but must be confirmed by mainnet-fork or equivalent bytecode gas profiling.
- Destination Solana interprets it as compute units. LayerZero's current guidance uses application-level enforced compute and recommends a `200,000` starting point for Solana delivery.
- Keep enforced `value = 0`. If a Solana recipient ATA is absent, the sender should add the current rent-exempt amount in per-transaction `extraOptions` after a read-only ATA/rent query. Do not permanently enforce a static rent payment, because existing-ATA transfers would overpay and rent can change.
- Do not enforce a native drop or ordered execution for the base token transfer.

Composed sends (`msgType = 2`) are outside the initial launch scope. The standard OFT exposes them, so UI policy alone is not a protocol prohibition. Before supporting compose, independently profile and enforce both `LZ_RECEIVE` and `LZ_COMPOSE` resources and audit the composer. The initial config review must ensure type-2 options are intentional, not copied from an example.

## Native pause, caps, and rate limits

### Solana Adapter

The installed official Solana OFT program natively provides:

- a global `paused` flag checked by quote, send, and receive;
- separately configurable `pauser` and `unpauser` roles;
- per-peer outbound and inbound token-bucket rate limiters (`capacity`, `refill_per_second`);
- per-peer fees and enforced options.

Use these native controls rather than modifying `programs/oft`. The launch policy should assign pause roles to reviewed multisig/emergency governance and use the Phase 3.5 limits below only after explicit risk approval.

### Robinhood SanOFT

Production `SanOFT` retains standard OFT authentication/accounting and adds a
bridge-only pause plus independent inbound/outbound token buckets. Ordinary
ERC-20 transfers remain available while bridge paths are paused.

### EVM emergency-control decision

| Choice                            | Security-sensitive code                                    | Upgradeability                                                               | Admin/audit risk                                                    | Incident containment                                                                       | OFT tooling                                                                |
| --------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1. Minimal standard OFT           | essentially none beyond `SanOFT` constructor/decimals      | non-upgradeable as currently deployed                                        | smallest admin and audit surface                                    | no native pause or velocity bound; owner can reconfigure peer only after governance action | fully standard                                                             |
| 2. Small SAN inheritance override | approximately 60–120 Solidity lines plus substantial tests | keep non-upgradeable                                                         | new pauser/rate-admin DoS and parameter risks; focused audit needed | can halt debit/credit and cap loss per window                                              | standard external OFT interface retained if hooks are overridden carefully |
| 3. Extended/stablecoin framework  | materially larger dependency/role surface                  | commonly designed for richer role/upgrade patterns, to be decided explicitly | largest configuration and audit burden                              | strongest built-in operational feature set where supported                                 | LayerZero-compatible but less minimal and more specialized                 |

**Implemented choice: Option 2.** The focused non-upgradeable extension preserves
standard authentication/accounting, overrides only debit/credit/quote behavior,
and adds no arbitrary mint. It is covered by Hardhat and Foundry tests and still
requires independent audit.

## Proposed initial rate-limit profiles

> **Superseded:** the Phase 3 values below were engineering placeholders. Phase
> 5A re-evaluated production market capacity; use
> `docs/PRODUCTION_RATE_LIMIT_POLICY.md` for the frozen unapplied policy.

These are risk-budget proposals, not applied settings. They cap aggregate cross-chain flow per direction; the same bucket sizes are proposed in both directions. Robinhood-to-Solana execution is additionally bounded by escrow/TVL and Robinhood circulating supply.

| Profile           | Solana → Robinhood capacity | Refill                   | Robinhood → Solana capacity | Frontend single-transfer maximum |
| ----------------- | --------------------------: | ------------------------ | --------------------------: | -------------------------------: |
| Canary            |               `500,000 SAN` | `500,000 SAN / 24 h`     |               `500,000 SAN` |              separately approved |
| Early public      |            `30,000,000 SAN` | `30,000,000 SAN / 24 h`  |            `30,000,000 SAN` |              separately approved |
| Normal operations |            `50,000,000 SAN` | `50,000,000 SAN / 24 h`  |            `50,000,000 SAN` |              separately approved |
| Mature operations |           `100,000,000 SAN` | `100,000,000 SAN / 24 h` |           `100,000,000 SAN` |              separately approved |

Capacities are approximately `0.05%`, `3%`, `5%`, and `10%` of the ~1B SAN supply. Promotions require incident-free observation, monitoring, governance approval, and matching enforced controls on both chains. Frontend limits are usability policy only and are **not security controls** unless the contracts/programs enforce them on-chain.

## Required read-back gates

Before public bridging, independently read and compare all four custom ULN configs (two sends, two receives), both libraries, both peers, both Executors, both enforced-option sets, and all authorities. Confirm:

- no field is inheriting a default sentinel;
- no Dead DVN is present;
- all effective DVNs and thresholds match the approved matrix;
- Solana-source confirmations are `32` and Robinhood-source confirmations match
  the explicit separately approved value;
- address arrays are correctly sorted;
- standard sends have the measured execution resources; and
- a rollback/pause/manual-delivery drill has passed on an approved non-production environment.

Run `pnpm san:check-layerzero-config` after both applications exist. It is strictly read-only and intentionally fails closed while `SAN_SOLANA_OFT_STORE` or `SAN_ROBINHOOD_OFT_ADDRESS` is unset. It compares both directions' peers, libraries, Executors, confirmations, required/optional DVNs, thresholds, and current deprecated/Dead-DVN metadata against the pinned policy.
