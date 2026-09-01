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
- A later committed phase approves an exact direction, receiver, raw amount,
  maximum fee, signer set, and exactly one OFT message.

## Future one-message procedure

1. Record the clean checkpoint, tool versions, configuration hashes, and approved
   transaction manifest.
2. Re-verify canonical SAN and every production identity read-only.
3. Verify the recipient and whether its canonical SAN ATA exists. If absent,
   attach the freshly queried rent through per-transaction extra options.
4. Read all rate buckets and require canary capacity without changing them.
5. Quote the exact approved raw amount and minimum. Require zero dust, no
   unexpected OFT fee, and the approved maximum native fee.
6. Print a public summary and independently confirm chain ID/EID, signer,
   receiver bytes, amount, minimum, options, and refund address.
7. Create an exclusive durable send-attempt marker before signing.
8. Unpause only the source operation required by the approved design, using the
   exact governance transaction authorized for the canary.
9. Submit exactly one OFT send. Record its source transaction and GUID. No second
   or replacement send is permitted under any status.
10. Re-pause as soon as the packet is confirmed outbound if the approved pause
    semantics do not interfere with delivery; otherwise follow the pre-reviewed
    destination retry design.
11. Monitor only that GUID. Pending means wait; blocked or failed means inspect
    and stop—never reconfigure or resend automatically.
12. On delivery, reconcile sender, escrow, `tvl_ld`, destination balance,
    destination supply, rate buckets, fees, events, nonce, replay state, and
    global supply.
13. Prove exactly one source send, one GUID, one destination receive, and the exact
    approved amount.
14. Run the complete configuration checker again and publish a public record.
15. STOP. A return transfer or public launch requires another committed phase.

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
