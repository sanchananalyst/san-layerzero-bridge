# Production Governance

## Recommendation

Use separate **3-of-5** production multisigs by default:

- a Solana Squads vault controls OFT program upgrade authority, OFT Store admin,
  Endpoint/OApp delegate, and rate-limit administration; and
- a Robinhood Safe controls `SanOFT` owner, Endpoint delegate, pause/unpause,
  rate limits, peer, and LayerZero configuration.

The five signers must avoid shared failure domains, be geographically and
device-separated, use hardware-backed keys, and have documented recovery and
offboarding. No signer identity or multisig address is supplied or invented in
Phase 5A.1. For stronger separation, the Solana upgrade authority may use a
distinct 4-of-7 body, but only if drills meet the required response latency.

The exact high-risk transfer ceremony is defined in
`docs/GOVERNANCE_HANDOFF_RUNBOOK.md`; compromise consequences and required
alerts are defined in `docs/PRODUCTION_GOVERNANCE_THREAT_MODEL.md` and
`docs/GOVERNANCE_MONITORING_SPEC.md`.

## Threshold comparison

| Threshold  | Key loss tolerated | One compromised | Two compromised | Collusion threshold | Response latency              |
| ---------- | -----------------: | --------------- | --------------- | ------------------: | ----------------------------- |
| 2-of-3     |                  1 | safe            | control lost    |                   2 | fastest                       |
| **3-of-5** |              **2** | **safe**        | **safe**        |               **3** | moderate; recommended balance |
| 4-of-7     |                  3 | safe            | safe            |                   4 | slowest/most coordination     |

No threshold prevents malicious governance once its threshold colludes. Shared
cloud accounts, seed backups, devices, offices, employers, or approval channels
can make nominal signer count misleading. Proposal creation, decoded simulation,
approval, execution, and state read-back should be separated where practical.

## Role design

### Solana Squads

| Role                          | Required control                                                   |
| ----------------------------- | ------------------------------------------------------------------ |
| OFT program upgrade authority | 3-of-5 minimum; preferably separate 4-of-7 for infrequent upgrades |
| OFT Store admin               | 3-of-5; peer, Store, fees, limits, roles                           |
| Endpoint/OApp delegate        | 3-of-5; libraries, ULN, DVNs, Executor                             |
| Rate-limit administration     | 3-of-5; exact four-direction policy/read-back                      |
| Pauser                        | optionally a reviewed 2-of-3 pause-only Squads role                |
| Unpauser                      | 3-of-5 after incident review and complete read-back                |

The Store admin is a super-admin: frozen program code permits it to set
`paused` directly and to replace pauser/unpauser assignments. The dedicated
unpauser does **not** constrain a compromised Store admin. Reviewers must not
claim stronger role separation. True admin-versus-unpauser separation would
require a new production-program change, audit target, and external review.

Store admin and Endpoint delegate may share the operations Squads only after
explicit acceptance of correlated compromise risk. Upgrade authority should not
be the routine operator.

### Robinhood Safe

`SanOFT` is non-upgradeable. Deploy with the Safe directly as constructor
delegate/owner where practical. Use 3-of-5 for ownership, Endpoint delegate,
peer/DVN/configuration, pause/unpause, and rate-limit changes. Begin with no Safe
module, guard, or fallback handler unless independently reviewed.

The current contract can express only owner-controlled pause **and** unpause. It
cannot grant a pause-only guardian with no unpause/configuration power. A
pause-only 2-of-3 guardian could improve emergency latency while limiting its
power, but requires a separately approved contract change and audit. This phase
does not make that change; do not lower the owner threshold as a shortcut.

## Required ceremony and unresolved decisions

Before Phase 5B, humans must approve signer organizations, actual Squads/Safe
addresses, thresholds, independence evidence, recovery/offboarding, proposal
delays, emergency/unpause SLAs, Safe module policy, monitoring, independent
reviewers, and whether roles share a multisig. Run key-loss,
compromised-signer, malicious-proposal, pause, rejected-unpause, and replacement
drills off production. Every future action must record decoded calls,
simulations, signers, before/after state, and an independent read-back.

The current single-step ownership/admin transfers create a tracked MEDIUM
lockout risk. Phase 5A.5 does not add `Ownable2Step` or new roles; the current
mitigation is paused handoff, independent address derivation, two-person review,
immediate read-back, and no activation until checker PASS. A future audited
revision should evaluate nominate-and-accept semantics.
