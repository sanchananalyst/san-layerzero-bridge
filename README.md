# SAN LayerZero Bridge

## Pre-Mainnet Security Review

This repository contains the proposed LayerZero V2 bridge for the canonical SAN
token between Solana and Robinhood Chain.

**The canonical SAN mainnet bridge has not been deployed or activated. No
mainnet SAN bridge is currently live.** The implementation completed an
end-to-end testnet `lock → mint → burn → unlock` round trip using a separate
`tSAN` test token. All testnet addresses and assets are test-only.

We are publishing the implementation before mainnet deployment to invite
independent technical and security review. Community review is not a formal
audit, certification, or assurance that the bridge is safe. Cross-chain bridges
carry smart-contract, protocol, validator/DVN, sequencer, governance, key-
management, and operational risk.

## Canonical asset and invariant

Canonical SAN is the existing six-decimal legacy SPL token on Solana:

```text
GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump
```

The Solana side uses the official LayerZero OFT Adapter in lock/unlock mode. The
Robinhood representation uses a non-upgradeable standard LayerZero OFT with no
arbitrary mint entry point.

Core supply invariant, subject to explicit reconciliation of in-flight messages:

```text
Robinhood SAN total supply
    <= Solana OFTStore.tvl_ld
    <= canonical SAN held in the Solana bridge escrow
```

Proposed production identities:

| Item                          | Value                                          |
| ----------------------------- | ---------------------------------------------- |
| Canonical SAN mint            | `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump` |
| Production Solana OFT program | `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD` |
| Solana mainnet LayerZero EID  | `30168`                                        |
| Robinhood Chain ID            | `4663`                                         |
| Robinhood LayerZero EID       | `30416`                                        |

The OFT Store, SAN escrow, Robinhood `SanOFT`, peers, multisigs, and production
security configuration do not yet exist. Verified application addresses will be
published only after a separately authorized deployment and independent
read-back.

## Security Review Requested

We welcome review from Solana, LayerZero, EVM, bridge, and application-security
engineers. Please focus on:

- Solana OFT Adapter custody and escrow-account constraints;
- `tvl_ld` accounting and the global supply invariant;
- `withdraw_fee` principal protection and paused-state behavior;
- LayerZero Endpoint, peer, DVN, ULN, Executor, and confirmation configuration;
- local/shared-decimal conversion, dust, slippage, and six-decimal behavior;
- `SanOFT` bridge-only pause and inbound/outbound rate-limit overrides;
- resistance to arbitrary or unauthenticated minting;
- replay, malformed-message, wrong-peer, and wrong-Endpoint handling;
- Solana program upgrade authority and Store/delegate powers;
- Safe and Squads governance assumptions and authority handoff;
- deployment and wiring tooling, partial execution, and retry safety;
- wrong-chain, wrong-RPC, wrong-EID, and testnet-identity protections;
- missing, bypassed, or incorrectly targeted rate limits; and
- end-to-end preservation of the global supply invariant.

Start with:

- [Responsible disclosure](./SECURITY.md)
- [Auditor handoff](./docs/AUDITOR_HANDOFF.md)
- [Exact audit scope](./docs/AUDIT_SCOPE.md)
- [Production security review](./docs/PRODUCTION_SECURITY_REVIEW.md)

Potentially exploitable vulnerabilities should be reported privately before
public disclosure. Do not post live exploit instructions, private keys, seed
phrases, personal data, or sensitive infrastructure details in a public issue.
No bug bounty is promised unless a separate written program says otherwise.

> **Publication gate:** the responsible-disclosure contact in `SECURITY.md` is
> currently a clearly marked placeholder. This repository must remain private
> until the project owner replaces it with a monitored contact.

## Architecture

```text
Solana canonical SAN holder
        │ outbound: lock SAN, increase tvl_ld
        ▼
LayerZero Solana OFT Adapter escrow
        │ authenticated LayerZero message
        ▼
Robinhood SanOFT: mint only through authenticated credit

Robinhood outbound: burn SanOFT
        │ authenticated LayerZero message
        ▼
Solana inbound: decrease tvl_ld and release escrowed SAN
```

The proposed security stack uses explicit send/receive libraries, Executors,
peers, enforced options, and any-two-of-three DVN verification. Defaults and the
deprecated Dead DVN must not be inherited. Robinhood-source finality remains an
unresolved launch decision; a count of fast L2 blocks must not be presented as
Ethereum economic finality.

Four rate-limit controls are mandatory: Solana outbound/inbound and Robinhood
outbound/inbound. Current unapplied planning profiles are 500,000 SAN for the
canary, 30,000,000 SAN for early public operation, and 50,000,000 SAN for normal
operation per direction and refill period. These are risk proposals, not live
settings or launch authorization.

## Testnet evidence

The separate testnet deployment completed one forward and one return transfer:

```text
Solana Devnet tSAN lock
    → Robinhood Testnet tSAN mint
    → Robinhood Testnet tSAN burn
    → Solana Devnet tSAN unlock
```

The handoff records both source transactions, LayerZero GUIDs, destination
transactions, exactly-once delivery evidence, and the separation between tSAN
and canonical SAN. Testnet deployment identities and configuration are not a
production template.

See [Auditor handoff](./docs/AUDITOR_HANDOFF.md) and
[testnet-to-production review](./docs/TESTNET_TO_PRODUCTION_REVIEW.md).

## Repository map

| Area                                       | Location                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture and canonical custody model   | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                                                                                                                                                                         |
| Solana OFT Adapter program                 | [`programs/oft/`](./programs/oft/)                                                                                                                                                                                       |
| Robinhood `SanOFT` contract                | [`contracts/SanOFT.sol`](./contracts/SanOFT.sol)                                                                                                                                                                         |
| Production identity/configuration policies | [`scripts/`](./scripts/) and [`config/mainnet.ts`](./config/mainnet.ts)                                                                                                                                                  |
| EVM and Solana runtime tests               | [`test/`](./test/)                                                                                                                                                                                                       |
| Escrow invariant review                    | [`docs/ESCROW_SECURITY_REVIEW.md`](./docs/ESCROW_SECURITY_REVIEW.md)                                                                                                                                                     |
| LayerZero security proposal                | [`docs/SECURITY_CONFIG.md`](./docs/SECURITY_CONFIG.md)                                                                                                                                                                   |
| Rate-limit analysis                        | [`docs/PRODUCTION_RATE_LIMITS.md`](./docs/PRODUCTION_RATE_LIMITS.md)                                                                                                                                                     |
| Governance and handoff                     | [`docs/PRODUCTION_GOVERNANCE.md`](./docs/PRODUCTION_GOVERNANCE.md), [`docs/AUTHORITY_HANDOFF.md`](./docs/AUTHORITY_HANDOFF.md)                                                                                           |
| Future inert runbooks                      | [`docs/MAINNET_DEPLOYMENT_RUNBOOK.md`](./docs/MAINNET_DEPLOYMENT_RUNBOOK.md), [`docs/MAINNET_WIRING_RUNBOOK.md`](./docs/MAINNET_WIRING_RUNBOOK.md), [`docs/MAINNET_CANARY_RUNBOOK.md`](./docs/MAINNET_CANARY_RUNBOOK.md) |
| Build and artifact evidence                | [`docs/PRODUCTION_VERIFIABLE_BUILD.md`](./docs/PRODUCTION_VERIFIABLE_BUILD.md), [`docs/PRODUCTION_EVM_ARTIFACT.md`](./docs/PRODUCTION_EVM_ARTIFACT.md)                                                                   |

Historical phase reports are retained as supporting evidence but are not the
primary public navigation surface.

## Local validation

Required toolchain: Node 22, pnpm, Rust/Cargo 1.84.1, Anchor 0.31.1,
Agave/Solana 2.2.20, and Foundry.

```bash
pnpm install --frozen-lockfile
pnpm compile
pnpm test
pnpm test:anchor
pnpm test:scripts
pnpm lint
pnpm exec tsc --noEmit
forge test
pnpm san:check-program-id
```

These commands build and test locally. They do not authorize deployment,
wiring, token movement, or any other blockchain transaction. Transaction-
capable mainnet task paths are structurally disabled in this revision.

The production-code audit candidate is commit
`f5e0c819f85db394e719f3948c1c101b94a3c37c`. Any production-code change after
that commit requires independent change review.

## Current blockers

Before Phase 5B, the project still requires at least:

- a reproducible, digest-pinned Docker/verifiable Solana build;
- independent review of the exact production commit and artifacts;
- an approved Robinhood finality/confirmation policy;
- fresh LayerZero metadata and DVN/Executor review;
- final Squads/Safe identities, signer separation, and recovery policy;
- fresh market/liquidity review of rate limits;
- a monitored responsible-disclosure contact; and
- a separate explicit authorization for every production transaction.

See [Phase 5A.1 blockers](./docs/PHASE_5A1_BLOCKERS.md). No repository content
should be interpreted as permission to proceed to mainnet.
