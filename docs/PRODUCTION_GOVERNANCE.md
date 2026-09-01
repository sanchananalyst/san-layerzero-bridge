# Production Governance

## Status and principles

This Phase 5A design contains no signer addresses and performs no authority
change. No personal wallet may remain a final production authority. Signers must
be organizationally independent, use hardware-backed keys, and have documented
recovery and conflict-of-interest procedures.

## Recommended authority model

### Solana

| Authority                     | Target                       | Recommended threshold | Scope                                                              |
| ----------------------------- | ---------------------------- | --------------------: | ------------------------------------------------------------------ |
| OFT program upgrade authority | SAN Governance Squads        |                4-of-7 | Program upgrades only; highest-risk authority                      |
| OFT Store admin               | SAN Bridge Operations Squads |                3-of-5 | Peer, fee, enforced options, rate limits, and store administration |
| Endpoint delegate             | SAN Bridge Operations Squads |                3-of-5 | LayerZero libraries, ULN, Executor, and delegate configuration     |
| Pauser                        | SAN Emergency Squads         |                2-of-3 | Pause only; geographically distributed on-call signers             |
| Unpauser                      | SAN Bridge Operations Squads |                3-of-5 | Re-enable only after incident review and full read-back            |

The upgrade authority must not be the routine operator. The Store admin and
Endpoint delegate may share the same 3-of-5 Squads only after humans explicitly
accept the correlated compromise risk. Every operation requires a human-readable
transaction preview, independent simulation, and post-transaction read-back.

### Robinhood Chain

| Authority         | Target                     | Recommended threshold | Scope                                                          |
| ----------------- | -------------------------- | --------------------: | -------------------------------------------------------------- |
| SanOFT owner      | SAN Bridge Governance Safe |                3-of-5 | Peer, ownership, pause/unpause, rate limits, and OApp settings |
| Endpoint delegate | SAN Bridge Governance Safe |                3-of-5 | LayerZero library/ULN/Executor configuration                   |

The production SanOFT is non-upgradeable. No proxy admin should exist. Launch
with no Safe modules, guards, or fallback handler unless each is separately
reviewed. A 3-of-5 owner makes emergency pause dependent on three signers. If the
approved response-time objective cannot be met, revise and independently audit
the contract before deployment to add a pause-only guardian while retaining
unpause and configuration under the owner Safe. Do not lower the owner threshold
as a shortcut.

## Ceremony and control requirements

- Publish the intended multisig account addresses and independently derive them
  from the approved signer/threshold configuration before use.
- Verify every signer on a second communication channel.
- Require hardware wallets and prohibit shared seed phrases.
- Run recovery, signer-loss, malicious-proposal, pause, and rejected-unpause
  drills on a non-production environment.
- Keep proposal creation separate from final approval where practical.
- Record decoded instructions/calls, simulation results, and before/after state.
- Treat delegate, owner, Store admin, and upgrade transfers as separate
  transactions with a stop/read-back gate after each one.
- Document replacement and offboarding before any signer receives authority.

## Human decisions and addresses still required

1. Legal/organizational owner of each Squads and Safe.
2. Actual signer identities and their independence.
3. Acceptance or revision of the proposed `4-of-7`, `3-of-5`, and `2-of-3`
   thresholds.
4. Final Squads account addresses and Safe address.
5. Whether Store admin and Endpoint delegate may share one Squads.
6. Whether SanOFT owner and Endpoint delegate may share one Safe.
7. Whether the EVM contract must add a pause-only guardian before deployment.
8. Safe module, guard, fallback-handler, and transaction-service policy.
9. Timelock/delay requirements for upgrades, ownership, peer, DVN, library,
   Executor, confirmation, enforced-option, and rate-limit changes.
10. Emergency response and unpause approval service-level objectives.
11. Signer key custody, backup, replacement, and incident procedures.
12. Independent reviewers for each deployment/configuration proposal.

Until these decisions and addresses are approved and verified, every production
authority transfer remains blocked.
