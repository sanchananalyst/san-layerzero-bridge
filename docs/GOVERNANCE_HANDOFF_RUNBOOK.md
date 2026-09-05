# Governance Handoff Runbook

## Status and safety boundary

This runbook specifies a future production ceremony. **Do not execute it in
Phase 5A.** Every ownership/admin transfer is a **HIGH-RISK OPERATIONAL
CEREMONY** because the current transfers are single-step and a valid but wrong
destination can permanently lock out governance.

The ceremony is permitted only under a separately authorized Phase 5B plan.
Both the Solana OFT Store and Robinhood `SanOFT` must be paused before the first
authority-changing action and remain paused through final read-back. No SAN may
move and no peer messaging may be enabled during handoff.

## Ceremony record

Fill every field from approved evidence. Blank, zero, shortened, ENS/domain,
QR-only, or verbally supplied addresses are invalid.

| Field                                      | Approved value/evidence                            |
| ------------------------------------------ | -------------------------------------------------- |
| Audit target                               | `d28762288bb5180ff292f57eef7132191f2037ec`         |
| Canonical SAN mint                         | `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`     |
| Production Solana OFT program              | `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`     |
| Exact Robinhood Safe address               | **UNRESOLVED — must be checksummed and approved**  |
| Safe chain ID                              | `4663`                                             |
| Safe threshold                             | **UNRESOLVED — baseline 3-of-5, must be approved** |
| Complete Safe owner list                   | **UNRESOLVED — attach signed roster**              |
| Safe modules/guard/fallback policy         | **UNRESOLVED — expected none unless reviewed**     |
| Exact Solana Squads multisig PDA           | **UNRESOLVED — must be base58 and approved**       |
| Squads vault index                         | **UNRESOLVED — proposed `0`, must be approved**    |
| Exact derived operations vault PDA         | **UNRESOLVED — must be base58 and approved**       |
| Squads threshold                           | **UNRESOLVED — baseline 3-of-5, must be approved** |
| Complete Squads members/voters/permissions | **UNRESOLVED — attach signed roster**              |
| Exact Solana upgrade-authority vault       | **UNRESOLVED — 4-of-7 preferred if separate**      |
| Current temporary authorities              | **UNRESOLVED — public addresses only**             |
| Forbidden bootstrap/deployer identities    | **UNRESOLVED — complete public-address lists**     |
| Ceremony lead / second verifier            | **UNRESOLVED — two different people**              |
| Incident commander / response channel      | **UNRESOLVED**                                     |

The evidence package must identify each signer, organization, voting
permission, device class, custody model, geographic/failure domain, and recovery
contact. It must not contain private keys, seeds, mnemonics, or recovery secrets.

## Governance readiness requirements

Before scheduling the ceremony:

- Safe and Squads signer rosters and thresholds are approved by governance and
  an independent security reviewer.
- Signer devices are hardware-backed where supported and are not shared with
  deployment workstations, CI, browsers, email, chat, RPC nodes, or each other.
- No two nominally independent signers share a seed backup, password manager,
  cloud account, device administrator, identity-provider recovery path, office,
  or single organizational approver without explicit risk acceptance.
- Recovery and offboarding procedures define lost-device, unavailable-signer,
  suspected-compromise, signer-departure, and threshold-loss cases. A recovery
  drill has succeeded off production without exposing recovery material.
- The Safe has no module, guard, or fallback handler unless its exact code and
  permissions have been independently reviewed. Squads member permissions,
  time locks, spending limits, and proposal authorities are exact and approved.
- At least one monitoring/read-back path is operationally independent from the
  proposal-building and signing environment.
- The incident commander can halt the ceremony and initiate counterparty-chain
  pause without asking a suspected compromised signer for approval.

## Independent address-verification protocol

1. Reviewer A derives the Safe address from the approved creation record,
   chain ID, owners, threshold, and deployment transaction evidence. Reviewer B
   independently queries deployed Safe state from a separate trusted RPC.
2. Display the full EIP-55 checksummed Safe address. Reject lowercase-only,
   truncated, domain-resolved, clipboard-transformed, or checksum-invalid input.
3. Reviewer A derives the Squads multisig PDA and vault PDA from the approved
   multisig and vault index. Reviewer B independently derives both with a
   separate tool/workstation and queries the multisig account owner, threshold,
   member set, voting permissions, and vault address from a separate trusted RPC.
4. Display every Solana address in full base58. Decode it to exactly 32 bytes,
   re-encode it, and require byte-identical equality. Reject the system/default
   all-zero key and any copy that changes after round-trip.
5. Compare addresses in at least two representations: full visible text and a
   cryptographic digest or decoded bytes. Read the first and last eight
   characters aloud only as an additional check, never as the sole check.
6. Use a repository-owned, read-only ceremony manifest. Do not copy addresses
   from chat, email, issue comments, search results, browser extensions, or the
   clipboard history. Clear the clipboard before and after each controlled copy.
7. Reviewer B compares the final encoded calldata/instruction destination with
   the approved manifest byte-for-byte. The transaction builder must not accept
   late manual edits.

Any mismatch, unreadable field, unexpected proxy/module/permission, or RPC
disagreement cancels the ceremony. Do not “correct and continue” in the same
session.

## Read-only preflight and dry run

No signing device is connected during preflight.

1. Verify the checked-out source and artifacts correspond exactly to the audit
   target and approved reproducible-build hashes. Confirm production bridge
   source is unchanged.
2. Refresh official LayerZero metadata and independently approve every exact
   Endpoint, library, DVN, Executor, confirmation, peer, and option value.
3. From two independently operated RPC provider pairs, read and archive current
   owner/admin/delegate/upgrade authority, pause state, Safe/Squads state,
   program/runtime hashes, peers, security configuration, rate limits, supply,
   Store TVL, escrow balance, and in-flight inventory.
4. Require the read-only production checker to pass
   `PRE_ACTIVATION_INERT`. A `CANARY_ACTIVE` result is invalid for handoff.
5. Construct—but do not sign—each proposed transfer. Decode the complete
   calldata or Solana instruction, program/contract, accounts, chain, current
   authority, destination, and ordering. Simulate where the chain/tool supports
   reliable no-broadcast simulation.
6. Reviewer B independently reconstructs the expected encoding and signs the
   ceremony sheet, not the transaction. Differences cancel the ceremony.
7. Conduct a spoken stop/go review: both applications paused, no SAN movement,
   no messaging, no unresolved alert, monitoring active, response owner ready.

## Future authorized execution order

The following ordering is descriptive and remains prohibited in Phase 5A:

1. Confirm both sides are paused again at finalized state.
2. Set and read back the Solana Endpoint delegate to the approved operations
   Squads vault.
3. Transfer and read back the Solana Store admin **last among Store-admin
   actions** to the same vault. Confirm the bootstrap admin is rejected.
4. Transfer and read back the Solana program upgrade authority to the approved
   upgrade vault. Confirm the bootstrap authority no longer controls it.
5. Prefer deploying `SanOFT` with the exact Safe as constructor owner/delegate
   so no EOA handoff is needed. If a separately approved deployment cannot do
   that, set and read back the Endpoint delegate first, then single-step transfer
   ownership to the same Safe and read it back immediately.
6. Re-run the complete `PRE_ACTIVATION_INERT` checker from two provider pairs.
   Do not unpause. Activation is a separate ceremony and authorization.

Only the minimum signers needed for a proposal sign it. Signers must verify the
proposal hash and decoded operation on their own trusted display; approval in a
chat channel is not authorization.

## Post-transfer read-back

After every individual transfer, wait for the approved finalized-state rule and
read the changed field through two independent RPC providers. Compare against
the ceremony manifest and archive block/slot, blockhash, transaction identity,
raw response, decoded value, provider identity, and two reviewer signatures.

Final read-back must prove:

- Robinhood owner and Endpoint delegate are the exact approved Safe;
- Safe threshold and complete owner set match; unexpected modules, guard, or
  fallback handler are absent;
- Solana Store admin and Endpoint delegate are the exact derived operations
  Squads vault;
- the Squads program owner, multisig, vault index, threshold, complete member
  set, and voting permissions match;
- Solana program upgrade authority is the exact approved vault and the deployed
  executable hash is unchanged;
- no forbidden bootstrap/deployer identity remains a role or multisig signer;
- both applications remain paused; and
- all peers, security configuration, rate limits, supply/backing, and in-flight
  values remain exact.

No subsequent operation begins until the immediately preceding read-back
passes. A local UI success banner is not evidence.

## Abort, rollback, and lockout contingency

- **Before execution:** discard the proposal and rebuild from a fresh approved
  manifest. This is the preferred rollback.
- **Submitted but not executed:** reject/cancel through the multisig mechanism
  if available; do not replace it with a rushed proposal.
- **Transfer still controlled by the old authority:** keep both sides paused and
  use only a separately reviewed correction returning to the exact approved
  address.
- **Transfer executed to the correct multisig but later steps fail:** stop with
  both sides paused. Use the new verified authority only after an independent
  incident review; do not automatically transfer back.
- **Transfer executed to a wrong valid address:** assume irreversible lockout.
  Do not attempt activation, SAN movement, or improvisational recovery. Pause
  from any still-independent authority/counterparty chain, stop Executors,
  preserve evidence, and invoke the preapproved migration/redeployment and
  stakeholder-notification plan.
- **Threshold or signer evidence differs:** treat the destination as
  unapproved even if its address matches. Stop and investigate.

Because a wrong single-step destination may leave no callable rollback, a
rollback plan is not a substitute for address verification. Future audited
versions should evaluate `Ownable2Step` or equivalent acceptance semantics.

## Completion rule

Handoff is complete only after both independent read-backs and the checker pass,
the evidence bundle is reviewed, and the incident commander closes the
ceremony. Completion does not unblock Phase 5B and never authorizes unpause.
