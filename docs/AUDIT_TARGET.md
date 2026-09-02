# Production Audit Target

## Current immutable target

The production-code audit target is:

```text
d28762288bb5180ff292f57eef7132191f2037ec
```

This is the squash merge of public
[security PR #2](https://github.com/sanchananalyst/san-layerzero-bridge/pull/2),
whose reviewed candidate commit was
`28e0ec712a9a4e5219b9c0245270b21787279820` and whose exact base was
`515d008a0702bb3c4748ca87e0c689e689d4458b`.

The previous audit target,
`a53a86bcc0a18934a19f2889ba61ceb1633fa359`, is superseded. It initialized a
fresh Solana OFT Store unpaused and did not contain the complete fail-closed
activation patch, RPC-backed production checker, or partial-configuration
regression matrix.

## Security delta

- Solana `OFTStore.paused` now initializes `true`.
- Robinhood `SanOFT` calls `_pause()` in its constructor.
- Quote, send/debit, receive/credit, escrow movement, and packet dispatch remain
  unavailable throughout partial wiring until an explicit authorized unpause.
- The checker requires exact identities, bytecode, authorities, pause roles,
  all four rate limits, LayerZero configuration, escrow ownership/mint, and
  supply/TVL/in-flight accounting.
- Regression tests cover each partial configuration state, interrupted
  activation, rollback, and the public race after unpause.

The guarantee ends at the activation boundary. After public unpause, any SAN
holder may bridge within the configured limits and may race the operator canary.

## Remaining medium evidence blockers

1. Solana state is collected through repeated finalized reads, but the checker
   cannot prove that every Store, peer, SPL, loader, registry, and LayerZero
   value belonged to one exact historical slot.
2. The in-flight inventory hash authenticates supplied bytes and totals, but
   the repository does not yet contain an independently reviewed scanner and
   signed chain-range/packet-status proof establishing provenance and
   completeness.

Phase 5A.3 implements local remediations for both evidence gaps. Live evidence
and independent review still block Phase 5B. Docker reproducibility now passes;
independent hash approval, Robinhood finality, current LayerZero metadata, and
final Squads/Safe evidence remain open.

## Commit interpretation

A later commit with message `Update audit target after fail-closed activation
fix` changes documentation only. Auditors and the reproducible-build process
must build and review the production code at `d287622…`; they should also read
the latest documentation commit for scope and blocker status. Any code,
dependency, compiler, build-setting, or production-policy change after
`d287622…` requires a new target.
