# Reviewer Quickstart

## Start here

Review production code commit
`d28762288bb5180ff292f57eef7132191f2037ec`, the squash merge of
[security PR #2](https://github.com/sanchananalyst/san-layerzero-bridge/pull/2).
It supersedes `a53a86bcc0a18934a19f2889ba61ceb1633fa359`.

The canonical bridge is not deployed or live. Use `AUDIT_TARGET.md`,
`AUDIT_SCOPE.md`, `PARTIAL_CONFIGURATION_SECURITY.md`, and
`PRODUCTION_ACTIVATION_CHECKER.md` to orient the review. Run the local validation
commands in the README; do not submit a blockchain transaction.

## Required review questions

1. Does every partial deployment/wiring state remain unable to send?
2. Does both-chain initialize-paused behavior provide the intended invariant?
3. Can an interrupted ceremony leave a permissionless send path?
4. Can default LayerZero configuration bypass the pause boundary?
5. Are all four limiters configured before activation?
6. Are governance handoffs complete before activation?
7. Is public activation correctly understood as permissionless once unpaused?

Phase 5A.3 implements the two former MEDIUM evidence remediations on branch
`security/phase5a3-evidence-hardening`: a one-response Solana finalized context
and a schema-v2 dual-RPC in-flight scanner. Review the tooling diff separately
from the unchanged bridge code target. In particular, verify that the decoded
Store mint and escrow equal canonical SAN and the approved escrow, and that the
Store is the production PDA derived from that escrow. Start with
`IN_FLIGHT_EVIDENCE_MODEL.md`, `PRODUCTION_ACTIVATION_CHECKER.md`,
`DEPENDENCY_ALERT_TRIAGE.md`, and `PRODUCTION_VERIFIABLE_BUILD.md`. Docker
reproducibility now passes for exact target `d287622…`: both clean builds have
raw ELF SHA-256 `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543`,
executable hash
`5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6`,
and size 571,864 bytes. Production ID embedding is exactly one; testnet and
starter IDs are zero. See `REPRODUCIBLE_BUILD_EVIDENCE.md`. The prior host
artifact remains documented but is superseded for deployment purposes.
Phase 5A.4 freezes Robinhood-source depth at 30 blocks and Solana-source depth
at 32. Thirty Robinhood blocks are not Ethereum finality, challenge-period
completion, or proof of finalized L1 posting. Review
`ROBINHOOD_FINALITY_EVIDENCE.md`, `ROBINHOOD_FINALITY_POLICY.md`,
`FINAL_RATE_LIMIT_ANALYSIS.md`, `PRODUCTION_RATE_LIMIT_POLICY.md`, and
`PRODUCTION_CONFIGURATION.md`. Confirm the four rate tiers, Solana full-bucket
capacity-reset warning, and the trust-root/genesis/packet-destination checker
hardening. The testnet round trip remains operational evidence only.
Report a potentially exploitable vulnerability through `SECURITY.md`, not a
public issue. No audit completion, Phase 5B authorization, or bounty is implied.
