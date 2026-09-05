# Production Role-Separation Analysis

## Decision

Choose **A: defer new role code to a future audited version**. No concrete
Critical/High issue requires changing the frozen production logic before Phase
5B, and changing the role model now would change production bytecode and require
a new audit target, tests, artifact evidence, and independent review.

This is not acceptance of incomplete governance evidence. Exact multisig state,
signer independence, handoff controls, monitoring, and external review remain
mandatory Phase 5B blockers.

## Current combinations

### Robinhood

One `SanOFT` owner controls pause and unpause, inbound/outbound rate limits,
peer, delegate succession, enforced options, and inherited OApp/OFT
configuration. The intended baseline also makes that owner the Safe whose
address is the Endpoint delegate. Operational control and message-security
control therefore share one 3-of-5 threshold. `SanOFT` is non-upgradeable, and
there is no arbitrary owner mint function.

### Solana

The OFT Store admin is a super-admin. It can change Store admin, Endpoint
delegate, global pause state, pauser/unpauser, fees, peer, options, and both rate
limits. Although a separate `set_pause` path supports pauser and unpauser roles,
the Store admin can directly change the pause bit and replace those roles. The
pause roles do not constrain a compromised Store admin.

The proposed baseline uses the same operations Squads vault for Store admin and
Endpoint delegate. The OFT program upgrade authority is logically separate and
should use a distinct 4-of-7 body when operational drills show that its latency
is acceptable; otherwise sharing must be expressly risk-accepted.

## Damage and mitigation matrix

| Combined control                                    | Damage after controlling authority is compromised                                                                       | What multisig mitigates                                                              | What multisig does not mitigate                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Robinhood owner + pause/unpause + app config        | Unpause, remove throttles, change peer/delegate/options, censor sends, or create a path to unbacked standard OFT credit | Theft/loss of one or two keys when a true 3-of-5 threshold and independent keys hold | Threshold collusion, common device/cloud/recovery failure, malicious proposal substitution, or an unsafe Safe module/guard/fallback |
| Robinhood owner and Endpoint delegate in one Safe   | One threshold can change both peer/application settings and DVN/library/Executor verification                           | Requires a threshold rather than a single EOA                                        | No two-body approval between application and verification changes; pause is controlled by the same compromised body                 |
| Solana Store admin powers                           | Change roles, peer, pause, limits, delegate, fees, and create a path to escrow release                                  | Prevents a single operator key from acting                                           | Super-admin power remains intact after threshold compromise; pauser/unpauser separation can be overwritten                          |
| Solana Store admin + Endpoint delegate in one vault | One threshold can change both peer and message-security stack                                                           | Reduces individual-key compromise                                                    | Eliminates independent approval between the two most relevant configuration layers                                                  |
| Program upgrade authority with operations roles     | Replace code and then control configuration                                                                             | Threshold key custody                                                                | A malicious threshold can bypass every application control and drain escrow; monitoring and pause may be bypassed by new code       |

Multisig strength depends on real independence. Five keys on shared devices,
shared seed storage, one identity provider, one employer-controlled recovery
channel, or one physical site do not provide five independent failures.

## Pause-only guardian assessment

A dedicated pause-only guardian would materially improve response time if it
uses an independent, lower-latency threshold and has no ability to unpause or
reconfigure the bridge. It limits the guardian's abuse to denial of service and
provides a response path when the primary operations body is slow.

Solana already exposes a pauser role, so governance can assign a separate
pause-only vault without changing program code. That benefit is bounded: the
Store admin can replace the pauser and directly unpause, so it is not a security
boundary against Store-admin compromise. Unpause must remain with the stronger
operations body and require incident/read-back approval.

Robinhood cannot express a pause-only guardian in the frozen contract. Adding
one would require production Solidity changes, new bytecode, a changed audit
target, new role-administration and event tests, deployment-artifact
reproducibility, and external re-audit. Lowering the owner threshold to improve
pause latency would also lower every configuration threshold and is rejected.

## Required controls for the current version

- Use exact approved nonzero Safe/Squads addresses and thresholds, with complete
  owner/member/permission read-back and no bootstrap/deployer signer.
- Prefer a separate Solana upgrade multisig; document and approve any shared
  vault explicitly.
- Keep both applications paused during every authority handoff and require the
  checker's `PRE_ACTIVATION_INERT` state before and after it.
- Require proposal decoding by one person and independent address/calldata or
  instruction derivation by another.
- Monitor every role, peer, library, DVN, Executor, rate-limit, and pause change,
  with the counterparty chain able to pause on suspicious drift.
- Treat unpause as a separate high-risk ceremony, never an automatic follow-up
  to handoff or configuration.

## Deferred finding

**MEDIUM — Single-step production authority handoff can cause lockout if the
destination address is wrong.**

The present mitigation is a paused handoff, independent multisig-address
derivation, two-person verification, immediate post-transfer read-back, and no
activation until the fail-closed checker passes. A future audited bridge
revision should evaluate `Ownable2Step` or equivalent nominate-and-accept
semantics for every authority that can support it. No such code change is made
in Phase 5A.5.
