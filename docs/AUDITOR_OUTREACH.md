# Independent Auditor Outreach

We are requesting independent Solana, EVM, LayerZero, governance, and bridge-
accounting review of production code commit
`d28762288bb5180ff292f57eef7132191f2037ec`.

Public [security PR #2](https://github.com/sanchananalyst/san-layerzero-bridge/pull/2)
remediated a pre-mainnet partial-wiring issue: the Solana Store previously
initialized unpaused, so a holder could send after peer creation but before all
controls were installed. Both applications now initialize paused, stay inert
through wiring and handoff, and require a separate authorized activation.

Please explicitly answer:

1. Does every partial deployment/wiring state remain unable to send?
2. Does both-chain initialize-paused behavior provide the intended invariant?
3. Can an interrupted ceremony leave a permissionless send path?
4. Can default LayerZero configuration bypass the pause boundary?
5. Are all four limiters configured before activation?
6. Are governance handoffs complete before activation?
7. Is public activation correctly understood as permissionless once unpaused?

Also examine the two unresolved MEDIUM evidence items: coherent exact-slot
Solana observation and independently verifiable in-flight inventory provenance
and completeness. Reproduce the Solana and EVM artifacts before approving their
hashes, resolve Robinhood finality/DVN policy, and verify actual Squads/Safe
membership, thresholds, modules, guards, separation, recovery, and authorities.

The canonical mainnet bridge is not live. This request is not an audit-complete
claim, launch authorization, or bounty offer. Potentially exploitable findings
must use the private disclosure path in `SECURITY.md`.
