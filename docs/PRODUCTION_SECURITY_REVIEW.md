# Production Security Review

## Outcome

A hostile Phase 5A.1 review of production contract/program code, configuration
policy, task registration, deployment helpers, key handling, and custody
invariants found no unresolved CRITICAL or HIGH code/tooling issue after the
remediations below. This is not an independent audit and does not approve Phase
5B or any transaction.

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

## Remaining risks and blockers

- **HIGH operational blocker:** exact production Store/escrow/SanOFT/multisig
  identities do not yet exist; current LayerZero metadata must be refreshed and
  independently approved before wiring.
- **HIGH release blocker:** Docker/verifiable, digest-pinned, reproducible Solana
  build is not complete.
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
tracked in `docs/PHASE_5A1_BLOCKERS.md`.
