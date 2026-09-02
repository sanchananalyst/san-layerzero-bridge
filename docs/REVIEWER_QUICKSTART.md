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

The two current MEDIUM evidence blockers are common-slot Solana observation and
independently verifiable in-flight inventory provenance/completeness. Report a
potentially exploitable vulnerability through `SECURITY.md`, not a public issue.
No audit completion or bounty is implied.
