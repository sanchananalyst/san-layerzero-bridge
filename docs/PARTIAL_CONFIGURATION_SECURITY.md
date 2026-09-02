# Partial-Configuration Security

## Scope and activation invariant

Phase 5A.2 establishes one fail-closed boundary for both bridge applications:

> A newly deployed application is paused, stays paused throughout configuration and authority handoff, and becomes usable only through a separate, explicitly approved activation after a complete read-only production check.

This work is local and pre-mainnet. It does not authorize a deployment, wiring action, token movement, or any other blockchain transaction.

## Reproduced pre-patch condition

The pre-patch Solana runtime initialized `OFTStore.paused` to `false`. The existing local-validator lifecycle then configured only a peer and successfully called the public Adapter `send` path before installing either rate limiter. The call transferred 200,000 raw token units from the holder to escrow and increased `tvl_ld` by the same amount.

That execution used the actual Adapter instruction path against the repository's local Endpoint mock. It demonstrates that a valid peer plus absent outbound limiter was an active state: `None` skips limiter consumption rather than denying the send. No public-chain transaction was submitted.

The same ordering defect existed on Robinhood: `SanOFT` initialized its canary buckets but did not pause in its constructor. A later runbook pause would therefore leave a deployment-to-pause interval.

## Partial states

The regression model uses these lifecycle states:

| State  | Configuration reached                                                              | Required behavior before activation                           |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A      | Application initialized; no peer                                                   | quote, debit/send, credit/release, and packet creation denied |
| B      | Peer configured                                                                    | same denial                                                   |
| C      | Endpoint defaults or libraries available                                           | same denial                                                   |
| D      | Enforced options configured                                                        | same denial                                                   |
| E      | ULN, DVN, Executor, or confirmation configuration is partial                       | same denial                                                   |
| F      | Intended production configuration complete but not activated                       | same denial                                                   |
| Active | All configuration and authority checks pass; separately approved unpause completed | canary operation allowed within all four rate limits          |

The OFT application does not read remote library, DVN, Executor, or confirmation state before its pause guard. Tests therefore exercise the real OFT quote/send paths at every application-visible transition, while the production checker is responsible for fetching and validating the Endpoint/security-stack state represented by C and E. A paused application fails before Endpoint packet creation regardless of those external values.

## Selected patch and exact compatibility effect

The Solana source change is intentionally one semantic assignment in `init_oft`:

```diff
-        ctx.accounts.oft_store.paused = false;
+        ctx.accounts.oft_store.paused = true;
```

The Robinhood constructor adds `_pause()` after its token buckets are initialized. Neither change alters account layout, ABI/IDL parameters, token accounting, Endpoint authentication, peer authentication, or LayerZero OFT debit/credit logic.

The compatibility effects are explicit:

- `quote_oft`, `quote_send`, `send`, and `lz_receive` reject calls until activation.
- Peer, fee, role, delegate, library, DVN, Executor, enforced-option, and rate-limit configuration remains possible while paused.
- A failed inbound receive remains retryable because pause is checked before Endpoint clear.
- Existing already-initialized Solana Stores are not changed; the default applies to newly initialized Stores.
- Clients that assumed a fresh deployment was immediately live now receive a paused error.
- Solana activation must use the admin configuration path or a previously assigned unpauser. A fresh Store has no pauser or unpauser role.
- Robinhood activation remains owner-controlled and must be a separate transaction after ownership and configuration read-back.

## Why zero capacity is not the activation boundary

Solana rate-limit buckets permit a capacity of zero. A zero-capacity bucket prevents positive token consumption, even when its refill parameters are nonzero, because refills are capped at capacity. This can be useful as defense in depth before a peer is set.

It is not a complete bridge kill switch:

- a zero-amount send can still pass limiter consumption and may create a packet;
- quotes do not enforce bucket availability;
- the Robinhood rate-limit setter deliberately rejects zero capacity;
- inbound and outbound limiters are separate optional fields;
- cross-chain activation cannot be atomic in one transaction.

Zero capacity is therefore not used as the primary production boundary. The global paused state denies quotes, sends, credits/releases, and packet creation uniformly.

## Why peer-last is not the activation boundary

Solana can bundle peer and limiter instructions in one transaction at the low-level SDK layer, but the repository's current tasks submit separate transactions. Peer-last can reduce one pristine deployment interval, but it does not provide an on-chain definition of complete configuration, protect reconfiguration of an existing peer, cover Robinhood atomically, or prevent a direct caller from choosing another order. The high-level peer setter may also overwrite enforced options and fee defaults.

The runbooks may still configure peers late as defense in depth. Safety does not depend on that ordering: the applications remain paused across every partial state.

## Two-stage ceremony

Stage 1 — inert infrastructure:

1. Deploy applications in their default paused state.
2. Configure peers, Endpoint libraries, DVNs, Executors, confirmations, enforced options, and all four canary rate limits.
3. Complete Squads/Safe authority handoff.
4. Read every value back from independent RPCs.
5. Require the production checker to accept `PRE_ACTIVATION_INERT` and prove zero custody/supply/in-flight state.

Stage 2 — initial public activation:

1. Re-run the same production checker against fresh RPC observations.
2. Record human approval of the exact identities, bytecode, authorities, security stack, limits, and zero-state accounting.
3. Require Store TVL, escrow, Robinhood supply, both in-flight directions, and
   the hashed message inventory to be exactly zero.
4. Unpause Robinhood first. Solana remains paused, so no canonical SAN can enter
   the bridge; Robinhood's zero supply leaves no holder able to burn outbound.
5. Read back the mixed state. If anything interrupts the ceremony, re-pause
   Robinhood and stop.
6. Unpause Solana last. This transaction is the public activation boundary.
7. Re-run the checker in `CANARY_ACTIVE` mode twice. The bridge is now public
   under the approved loss-bounding rate limits; no exclusive one-message claim
   is made.

Interruption or RPC failure during Stage 1 leaves both applications inert. An
interruption after Robinhood-first unpause is fail-safe only for the initial
zero state and must trigger Robinhood re-pause. Solana-first is prohibited.
Reactivation after nonzero supply exists is outside this protocol and remains
blocked pending a separate review.

## Required regression evidence

The patch is not release-ready unless local tests prove all of the following:

- fresh Solana Store and Robinhood OFT are paused;
- states A through F reject quotes and positive public sends;
- failed calls do not change holder balance, escrow balance, Store TVL, token supply, or packet/event evidence;
- configuration calls still work while paused;
- zero-capacity behavior and zero-amount limitations are recorded;
- activation succeeds only after a complete expected-state check;
- wrong authorities, incomplete configuration, unexpected active state, bytecode mismatch, and in-flight/accounting mismatch fail closed;
- local RPC interruption and a one-sided/unpause-interruption state fail closed.

The final Phase 5A.2 review must include an independent hostile diff pass. Reproducible Docker build work belongs to the subsequent authorized phase and is not part of this patch.
