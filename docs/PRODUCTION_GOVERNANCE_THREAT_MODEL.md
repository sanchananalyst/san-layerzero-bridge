# Production Governance Threat Model

## 1. Scope, system, and trust boundaries

This model covers governance compromise for the SAN LayerZero bridge at audit
target `d28762288bb5180ff292f57eef7132191f2037ec`. It is a Phase 5A.5 design and
operations artifact only. No production application exists yet, no authority
has been transferred, and this document authorizes no Phase 5B action.

The canonical asset is the six-decimal Solana SAN mint
`GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`. The Solana application is an
Adapter: outbound messages lock SAN in escrow and authenticated inbound
messages release it. Robinhood `SanOFT` burns on outbound send and mints only
through the standard authenticated LayerZero receive path. The intended backing
invariant is:

```text
Solana Store TVL
  = Robinhood SanOFT supply
  + Solana-to-Robinhood in-flight SAN
  + Robinhood-to-Solana in-flight SAN
```

The principal trust boundaries are:

- signer devices and recovery material to Safe/Squads approval thresholds;
- Safe/Squads proposals to their executed calls or Solana instructions;
- application owner/admin roles to LayerZero Endpoint delegate roles;
- LayerZero delegate configuration to DVN, library, Executor, and confirmation
  enforcement;
- the Solana upgrade authority to the executable code controlling escrow; and
- RPC/indexing observations to independent read-back and incident decisions.

Governance is the primary remaining trust threat. Multisig custody reduces
single-key compromise probability but does not constrain a malicious threshold,
a misleading decoded proposal, compromised recovery path, or correlated signer
failure.

## 2. Security properties and source-grounded capabilities

The following properties must hold:

1. No Robinhood supply is credited without a message authenticated under the
   exact approved peer and LayerZero security configuration.
2. No escrow SAN is released without a corresponding authenticated Robinhood
   burn, subject only to explicitly reconciled in-flight messages.
3. Both applications remain paused throughout authority handoff.
4. Every production authority is a nonzero, exact approved governance address;
   no deployer or personal wallet remains a direct role or multisig signer.
5. Governance changes are detected, independently read back, and compared with
   approved state before activation or reactivation.

These capabilities are grounded in the reviewed source:

- Robinhood owner controls pause/unpause and both rate-limit buckets
  (`contracts/SanOFT.sol:63-84`) and inherits peer, delegate, enforced-options,
  inspector, and pre-crime configuration described in
  `docs/EVM_ADMIN_PRIVILEGES.md`.
- `SanOFT` is deployed paused and its standard credit path is pause- and
  rate-limit-gated (`contracts/SanOFT.sol:44-55,126-132`). There is no arbitrary
  external mint function.
- Solana Store admin is enforced by `has_one = admin` and can replace admin or
  Endpoint delegate, change fees, directly change pause state, and replace
  pauser/unpauser (`programs/oft/src/instructions/set_oft_config.rs:4-59`).
- The same Store admin can replace the remote peer, options, and either
  directional rate limiter, including removing a limiter
  (`programs/oft/src/instructions/set_peer_config.rs:3-98`).
- The separate Solana pauser/unpauser path is role-bound, but it does not limit
  the Store admin's direct configuration power
  (`programs/oft/src/instructions/set_pause.rs:3-34`).
- Solana receive checks the peer, pause state, Endpoint clear, and inbound
  limiter before releasing Adapter escrow
  (`programs/oft/src/instructions/lz_receive.rs:14-125`).
- Fee withdrawal is limited to the escrow surplus above Store TVL in the
  reviewed program (`programs/oft/src/instructions/withdraw_fee.rs:4-59`).

## 3. Compromise scenarios and mitigations

“Unbacked” below means supply or an unlock that lacks the corresponding
canonical lock/burn, not a direct call to a nonexistent mint entry point.

| Compromised authority                                               | What can be changed                                                                                                                 | Maximum plausible impact                                                                                                                                        | Can cause unbacked mint/unlock?                                                                                                                                                                                                | Monitoring signal                                                                                                                                                      | Emergency response                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Robinhood `SanOFT` owner                                            | Pause/unpause, inbound/outbound rate limits, peer, Endpoint delegate, enforced options, message inspector, pre-crime, and ownership | Denial of service; removal of loss throttles; malicious peer/security configuration; transfer of all application control                                        | **Yes, indirectly.** It cannot directly call arbitrary mint, but can install a malicious peer and delegate/configuration so a forged authenticated receive reaches standard OFT credit                                         | `OwnershipTransferred`, `PeerSet`, `DelegateSet`, enforced-option/inspector/pre-crime events, `Paused`/`Unpaused`, `RateLimitConfigured`, plus exact state drift       | Uncompromised Solana governance pauses immediately; stop relayers/operations; revoke affected signer/session paths; preserve evidence; replace Safe owner set only through an uncompromised threshold; do not reactivate until full checker/read-back and incident approval pass                        |
| Robinhood LayerZero delegate                                        | Send/receive libraries, ULN/DVN thresholds and identities, Executor, confirmations, and related Endpoint configuration for the OApp | Message censorship or acceptance under a weakened verification stack; forged receive and arbitrary Robinhood credit within available limits                     | **Yes, indirectly.** A malicious verification configuration can authenticate a forged packet carrying the approved peer identity; the standard credit path can then mint                                                       | Endpoint library/config events; raw non-inherited ULN state drift; DVN/threshold/Executor/confirmation drift; unexpected packet verification                           | Pause Robinhood using uncompromised owner and Solana using uncompromised admin/pauser; halt message execution; restore configuration only through reviewed governance; reconcile every packet and backing unit before reactivation                                                                      |
| Solana OFT Store admin                                              | Admin succession, Endpoint delegate, global pause, pauser/unpauser, fees, peer, enforced options, and both rate limiters            | Full application configuration takeover; denial of service; removal of throttles; malicious peer/security settings; escrow release up to its balance            | **Yes, indirectly.** It can set a malicious peer, install an attacker delegate, weaken verification, unpause, and enable forged authenticated releases. Surplus withdrawal alone cannot consume accounted TVL in reviewed code | Store and peer-account diffs; decoded admin/delegate/peer/pause/role/fee/limit changes; relevant instruction discriminators; escrow/TVL/accounting drift               | Uncompromised Robinhood Safe pauses; use an independent Solana pause authority only if it is still valid; stop Executors; preserve finalized account snapshots; recover admin only if another valid authority path exists; otherwise invoke the preapproved lockout/migration contingency               |
| Solana Endpoint delegate                                            | App-selected libraries, ULN/DVNs, Executor, confirmations, and related Endpoint configuration                                       | Censorship or forged packet acceptance; release of escrow under a weakened verification path                                                                    | **Yes, indirectly.** With forged packets bearing the approved peer, the reviewed receive path can release escrow up to available balance and configured limits                                                                 | Endpoint/ULN account diffs and configuration instructions; exact DVN/library/Executor/confirmation drift; unexpected verified/delivered packets                        | Pause both sides through authorities not sharing the compromised signer set; stop delivery; restore exact approved configuration; reconcile packet GUIDs, supply, TVL, escrow, and in-flight state before any reactivation                                                                              |
| Solana OFT program upgrade authority                                | The complete executable code behind the fixed production program ID                                                                 | Replace all program logic, bypass pause/peer/rate/accounting constraints, falsify state, or drain escrow                                                        | **Yes: unlock.** Replacement code can release escrow without a Robinhood burn. It still cannot mint canonical SAN if the canonical mint authority is revoked, but custody loss can reach the full escrow balance               | Upgradeable-loader instruction and ProgramData slot/authority/hash change; checker executable-hash mismatch                                                            | Treat as a custody-key compromise: pause Robinhood immediately and Solana if an independent unchanged path remains; halt all message execution; snapshot ProgramData and escrow; reject in-place trust restoration until independent forensic review; use a separately approved migration/recovery plan |
| Fewer-than-threshold Safe/Squads signers                            | Their own approvals, devices, and possibly off-chain proposal/recovery channels                                                     | Phishing, false proposals, surveillance, availability loss, or progress toward threshold compromise                                                             | **No by themselves**, assuming true key and failure-domain independence and no module/recovery bypass                                                                                                                          | New owner/member, threshold, permission, module/guard/fallback, recovery, nonce, and anomalous proposal/approval activity                                              | Remove/replace the signer through an uncompromised threshold; rotate affected device and recovery material; cancel/reject proposals; pause if intent or scope is uncertain; investigate correlated exposure                                                                                             |
| Threshold Safe/Squads signers or an equivalent recovery/module path | Every role held by that Safe/Squads vault, including owner/admin/delegate and possibly upgrade control                              | Aggregate of all roles held: arbitrary configuration, unpause, weakened verification, ownership transfer, and for an upgrade vault full escrow-code replacement | **Yes, indirectly; yes directly for escrow if upgrade authority is included.** Multisig does not reduce the power available after threshold compromise                                                                         | Threshold-reaching approvals from unusual devices/times; unreviewed proposal hashes; owner/member/threshold/module/recovery changes; all underlying role/config events | Assume complete governance loss for the affected chain; pause from the other chain and any independently controlled local guardian; stop Executors; revoke signer access; preserve proposal/calldata evidence; rotate or migrate only under incident governance and independent review                  |

### Cross-role escalation paths

1. **Robinhood owner to full message-security control:** owner calls
   `setDelegate(attacker)`, attacker weakens receive verification, owner sets or
   retains a matching peer and unpauses, then forged messages credit SanOFT.
2. **Solana Store admin to escrow release:** admin replaces the Endpoint
   delegate and peer, removes/raises the inbound limiter, weakens verification,
   and unpauses; forged inbound messages can release escrow.
3. **Operations-Squads compromise:** the baseline same vault for Store admin and
   Solana delegate collapses two controls into one threshold. The attacker does
   not need a second compromise.
4. **Upgrade-authority compromise:** replacement code bypasses application-level
   separation entirely. A separate upgrade multisig reduces correlated risk but
   does not constrain a compromised upgrade threshold.
5. **Operational compromise without key theft:** a correctly signed but
   misdecoded or substituted proposal has the same on-chain effect as malicious
   governance. Independent calldata/instruction derivation and post-execution
   read-back are mandatory.

## 4. Residual risk, assumptions, and acceptance gates

The current design intentionally accepts governance-controlled configuration.
The highest-impact residual risks are threshold collusion/correlation,
compromised recovery or Safe modules, single-step authority transfer lockout,
and a malicious or compromised Solana upgrade threshold. Pause and rate limits
reduce exposure only while their controlling authority and code remain honest.

This model assumes the canonical mint authority remains exactly the approved
value, the reviewed production artifact matches the audit target and recorded
hashes, LayerZero Endpoint/library programs themselves match independently
approved identities and hashes, and monitoring uses at least one observation
path independent of the signing environment.

Before Phase 5B, independent reviewers must approve this model, exact Safe and
Squads identities and state, signer independence/recovery evidence, monitoring
ownership and drills, role-sharing decisions, finality/rate-limit policies, and
the exact build/configuration artifacts. A checker PASS is evidence only; it is
not authorization. Any unresolved Critical/High finding or any unexplained
governance drift keeps the entry gate closed.
