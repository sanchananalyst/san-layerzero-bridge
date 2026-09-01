# SAN Solana–Robinhood Bridge Architecture

## Scope and status

This document defines the intended architecture through Phase 3. Nothing in this repository is deployed or wired. Solana is the canonical SAN ledger; Robinhood Chain holds only the LayerZero OFT representation of SAN escrowed on Solana.

The only canonical SAN mint is `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`. Read-only finalized mainnet inspection verified that it is a legacy SPL Token mint with 6 decimals, fixed supply, and revoked mint and freeze authorities. See [`SAN_SOLANA_ADAPTER.md`](./SAN_SOLANA_ADAPTER.md).

Known network identifiers:

| Network                 | Native chain identifier | LayerZero V2 EID |
| ----------------------- | ----------------------: | ---------------: |
| Solana mainnet          |                     n/a |          `30168` |
| Robinhood Chain mainnet |                  `4663` |          `30416` |

Current Endpoint and message-library metadata is recorded in [`LAYERZERO_MAINNET_CONFIG.md`](./LAYERZERO_MAINNET_CONFIG.md). Those values are observations and proposals only; no pathway is configured.

## Asset flow

```text
Existing canonical SAN SPL token on Solana
                 │
                 │ lock / unlock
                 ▼
Official LayerZero Solana OFT Adapter + SAN escrow
                 │
                 │ LayerZero V2 OFT message
                 ▼
SanOFT on Robinhood Chain
       mint on authenticated receive / burn on send
```

### Solana to Robinhood

1. A SAN holder sends `X` through the Solana OFT Adapter.
2. The adapter transfers canonical SAN into its escrow account and records the outbound OFT message.
3. LayerZero V2 verifies and delivers that message according to the configured pathway security stack.
4. Robinhood's EndpointV2 calls `SanOFT.lzReceive`.
5. The inherited LayerZero OApp receive logic requires both the configured EndpointV2 caller and the configured Solana peer. The standard OFT credit logic then mints the representable amount to the recipient.

After final delivery, and assuming zero application/transfer fees, escrow backing increases by `X` and Robinhood circulating supply increases by `X`. While a message is in flight, escrow can exceed Robinhood supply.

### Robinhood to Solana

1. A holder calls the inherited `SanOFT.send` flow for `X`.
2. LayerZero's standard OFT debit logic burns the representable amount on Robinhood before sending the message.
3. LayerZero V2 verifies and delivers the message to the Solana OFT Adapter.
4. The adapter authenticates and clears the message, then transfers `X` canonical SAN from escrow to the recipient.

While the return message is in flight, the Robinhood burn has occurred but the corresponding SAN remains escrowed. After final delivery, both escrow backing and Robinhood supply decrease by `X`.

## Supply and backing invariants

- No public or privileged arbitrary mint function exists on `SanOFT`.
- Only LayerZero's inherited `_credit` can mint, and it is reachable in production through the authenticated `lzReceive` entry point.
- A direct call to `lzReceive` from an address other than Robinhood EndpointV2 reverts.
- A delivery whose source EID/sender does not match the configured Solana OFT Adapter peer reverts.
- Robinhood sends burn before message dispatch; Solana receives unlock only after LayerZero endpoint authentication and message clearing.
- With one remote representation, no fees, and no exceptional recovery operation, `SanOFT.totalSupply()` must not exceed canonical SAN held for bridge backing. Equality is expected after all messages settle; in-flight messages normally make escrow greater than Robinhood supply.
- Any fee, Token-2022 extension, failed-message recovery, rate limit, or additional chain changes this simple accounting and requires an explicit invariant analysis before activation.

## Repository component ownership

### LayerZero-provided

- `programs/oft/`: the LayerZero Solana OFT program source pinned to LayerZero V2 `oapp` and `utils` revisions. It implements both native burn/mint and adapter lock/unlock modes, endpoint CPI, peers, enforced options, pause controls, fees, and rate limits.
- `tasks/common/`, `tasks/evm/`, and most of `tasks/solana/`: LayerZero helper/task plumbing for configuration, wiring, quoting, sending, Solana store creation, and administration.
- `@layerzerolabs/oft-evm`: the standard EVM OFT implementation inherited by `SanOFT`.
- LayerZero devtools, metadata tools, protocol packages, deployment artifacts, and endpoint mocks listed in `package.json`.
- `contracts/mocks/OFTTestPeer.sol` and the helpers under `test/mocks/`: test-only contracts; they are not referenced by a deployment script and are not production artifacts.
- `programs/endpoint-mock/`: a local-test Anchor endpoint mock, not a production endpoint.

### Solana-specific

- `programs/oft/`, `programs/endpoint-mock/`, `Anchor.toml`, `Cargo.toml`, `Cargo.lock`, and `rust-toolchain.toml`.
- `tasks/solana/`: creation of an OFT or OFT Adapter, store derivation, config initialization, rate limits, authorities, metadata, endpoint recovery operations, and Solana sends.
- `OFTStore.oft_type == Adapter` is the required SAN mode: outbound transfers lock existing SAN in `token_escrow`; authenticated inbound transfers unlock it. The native mode and mint-authority workflows are not part of the SAN architecture.

### EVM-specific

- `contracts/SanOFT.sol`: the production Robinhood ERC-20 OFT representation.
- `deploy/SanOFT.ts`: a deployment description that dynamically resolves EndpointV2 from LayerZero's official deployment artifacts; it is not executed in Phase 1.
- `hardhat.config.ts`, `foundry.toml`, `test/hardhat/`, `test/foundry/`, and `test/mocks/`.
- `tasks/evm/sendEvm.ts`: generic EVM-side quote/send helper.

### Generic starter material not needed for the SAN production path

- `tasks/aptos/`, `docs/wiring-to-aptos.md`, and `docs/move.layerzero.config.ts` are examples for non-SAN pathways and must not be included in SAN production wiring.
- The sample native Solana OFT creation path creates or re-authorities a mint and therefore must not be used for SAN. Only `lz:oft-adapter:solana:create` is architecturally applicable in a later authorized phase.
- The starter `junk-id.json` wallet has been removed. Local tests generate an ignored, clearly named wallet under `target/deploy/`; no production command may use it.

## SAN-specific implementation

- Replace the sample EVM token with the minimal `SanOFT` contract.
- Name the EVM deployment artifact `SanOFT` and use SAN name/symbol arguments.
- Register Robinhood Chain mainnet in Hardhat with chain ID `4663` and LayerZero EID `30416`, without accounts or a default RPC.
- Override only ERC-20 `decimals()` in `SanOFT` so Robinhood uses the canonical mint's six-decimal precision.
- Keep the LayerZero application graph connection-free until both deployed peers and the full security configuration are verified.
- Add tests against LayerZero endpoint mocks for authenticated credit, burn-on-send, ownership, and forbidden mint surfaces.
- Add placeholder-only environment configuration and project safety rules.

No Solana program logic is modified in Phase 1. SAN will use the existing official adapter behavior rather than a custom bridge protocol.

## Decimal model

SAN uses six local decimals on both chains and LayerZero's six shared decimals:

| Quantity                          | Value |
| --------------------------------- | ----: |
| Solana local decimals             |   `6` |
| Robinhood local decimals          |   `6` |
| LayerZero shared decimals         |   `6` |
| Solana decimal conversion rate    |   `1` |
| Robinhood decimal conversion rate |   `1` |

One raw unit is exactly `0.000001 SAN` on either chain. Every `uint64` shared amount maps one-for-one to a local base unit, so no representable SAN amount produces bridge dust. The maximum shared-decimal supply is `18,446,744,073,709.551615 SAN`; the inspected fixed supply of `999,998,816.19331 SAN` is safely below it.

## Unresolved production configuration

The following still require deployed addresses, explicit configuration, and independent human review:

- OFT Store PDA, escrow address, and Robinhood `SanOFT` address;
- bidirectional peer bytes;
- send and receive message libraries;
- required/optional DVNs and any threshold;
- Executor and destination gas/compute/value options;
- confirmations in each direction;
- rate limits, pause roles, delegates, owners, upgrade authorities, and multisigs;
- RPC endpoints and deployment/verification process.

`layerzero.config.ts` intentionally declares no connections. It must not be used to wire a production pathway until the Phase 4 human gate is approved.
