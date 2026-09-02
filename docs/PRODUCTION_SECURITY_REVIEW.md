# Production Security Review

## Outcome

A hostile Phase 5A.2 review of the exact public PR #2 range and merged
production-code target
`d28762288bb5180ff292f57eef7132191f2037ec` found no unresolved CRITICAL or
HIGH issue. All 36 changed files were reviewed. Two MEDIUM evidence findings
remain and block Phase 5B. This is independent Codex review work, not
organizational independence or a substitute for a named external audit firm. It
does not approve Phase 5B or any transaction.

The previous audit target,
`a53a86bcc0a18934a19f2889ba61ceb1633fa359`, is superseded because a fresh
Solana OFT Store initialized unpaused. After a peer was configured, an ordinary
holder could send during partial wiring before rate limits and the remaining
controls were complete. PR #2 changed Solana initialization to paused, changed
Robinhood construction to paused, added the production checker, and added the
partial-configuration regression matrix.

## Threat model and controls

The primary assets are canonical SAN escrow, the one-for-one remote supply
invariant, governance authorities, production identities, and signing material.
Attackers considered include arbitrary callers, forged peers/messages, replaying
executors, compromised owner/delegate/admin/upgrade authority, malicious or dead
DVNs, wrong-chain operators, and developers accidentally invoking starter tasks.

- Solana uses official Adapter lock/unlock mode. Mint, token program, Store,
  escrow, Endpoint clear, peer, nonce/GUID, rate limits, TVL, and surplus-only
  withdrawal constraints preserve `escrow balance >= tvl_ld` at successful
  boundaries.
- Robinhood has no arbitrary mint ABI. Send burns; credit is reachable only
  through inherited Endpoint/peer authentication. Bridge-only pause and two
  independent buckets contain flow while preserving ordinary ERC-20 transfers.
- Production policy checks exact chain/EIDs, byte-accurate Solana identities,
  checksummed EVM identities, libraries, Executor, any-2-of-3 live DVNs, no Dead
  DVN, peers, enforced options, decimals, supply/TVL, all authorities, and all
  four rate limits. Missing approved values fail closed.
- `PRE_ACTIVATION_INERT` requires both applications paused. Initial
  `CANARY_ACTIVE` requires both unpaused and zero Store TVL, escrow balance,
  Robinhood supply, in-flight amounts, and inventory entries. Mixed state fails.
- Transaction-capable mainnet task paths are unregistered and central Solana and
  Robinhood send guards block before key loading. The Phase 5A.1 execution gate
  always throws; enabling Phase 5B requires a separately reviewed source change.

## Findings and remediation

| Initial severity | Finding                                                                                       | Resolution in current source                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| HIGH             | registered base58 helper could print an entire private key                                    | task and file removed; key-printing task is absent                                                                           |
| HIGH             | generic send/create/authority/metadata/recovery tasks were registered and could reach mainnet | unsafe tasks unregistered; central chain guards block before signer access                                                   |
| HIGH             | generic wiring was not bound to exact SAN policy and allowed partial/retry execution          | mainnet execution structurally disabled; production preview/checker requires the complete exact matrix and zero transactions |
| MEDIUM           | send prompt refusal was caught and execution could continue                                   | read failure and explicit refusal are separated; refusal propagates                                                          |
| MEDIUM           | graph scan could return after the first Solana EID                                            | full graph is scanned and multiple/wrong EIDs fail                                                                           |
| MEDIUM           | rate task did not require the exact approved Store                                            | exact `PublicKey.equals` binding added; broadcast permanently blocked in this phase                                          |
| LOW              | wiring dry-run loaded a real operator key                                                     | dry-run uses an ephemeral signer/public multisig only                                                                        |
| MEDIUM/LOW       | case-folded Solana identities and unchecked EVM forms weakened comparisons                    | Solana addresses compare decoded 32-byte keys; EVM uses checksum normalization                                               |

Regression tests prove the old execution token cannot unlock mainnet, unsafe
tasks are absent, wrong testnet IDs/RPC contexts fail, supplied outbound
`dstEid` is honored, four limiters are mandatory, and intentionally bad policy
fixtures are rejected.

The activation guarantee is deliberately bounded. Both applications remain
inert through wiring and handoff, but once Solana is unpaused last, any holder
may bridge within the configured controls and may race the operator canary.

## Remaining risks and blockers

- **MEDIUM evidence hardening implemented:** Solana Store, peer, SPL, loader,
  registry, and LayerZero accounts are decoded from one finalized common-context
  response. Live evidence and independent review remain required.
- **MEDIUM evidence hardening implemented:** the in-flight scanner requires
  dual-provider, range-complete, source/destination packet evidence bound to a
  schema-v2 manifest. A live independently approved manifest remains required.

- **HIGH operational blocker:** exact production Store/escrow/SanOFT/multisig
  identities do not yet exist; current LayerZero metadata must be refreshed and
  independently approved before wiring.
- **HIGH approval blocker:** the Docker/verifiable, digest-pinned Solana
  reproducibility gate passes; the recorded hashes still require independent
  approval and later deployed-bytecode equivalence.
- **HIGH policy blocker:** Robinhood source finality/confirmation risk acceptance
  is unresolved.
- **HIGH process blocker:** an independent audit of the exact code commit,
  artifacts, governance, and configuration is outstanding.
- **MEDIUM accepted design risk:** governance can indirectly defeat custody via
  malicious upgrade, peer, or security-stack changes; multisig, separation,
  monitoring, pause, delays, and read-backs are mandatory.
- **MEDIUM accepted design risk:** EVM pause/unpause share the owner; a pause-only
  guardian requires a separately approved contract change.
- **LOW behavior:** Solana fee-surplus withdrawal remains callable while paused,
  but cannot withdraw accounted TVL under reviewed code.

No accepted risk is treated as launch authorization. Exact closure criteria are
tracked in `docs/PHASE_5A1_BLOCKERS.md`; commit identity is recorded in
`docs/AUDIT_TARGET.md`.
