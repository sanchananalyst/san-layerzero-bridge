# Mainnet Wiring Runbook

## Phase boundary

This is an unapplied Phase 5A plan for a later separately authorized wiring
phase. Both applications must already be deployed, authority-controlled by the
approved multisigs, zero-supply/zero-escrow, and paused. Wiring must finish with
the bridge still paused and with no OFT message sent.

## Proposed production matrix

| Setting                      | Solana side                                                                 | Robinhood side                                                                            |
| ---------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local EID                    | `30168`                                                                     | `30416`                                                                                   |
| Remote EID                   | `30416`                                                                     | `30168`                                                                                   |
| Endpoint                     | `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`                              | `0x6f475642a6e85809b1c36fa62763669b1b48dd5b`                                              |
| Send library                 | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH`                              | `0xc39161c743d0307eb9bcc9fef03eeb9dc4802de7`                                              |
| Receive library              | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH`                              | `0xe1844c5d63a9543023008d332bd3d2e6f1fe1043`                                              |
| Executor                     | worker PDA `AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK`                   | `0x4208d6e27538189bb48e603d6123a94b8abe0a0b`                                              |
| Required DVNs                | explicit none                                                               | explicit none (`requiredDVNCount = 255`)                                                  |
| Optional DVNs                | LayerZero Labs, Nethermind, Horizen                                         | LayerZero Labs, Nethermind, Horizen                                                       |
| Optional threshold           | `2`                                                                         | `2`                                                                                       |
| Standard-send receive option | `200000` CU, value `0`                                                      | `200000` gas, value `0`                                                                   |
| Compose                      | disabled by launch policy; no type-2 options                                | disabled by launch policy; no type-2 options                                              |
| Rate profile                 | Canary: `500000000000` raw capacity and `5787037` raw/s; both peer limiters | Canary: `500000000000` raw capacity/refill over `86400` seconds; both directional buckets |

DVN identities, sorted in the program-required byte order:

| Provider       | Solana                                         | Robinhood                                    |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| LayerZero Labs | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` | `0xd01ae6905d48315f7be10c7330aecf8360ef5b12` |
| Nethermind     | `GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab` | `0x0ffe02df012299a370d5dd69298a5826eacafdf8` |
| Horizen        | `HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX` | `0x1258a278519c7f4bd997a9c3bfd4aa802a028d89` |

The final encoded arrays must be machine-sorted and independently decoded; the
table order is not an authorization to copy unsorted bytes.

## Peer derivation

- Solana peer: left-pad the future Robinhood SanOFT address to 32 bytes.
- Robinhood peer: decode the future Solana OFT Store base58 public key to its
  exact 32 bytes.
- Derive both twice with independent libraries and require byte-for-byte equality.
- No peer value exists until both production addresses are deployed and recorded.

## Confirmation decision

- Solana-source messages: configure `32` on the Solana send and Robinhood
  receive ULN. This meets LayerZero's current Solana production minimum.
- Robinhood-source messages: `32` on the Robinhood send and Solana receive ULN
  is only a provisional soft-confirmation proposal. Robinhood documents that L2
  blocks reach Ethereum-backed ordering only after batch posting, with full
  Ethereum finality later. A count of 32 fast L2 blocks is not the seven-day
  withdrawal challenge period and does not prove L1 posting/finality.
- Before wiring, obtain documented DVN behavior for Robinhood Nitro and approve
  either a count/policy tied to Ethereum posting/finality or explicit acceptance
  of sequencer soft-confirmation risk. Until then, Robinhood-source confirmations
  are a blocker.

## Conditional Solana ATA rent

Keep enforced receive `value = 0`. For each EVM→Solana send, derive and query the
recipient's canonical SAN ATA. If absent, query the current rent-exempt minimum
for a 165-byte legacy SPL Token account and add per-transaction extra options with
gas/CU `0` and only that `msg.value`. Phase 5A observed `2_039_280` lamports, but
the sender must query again immediately before quoting. Existing ATAs use value
zero.

## Future dry-run and execution sequence

1. Re-resolve official metadata and selected DVN availability.
2. Load an address-only configuration; no private keys in the repository.
3. Generate a complete dry run for peers, libraries, all four ULN configs,
   Executors, enforced options, and all four rate-limit settings.
   `validateProductionRateLimitPlan` must pass before any rate-limit transaction
   is built; an absent, zero, unreadable, or mismatched direction aborts the run.
4. Decode every transaction independently and compare it with the approved
   matrix. Require chain/EID/signer/target/calldata allowlists.
5. Execute at most one administrative transaction, then stop and read it back.
6. Repeat step 5 only after the prior receipt and state are final and approved.
7. Run a complete read-only checker from two RPC providers.
8. Require no inherited default, no Dead DVN, exact any-2-of-3 semantics, matching
   send/receive confirmations, exact peers, exact Executors/options/rate limits,
   and unchanged governance.
9. Verify escrow, `tvl_ld`, and Robinhood supply remain zero and Robinhood remains
   paused.
10. Publish the wiring record and STOP.

## Mandatory stop

Wiring completion does not authorize unpause or a canary. Never send a zero-value
test packet as a wiring check unless a later phase explicitly authorizes a
LayerZero message.
