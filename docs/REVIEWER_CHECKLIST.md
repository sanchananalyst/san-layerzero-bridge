# Production Reviewer Checklist

Target: `d28762288bb5180ff292f57eef7132191f2037ec`.

- [ ] Confirm the checkout and dependency lockfiles match the target.
- [ ] Confirm canonical mint `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump` and Solana program ID `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`.
- [ ] Review PR #2 independently from base `515d008a0702bb3c4748ca87e0c689e689d4458b`.
- [ ] Run the complete local test, type, lint, ABI, program-ID, and secret gates.
- [ ] Confirm old EVM and Solana build hashes are superseded and not deployment evidence.
- [ ] Review the Phase 5A.3 tooling target separately and verify the common-context account set has no fallback RPC reads.
- [ ] Verify decoded Store `tokenMint`/`tokenEscrow` equal canonical SAN/the approved escrow and the Store is the production `OFT` PDA derived from that escrow.
- [ ] Verify schema-v2 scanner ranges, boundary hashes, pagination, dual-provider reconciliation, GUID uniqueness, destination evidence, API corroboration, and directional accounting.
- [ ] Independently approve the recorded reproducible hashes; keep Robinhood finality open and do not authorize Phase 5B.

Answer each question with source, test, and runbook evidence:

1. Does every partial deployment/wiring state remain unable to send?
2. Does both-chain initialize-paused behavior provide the intended invariant?
3. Can an interrupted ceremony leave a permissionless send path?
4. Can default LayerZero configuration bypass the pause boundary?
5. Are all four limiters configured before activation?
6. Are governance handoffs complete before activation?
7. Is public activation correctly understood as permissionless once unpaused?

- [ ] Record any assumption, proof gap, accepted risk, and required remediation.
- [ ] Use the private process in `SECURITY.md` for potentially exploitable findings.
- [ ] Do not represent this checklist as audit completion, launch approval, or a bounty.
