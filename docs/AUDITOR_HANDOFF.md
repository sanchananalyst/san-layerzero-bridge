# Auditor Handoff

## Audit target and status

Phase 5A.2 base commit:
`515d008a0702bb3c4748ca87e0c689e689d4458b`. The fail-closed activation
patch is currently an uncommitted review candidate; no deployment audit may
target the earlier Phase 5A.1 hash or the mutable working tree. A new immutable
commit is required after this review.
Phase 5A.1 is pre-mainnet. No production program, contract, Store, escrow, peer,
security configuration, multisig, or liquidity exists. This package does not
authorize Phase 5B.

## Architecture and identities

- Canonical asset: legacy SPL SAN mint
  `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`, 6 decimals, revoked
  mint/freeze authorities.
- Solana mainnet EID: `30168`; production OFT program:
  `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`.
- Robinhood mainnet chain ID/EID: `4663` / `30416`.
- Solana uses the official LayerZero OFT **Adapter**: outbound SAN locks in
  escrow; authenticated inbound messages release SAN.
- Robinhood uses non-upgradeable `SanOFT`: outbound burns; authenticated inbound
  credit mints. No arbitrary mint ABI exists.

Supply invariant, allowing explicitly reconciled in-flight packets:

```text
Robinhood total supply <= Solana OFTStore.tvl_ld <= canonical SAN escrow balance
```

The escrow proof depends on exact bytecode, canonical accounts, authenticated
Endpoint/peer clear, checked arithmetic/atomicity, and uncompromised governance.

## LayerZero and operating controls

The proposal explicitly pins ULN302 send/receive libraries and Executors on both
chains, uses no required DVN plus optional LayerZero Labs/Nethermind/Horizen at
threshold 2, rejects Dead DVN/default inheritance, derives peers byte-for-byte,
and enforces 200,000 destination gas/CU with zero native value for standard
sends. Solana-source confirmations are 32. Robinhood-source confirmations remain
fail-closed; 128 is only a provisional soft-depth candidate.

Four limiters are mandatory: Solana outbound/inbound and Robinhood
outbound/inbound. Profiles are 500,000 SAN canary, 30,000,000 SAN early public,
and 50,000,000 SAN normal, each per direction/24 hours with documented Solana
integer rounding and cross-refill semantics. Missing controls fail closed.

Solana has separate pauser/unpauser capability. EVM bridge pause blocks
quote/debit/credit while ordinary ERC-20 transfers remain live; the owner also
controls both buckets and unpause. A pause-only EVM guardian is not expressible
without a contract change.

## Authority and upgrade model

Recommended baseline is separate 3-of-5 Squads/Safe governance, with an optional
separate 4-of-7 Solana upgrade body. Solana upgrade authority, Store admin,
Endpoint delegate, and rate administration are custody-sensitive. Robinhood is
non-upgradeable; Safe ownership/delegation controls peer/security/pause/limits.
No deployer role may remain. Exact handoff order and read-backs are in
`AUTHORITY_HANDOFF.md`.

## Testnet evidence retained on rewritten branch `testnet/phase4a`

The testnet round trip is evidence of operational flow, not production security:

- forward source Solana signature
  `22fjZ8pHDhVGuxLKJapqFUb2Vn7AJKiA5beG2Z6CP1CNq6gFQVde648XJAurRoMVMRcBryRhmZD2XBGWMyv13Ek3`;
  GUID `0xaab721343e1d37c4915b57183632992d567331426a0edeecb45662be2d58c1d3`;
  Robinhood destination transaction
  `0x52e724b442eda0c76b5f4b09fc82cba11476c0a090a256c0bda2125576201a6b`.
- return source Robinhood transaction
  `0xe693d11f8bddc7b801a19c9e4519101880f9366a5f3f887cc49c75e62db9ea92`;
  GUID `0xd92af4ad988dc4c24cdcad37c84b6d9a2c6238aa9dc629fd96523e3e30a3c90e`;
  Solana destination signature
  `25aXfZzJLR9QBBLwMw8rUkBtA6qWjQpCHePFti51Lf1HYJoAsgtPFTXy48urDUT4ueMxNkmDPMYXjy8ZM56rCASv`.

The branch record reports two distinct GUIDs and exactly-once delivery. All
tSAN/testnet identities are prohibited in production.

## Build evidence

- **Superseded Phase 5A.1 evidence; do not approve for deployment after the
  initialize-paused patch.** Solana local ELF SHA-256:
  `1bb1093d63402e680d5d52fb3cb7cff44a0ada7b9e5835e35d44eca07b79a395`;
  executable hash:
  `955f6b81689a285cd7fe9875d7575347d9766149698b306f3b74e00e0f4bdf45`;
  571,888 bytes. This is **not yet reproducible/verifiable** because Docker is
  unavailable.
- **Superseded Phase 5A.1 evidence; the constructor bytecode changed in Phase
  5A.2.** EVM creation SHA-256:
  `6769923ed725590f7a28f05f3e75d5c7bf47aa62c7feef99eff47812f6a5c06d`;
  runtime SHA-256:
  `97997ac5162118757e4f311db039d4df9999030a1ff02031ea859a9915ffa690`;
  ABI SHA-256:
  `ee20f8f68924c41c3a269b69c29ab8214c0e7cbb7cdd29789c2f47ea718e9da3`.

## Findings, accepted risks, and decisions

Initial HIGH tooling findings—private-key export, registered mutation paths, and
generic mainnet wiring—were remediated at the Phase 5A.1 audit commit. The Codex Security
scan `26e024e8-031d-4d62-9b0d-e07a0f07437c` sealed with zero remaining
reportable findings; its workbench target began before the remediation commit,
so the exact Phase 5A.2 candidate still requires review of its eventual commit.

Accepted design risks: multisig governance can maliciously upgrade/reconfigure;
Solana buckets measure net imbalance through cross-refill rather than strict
gross daily volume; EVM owner concentration permits pause griefing/unpause;
Executor/DVN/sequencer availability and correctness remain external assumptions;
and surplus-only Solana fee withdrawal remains callable while paused.

Unresolved human decisions/blockers: Docker reproducibility, independent audit,
Robinhood finality, current LayerZero metadata/DVN contracts, all production
application and multisig addresses, signer/threshold/separation/recovery policy,
pause-only guardian decision, fresh economic limits, monitored disclosure
contact, and explicit Phase 5B authorization. See `PHASE_5A1_BLOCKERS.md` and
`AUDIT_SCOPE.md`.

## Runbooks

Use `MAINNET_DEPLOYMENT_RUNBOOK.md`, `MAINNET_WIRING_RUNBOOK.md`,
`MAINNET_CANARY_RUNBOOK.md`, `AUTHORITY_HANDOFF.md`, and
`PRE_DEPLOYMENT_CHECKLIST.md` only as future inert plans. None was executed.
