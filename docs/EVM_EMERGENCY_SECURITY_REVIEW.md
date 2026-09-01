# EVM Emergency Controls — Hostile Security Review

## Method and scope

This review was performed after the initial Phase 3.6 implementation and before remediating accepted high-severity findings. It treats the owner, external callers, Endpoint callers, peers, timestamps, replay attempts, and failing destination execution as adversarial. It covers only the new `SanOFT` pause and token-bucket code plus its interaction with installed LayerZero OFT/OApp code.

## Initial findings

### CRITICAL

None found.

### HIGH

**H-01 — Inherited ownership renunciation can make emergency state permanent.** The initial implementation inherited OpenZeppelin `renounceOwnership()`. If the owner paused and then renounced, inbound verified messages would remain unexecutable and outbound bridging would remain disabled forever. If renounced while active, all future peer, delegate, enforced-option, pause, and rate-limit administration would be lost. This is an avoidable permanent-failure mode for a production bridge.

Accepted remediation: override `renounceOwnership()` so every call reverts, retain two-step operational handoff as a deployment procedure (`transferOwnership` plus human verification), and add regression tests. This remediation is applied after this finding was recorded.

### MEDIUM

**M-01 — A compromised owner can weaken limits or grief users.** The owner can pause indefinitely and can configure a very fast refill (for example capacity per second). Configuration increases do not gift capacity instantly, but a permissive new rate can refill shortly afterward. This cannot mint directly or bypass Endpoint/peer authentication, yet it reduces the canary defense. Mitigate operationally with the SAN Safe multisig, signer separation, transaction simulation, review delays/policies, event monitoring, and conservative runbooks.

**M-02 — Timestamp-based refill inherits Robinhood sequencer/block-producer time trust.** Monotonic checks, full-precision arithmetic, and capacity caps prevent wraparound and over-cap refill, but an allowed forward timestamp skew can accelerate refill within chain consensus bounds. Monitor timestamps and pause on anomalous chain behavior.

### LOW

**L-01 — Buckets are global per direction, not per remote EID.** Any future additional peer shares the same directional capacity and could consume it, causing availability grief for Solana. The production architecture currently has one remote peer. Require a new security review before adding any EID.

**L-02 — Quotes are snapshots.** `quoteOFT`/`quoteSend` fail fast when paused or over limit, but another transaction can consume capacity before the quoted send lands. The send safely reverts; clients must treat quotes as non-reservations.

### INFORMATIONAL

- Ordinary ERC-20 transfers intentionally stay enabled while bridge pause is active. They cannot alter total supply or bridge capacity.
- Paused/rate-limited inbound execution reverts atomically before mint; Endpoint payload clearing rolls back and the verified packet remains retryable.
- Outbound burn and capacity consumption share one transaction with Endpoint send; any later revert rolls both back.
- Standard Endpoint and peer authentication remains unchanged. No emergency function calls `_mint`, `_credit`, or `lzReceive`.
- Refill uses `Math.mulDiv` and `mulmod`, validates nonzero duration and rate, bounds capacity to `uint64`, caps availability, and settles stale state before reconfiguration.
- Raising capacity preserves current availability; lowering it clamps availability. This prevents an immediate configuration-time capacity gift.

## Remediation status

H-01 is remediated by disabling ownership renunciation and is covered in both test frameworks. There are no unresolved CRITICAL or HIGH findings. Medium findings are governance/chain-trust risks that require deployment policy and monitoring rather than an authentication rewrite or admin role expansion.
