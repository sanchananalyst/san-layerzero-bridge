# Auditor Handoff

## Audit target and status

The immutable production-code audit target is
`d28762288bb5180ff292f57eef7132191f2037ec`, the squash merge of
[security PR #2](https://github.com/sanchananalyst/san-layerzero-bridge/pull/2).
The PR candidate was `28e0ec712a9a4e5219b9c0245270b21787279820`
against exact base `515d008a0702bb3c4748ca87e0c689e689d4458b`.
The prior audit target, `a53a86bcc0a18934a19f2889ba61ceb1633fa359`,
is superseded because it did not contain the fail-closed activation boundary.

Phase 5A.4 is pre-mainnet. **PRODUCTION BRIDGE CODE FROZEN.** No production program, contract, Store, escrow, peer,
security configuration, multisig, or liquidity exists. Later documentation-only
commits do not change the code target. This package does not authorize Phase 5B.

Both applications now initialize bridge-paused. They must remain paused through
wiring, complete security configuration, governance handoff, and independent
read-back. Unpausing Solana last is the public activation boundary; after it,
bridging is permissionless and the operator has no exclusive first-transfer
lane.

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
sends. Solana-source confirmations are 32. Robinhood-source confirmations are
30 L2 blocks: source-depth/reorg mitigation only, not Ethereum finality, Nitro
challenge completion, or proof of finalized L1 posting. See the 1,024-block and
ten-batch evidence in `ROBINHOOD_FINALITY_EVIDENCE.md`.

Four limiters are mandatory: Solana outbound/inbound and Robinhood
outbound/inbound. Profiles are 500,000 SAN canary, 30,000,000 SAN early public,
50,000,000 SAN normal, and 100,000,000 SAN mature, each per direction/24 hours
with documented Solana integer rounding, cross-refill, and full-bucket
`set_capacity` reset semantics. Missing controls fail closed. See
`FINAL_RATE_LIMIT_ANALYSIS.md` and `PRODUCTION_RATE_LIMIT_POLICY.md`.

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

- **Phase 5A.3 reproducible Solana build: PASS.** Two independent clean
  checkouts at exact bridge target
  `d28762288bb5180ff292f57eef7132191f2037ec`, using only
  `solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326`,
  produced byte-identical 571,864-byte ELFs. Raw SHA-256:
  `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543`;
  Solana executable hash:
  `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6`.
  The production program ID occurred exactly once in each ELF; testnet and
  starter IDs occurred zero times. See `REPRODUCIBLE_BUILD_EVIDENCE.md`.
- **Superseded Phase 5A.1 evidence; do not approve for deployment after the
  initialize-paused patch.** Solana local ELF SHA-256:
  `1bb1093d63402e680d5d52fb3cb7cff44a0ada7b9e5835e35d44eca07b79a395`;
  executable hash:
  `955f6b81689a285cd7fe9875d7575347d9766149698b306f3b74e00e0f4bdf45`;
  571,888 bytes. This historical host artifact is not reproducible/verifiable
  evidence and is superseded for deployment purposes.
- **Superseded Phase 5A.1 evidence; the constructor bytecode changed in Phase
  5A.2.** EVM creation SHA-256:
  `6769923ed725590f7a28f05f3e75d5c7bf47aa62c7feef99eff47812f6a5c06d`;
  runtime SHA-256:
  `97997ac5162118757e4f311db039d4df9999030a1ff02031ea859a9915ffa690`;
  ABI SHA-256:
  `ee20f8f68924c41c3a269b69c29ab8214c0e7cbb7cdd29789c2f47ea718e9da3`.

## Phase 5A.3 evidence hardening

The immutable bridge code target remains `d2876228…`. The separate Phase 5A.3
tooling diff adds a one-response finalized Solana account snapshot and a
dual-RPC, range-complete in-flight scanner with schema-v2 provenance. The
manifest's end anchors must match the checker's Solana context slot/blockhash
and Robinhood finalized block/hash. See `IN_FLIGHT_EVIDENCE_MODEL.md`.

Docker reproducibility now passes. Two clean checkouts of `d2876228…` built
byte-identical artifacts with raw SHA-256 `b6c6a071…ce543`, executable hash
`5068a15a…d33d6`, and size 571,864 bytes. The dependency ledger contains 99
current GitHub alerts; no dependency was changed and none was found to reach a
new deployed bridge vulnerability. Phase 5A.4 freezes the 30-block Robinhood
source-depth policy with its explicit non-finality limitations.

## Findings, accepted risks, and decisions

Initial HIGH tooling findings—private-key export, registered mutation paths, and
generic mainnet wiring—were remediated at the Phase 5A.1 audit commit. The
subsequent fail-open initialization finding was remediated by PR #2. The exact
PR range received a hostile 36-file Codex Security diff review and sealed with
zero CRITICAL, zero HIGH, and two MEDIUM evidence findings. This is independent
Codex review work, not organizational independence or a substitute for a named
external audit firm.

The two MEDIUM evidence findings have local Phase 5A.3 remediations. Hostile
review of that tooling diff found one HIGH checker regression: the common-context
collector initially validated independently selected canonical mint/escrow
accounts without binding them to the decoded Store fields. The current patch
fails closed on Store mint, Store escrow, and Store-PDA derivation; four focused
tests and a fresh read-only bypass review passed. No unresolved CRITICAL, HIGH,
or MEDIUM tooling finding remains. A live manifest cannot be approved until the
production applications exist, and the checksum is not a reviewer signature.
Provider organizational independence also remains a human check.

The Phase 5A.4 hostile review additionally required the checker to bind Solana
mainnet genesis and authenticate Endpoint/ULN ProgramData addresses, executable
hashes, loader ownership, and upgrade authorities; it also required in-flight
packet destination EID/OApp verification. Focused regressions pass. The Store
admin remains an explicitly documented unpause-capable super-admin in frozen
program code; the dedicated unpauser does not constrain it.

Accepted design risks: multisig governance can maliciously upgrade/reconfigure;
Solana buckets measure net imbalance through cross-refill rather than strict
gross daily volume; EVM owner concentration permits pause griefing/unpause;
Executor/DVN/sequencer availability and correctness remain external assumptions;
and surplus-only Solana fee withdrawal remains callable while paused.

Unresolved human decisions/blockers: independent approval of the reproducible
hashes, independent external audit, independent acceptance of the 30-block
Robinhood source-depth assumptions, live scanner/provider approval, current
LayerZero trust-root ProgramData hashes/authorities and DVN contracts, all production application and multisig
addresses, signer/threshold/separation/recovery policy, pause-only guardian
decision, fresh economic limits, monitored disclosure contact, and explicit
Phase 5B authorization. See `AUDIT_TARGET.md`, `PHASE_5A1_BLOCKERS.md`, and
`AUDIT_SCOPE.md`.

## Runbooks

Use `MAINNET_DEPLOYMENT_RUNBOOK.md`, `MAINNET_WIRING_RUNBOOK.md`,
`MAINNET_CANARY_RUNBOOK.md`, `AUTHORITY_HANDOFF.md`, and
`PRE_DEPLOYMENT_CHECKLIST.md` only as future inert plans. None was executed.
