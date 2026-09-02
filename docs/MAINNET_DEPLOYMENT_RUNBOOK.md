# Mainnet Deployment Runbook

## Phase boundary

This is a non-executing Phase 5A plan. It must not be run until a later committed
authorization explicitly permits the exact mainnet transactions. Deployment and
wiring are separate phases. No production private key belongs in this repository
or in shell history.

## Required approvals before execution

- Independent source, bytecode, Solana program, governance, decimals, escrow,
  emergency-control, and operational reviews are complete.
- The Docker/verifiable Solana build is reproducible and its ELF/executable
  hashes are approved.
- Canonical SAN and current LayerZero metadata are freshly re-verified.
- Final Squads/Safe addresses and thresholds are approved.
- An exact transaction manifest, fee budget, signer allowlist, and rollback plan
  are approved under a new phase.
- Mainnet RPC endpoints are read-only until the signing ceremony begins, and all
  signing tools verify genesis/chain ID/EID immediately before every signature.

## Future inert deployment sequence

Each numbered item is a hard stop/read-back gate. Never batch steps.

1. **Re-verify canonical SAN mint.** At finalized commitment require mint
   `GQz5…pump`, legacy SPL Token, 6 decimals, fixed supply matching the approved
   checkpoint, and null mint/freeze authorities. Stop on any difference.
2. **Deploy the production Solana OFT program.** Require program ID
   `9myH…TvcD`, approved verifiable ELF/executable hashes, approved upgrade
   authority, mainnet genesis, and exact loader/program-data derivation.
3. **Verify program bytecode.** Read the deployed program and program-data
   accounts, executable flag, loader, upgrade authority, and on-chain program
   hash. Match the approved verifiable build byte-for-byte.
4. **Create the real SAN OFT Adapter.** Use Adapter lock/unlock mode, canonical
   SAN mint, legacy token program, and the approved Store admin/delegate. Do not
   create a Native OFT and do not change SAN mint/freeze authorities. The
   transaction must create a Store whose on-chain `paused` field is already
   `true`; there is no post-creation pause race to close.
5. **Verify zero custody state.** Read back OFT type, mint, token program, Store,
   escrow, admin, delegate, `paused == true`, `escrow.amount == 0`, and
   `tvl_ld == 0`. Confirm both Solana peer rate limiters are still unset until the
   separately approved wiring phase.
6. **Deploy Robinhood SanOFT.** Require chain ID `4663`, Endpoint EID `30416`,
   name `San Chan`, symbol `SAN`, 6 decimals, approved non-upgradeable creation
   bytecode, and the approved owner Safe. Initial total supply must be zero.
7. **Verify default EVM pause.** The constructor must leave `paused() == true`.
   Treat any unpaused deployment as wrong bytecode and stop; do not rely on a
   follow-up pause transaction to repair it.
8. **Verify zero EVM supply.** Read name, symbol, decimals, shared decimals,
   conversion rate, token address, Endpoint, owner, delegate, pause, both rate
   buckets, and `totalSupply() == 0`. Verify no proxy and no arbitrary mint ABI.
9. **Transfer production authorities to multisigs.** Transfer the Solana program
   upgrade authority, Store admin, Endpoint delegate, pause/unpause roles,
   SanOFT ownership, and Robinhood Endpoint delegate exactly as approved.
10. **Verify authority read-back.** Independently query every authority from two
    RPC providers. Confirm no deployer or personal wallet retains privilege.
11. **Archive the deployment-only read-back and stop before wiring.** Publish
    the inert deployment record and hashes. Solana escrow/TVL and Robinhood
    supply must remain zero, and both applications must remain paused. The full
    production checker intentionally requires peers, explicit LayerZero config,
    and all four limiters, so it cannot pass until the later wiring runbook is
    complete; do not weaken it to create a deployment-only success.

## Failure policy

- Never retry an ambiguous transaction until its signature/hash and resulting
  state are exhaustively resolved.
- Never deploy a replacement at a different identity to bypass a mismatch.
- Never alter SAN authorities, rate limits, security settings, or governance to
  make a failed step pass.
- On any unexpected state, stop with the applications inert and escalate for
  human review.

## Mandatory stop

Completion of this runbook does not authorize peers, libraries, DVNs, Executors,
confirmations, enforced options, rate limits, unpause, or a token transfer.
