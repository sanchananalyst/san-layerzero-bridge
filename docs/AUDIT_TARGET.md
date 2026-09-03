# Production Audit Target

## Current immutable target

The production-code audit target is:

```text
d28762288bb5180ff292f57eef7132191f2037ec
```

**PRODUCTION BRIDGE CODE FROZEN.** Phase 5A.4 verified no change to
`contracts/SanOFT.sol` or `programs/oft` since this target. The reproducible raw
ELF SHA-256 remains
`b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` and
the executable hash remains
`5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6`.

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

## Evidence status

Phase 5A.3 implemented local common-context and range-complete scanner
remediations. Phase 5A.4 additionally binds Solana mainnet genesis, packet
destination OApps, and Endpoint/ULN ProgramData identities/hashes/authorities.
Live evidence and independent review still block Phase 5B. Docker
reproducibility passes; independent hash approval, acceptance of the 30-block
non-finality assumptions, freshly approved LayerZero trust-root identities, and
final Squads/Safe evidence remain open.

## Commit interpretation

A later commit with message `Update audit target after fail-closed activation
fix` changes documentation only. Auditors and the reproducible-build process
must build and review the production code at `d287622…`; they should also read
the latest documentation/tooling commit for scope and blocker status. Any
bridge code, dependency, compiler, or build-setting change after `d287622…`
requires a new bridge-code target; policy/checker changes require separate
change review.
