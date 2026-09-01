# SAN LayerZero Bridge Safety Rules

These rules apply to every task in this repository. The bridge protects an existing canonical asset, so preserving backing and administrative control is more important than speed.

## Phase boundary

- The current scope is Phase 3.6 pre-deployment validation only: EVM bridge emergency controls, local builds/runtime tests, read-only RPC inspection, testnet planning, source audit, official metadata resolution, documentation, and program-identity checks.
- Do not deploy contracts or Solana programs.
- Do not run LayerZero wiring, ownership-transfer, peer-setting, send, retry, clear, skip, nilify, burn, or other transaction-producing tasks against any live network.
- Do not make mainnet or testnet transactions. Read-only RPC calls and local Hardhat/Foundry/Anchor test validators, Docker builds, and mocks are allowed.
- Do not create the OFT Store, escrow, adapter, peer accounts, or any other on-chain account in Phase 3.
- Stop before Phase 4. A human must explicitly authorize a later phase.

## Keys and authorities

- Never request, display, copy, import, or use production private keys, seed phrases, mnemonics, or production operator keypair files.
- Local tests/builds may generate ignored keypairs under `target/deploy/`. Never display their contents, use them for a live transaction, or move them outside the ignored build directory.
- Never commit secrets. `.env` must remain ignored and `.env.example` must contain placeholders only.
- The starter `junk-id.json` has been removed. Do not restore it or configure production commands to use any sample/test wallet.
- Do not create another SAN mint on Solana. A future Phase 4 may create a visibly distinct `tSAN` test token on Devnet only after separate human authorization; Phase 3.6 only prepares fail-closed, non-executing tooling.
- Do not change or propose changing the existing SAN mint authority as an implementation shortcut.
- Do not change the existing SAN freeze authority or transfer any canonical SAN.
- Production admin, delegate, pauser, upgrade-authority, and ownership roles require a documented multisig and human review before Phase 4.

## Bridge invariants

- Solana SAN is canonical. The Solana side must use the official LayerZero Solana OFT Adapter in lock/unlock (`Adapter`) mode.
- Robinhood `SanOFT` supply must only represent SAN locked in the Solana adapter escrow, subject to explicitly analyzed in-flight messages.
- Robinhood outbound transfers burn `SanOFT`; authenticated Solana receives release SAN from escrow.
- `SanOFT` must inherit LayerZero's standard OFT implementation without custom message authentication or arbitrary mint entry points.
- Never add `mint`, `ownerMint`, `adminMint`, emergency minting, role-based minting, or an alternate credit path to the production EVM contract.
- Do not disable endpoint checks, peer checks, ownership checks, slippage checks, rate limits, pause checks, or replay protection to make tests pass.

## Configuration discipline

- Treat these as unresolved until obtained from current official LayerZero metadata/packages and independently reviewed: Endpoint addresses, send/receive libraries, DVNs, Executors, confirmations, enforced options, gas/compute limits, and pathway defaults.
- The only canonical SAN mint is `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`. Reject every other mint.
- Known identifiers are Solana mainnet EID `30168`, Robinhood Chain ID `4663`, and Robinhood LayerZero EID `30416`. Verify them from current official metadata during Phase 3.
- Do not guess or copy production security configuration from a different chain or testnet.
- Do not configure a LayerZero connection until the existing SAN mint, token program, mint decimals, Solana OFT program/store/escrow addresses, and deployed Robinhood `SanOFT` address are verified.
- Any production peer must be set bidirectionally and checked byte-for-byte before messaging is enabled.

## Required validation

- Keep the production `SanOFT` contract minimal; test-only mint helpers must remain explicitly isolated under `contracts/mocks/` or `test/`, must not be referenced by deployment scripts, and must never be inherited by a production deployment artifact.
- Tests must cover ownership, unauthorized configuration, absence of arbitrary minting, authenticated endpoint/peer receive behavior, and OFT burn-on-send behavior.
- Compile and run all available local tests. Report missing toolchains and failures; never hide them by removing tests or security assertions.
- Before Phase 4, require human review of decimals and shared-decimal conversion, token extensions/transfer fees, supply/escrow accounting, LayerZero security stack, governance, pause/rate-limit policy, upgradeability, deployment bytecode, and operational runbooks.
