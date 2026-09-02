# Mainnet Canary Runbook

## Status

This is a future plan only. Phase 5A authorizes no mainnet transaction, no SAN
approval or movement, no unpause, and no LayerZero message.

## Preconditions

- Public source/history cleanup is complete.
- Independent Solana and EVM security reviews are closed.
- Verifiable Solana and reproducible EVM artifacts match deployed bytecode.
- Squads/Safe governance and recovery drills are complete.
- Deployed identities, authorities, peers, libraries, DVNs, Executors,
  confirmations, options, and rate limits pass independent read-back.
- Robinhood-source finality policy is resolved.
- Escrow/TVL and remote supply are zero; both sides are paused.
- Monitoring, incident communications, manual delivery, and retry procedures are
  staffed.
- A later committed phase approves the public activation boundary, exact
  operator-observation transfer direction, receiver, raw amount, maximum fee,
  signer set, and total public loss budget enforced by all four rate limits.

## Future initial public canary procedure

This procedure does not create an exclusive one-message lane. OFT send is
permissionless: after the final Solana unpause, any holder can race or accompany
the operator's observation transfer. If an exclusive canary is required, Phase
5B remains blocked until a separately audited atomic authorization mechanism
exists. The procedure below instead defines a bounded public activation window.

1. Record the clean checkpoint, tool versions, configuration hashes, and approved
   transaction manifest.
2. Re-verify canonical SAN and every production identity read-only.
3. Run the production checker with expected state `PRE_ACTIVATION_INERT`; require
   both applications paused and every other check passing before building either
   activation proposal.
4. Verify the recipient and whether its canonical SAN ATA exists. If absent,
   attach the freshly queried rent through per-transaction extra options.
5. Read all rate buckets and require canary capacity without changing them.
6. Prepare the exact approved raw amount and minimum. Do not obtain a live quote
   while paused; require zero dust, no
   unexpected OFT fee, and the approved maximum native fee.
7. Print a public summary and independently confirm chain ID/EID, signer,
   receiver bytes, amount, minimum, options, and refund address.
8. Verify the hashed in-flight inventory is empty and Store TVL, escrow balance,
   and Robinhood supply are all zero. `CANARY_ACTIVE` is forbidden for any
   reactivation with nonzero settled or in-flight state.
9. Unpause Robinhood first. Immediately read back Robinhood unpaused, Solana
   paused, zero Robinhood supply, and zero in-flight messages. No Robinhood
   holder can send because supply is zero, while canonical SAN remains blocked
   by the Solana pause. If the action or readback is interrupted or ambiguous,
   re-pause Robinhood and stop.
10. Unpause Solana last. This exact transaction is the public activation
    boundary. Ordinary sends are now permitted under the canary limits.
11. Run two complete `CANARY_ACTIVE` observations. They must agree and retain
    the initial zero state. If public activity has already changed accounting,
    stop the operator observation transfer and monitor/reconcile that activity.
12. If the later phase still authorizes it and the zero state remains, quote and
    submit the operator's exact observation transfer. Record its source
    transaction and GUID. Never resend an ambiguous attempt.
13. Monitor every GUID observed during the public window. Pending means wait;
    blocked or failed means inspect and stop—never weaken configuration or
    resend automatically.
14. After delivery, re-pause both applications through separately verified
    governance actions and require `PRE_ACTIVATION_INERT` with the now-approved
    settled balances.
15. Reconcile sender, escrow, `tvl_ld`, destination balance,
    destination supply, rate buckets, fees, events, nonce, replay state, and
    global supply.
16. Account for every source send, GUID, destination receive, and exact amount;
    do not claim exclusivity from the operator's intent.
17. Publish the checker output and a public record.
18. STOP. A return transfer or larger public limit requires another committed
    phase.

## Amount and direction

No amount or direction is authorized by this document. Humans must approve the
smallest operationally meaningful raw amount after considering SAN value,
decimal precision, fees, ATA rent, monitoring visibility, and the loss budget.
The value must be written literally into the later authorization and guarded
tooling; it must not default from an environment variable.

## Failure rules

- Never resend a pending, blocked, failed, or ambiguous canary.
- Never weaken peers, DVNs, confirmations, options, pause, or rate limits to make
  a canary pass.
- Never substitute another receiver, amount, signer, program, contract, or
  network.
- Never proceed to a return or larger amount based only on source confirmation.
