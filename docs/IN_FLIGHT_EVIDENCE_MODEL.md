# Production In-Flight Evidence Model

## Security objective

The production checker must not accept an operator-entered packet list or an
unbounded API result as proof of bridge liabilities. The approved manifest is a
reproducible, range-complete observation of source and destination chains. It is
read-only and creates no signer, instruction, transaction, or proposal.

## Scanner and trust boundaries

Run `pnpm san:scan-production-inflight` with two operationally independent
Solana RPCs and two operationally independent Robinhood RPCs. The scanner:

1. requires explicit deployment-to-finalized ranges and exact production
   Store/OFT identities;
2. requires each approved scan end to be no later than each provider's current
   finalized head and records genesis/start/end anchors at that exact range;
3. paginates Solana signatures to the approved start and paginates Robinhood
   logs across the full approved block range;
4. derives packets from source OFT events plus matching Endpoint `PacketSent`
   evidence, using `amountReceivedLD`/its Solana equivalent for the amount that
   can be credited remotely;
5. proves settlement only with destination OFT receive events; a LayerZero Scan
   status alone cannot mark a packet delivered;
6. requires byte-for-byte canonical agreement between both provider pairs;
7. queries the official LayerZero Scan API as corroboration and fails on an
   omitted GUID, pathway disagreement, or delivery-status conflict; and
8. rejects duplicate/replayed GUIDs, orphan destination events, incomplete
   pagination, pruned history, unavailable blocks/transactions, and unknown
   schema fields.

RPC independence is a human control. Distinct URL origins are required by the
schema, but reviewers must still verify that the endpoints are not aliases for
the same backend or trust domain. LayerZero Scan is a third observation source,
not the accounting authority.

## Manifest binding

Schema version 2 binds:

- scanner name/version/source commit and bridge code audit target;
- exact chain IDs, EIDs, Endpoint identities, Solana OFT program/Store, and EVM
  OFT address;
- inclusive finalized ranges, boundary block hashes, completeness, and
  pagination flags;
- provider identities and reconciliation results;
- every GUID's direction, nonce, source transaction/height/hash/event index,
  source/destination OApps, credited raw amount, receiver, status, destination
  evidence, and API status;
- result count, unresolved count, both directional raw totals; and
- a domain-separated canonical SHA-256 checksum.

The checker pins the reviewed scanner commit, exact ranges, manifest ID,
checksum, and directional totals. Each range end must be finalized and no later
than the corresponding live state anchor; equal heights require equal hashes.
The checker reports the remaining slot/block gap. Because the only supported
states are paused pre-activation or the initial all-zero canary boundary, exact
accounting plus pause/zero-state requirements reject economically meaningful
activity in that interval. Solana RPC cannot fetch all account state at an exact
arbitrary historical slot, so claiming exact temporal equality for a manifest
reviewed before the checker run would be false.

## Accounting semantics

Only source-emitted messages without destination receive evidence are
outstanding. `in_flight`, `failed`, `blocked`, and `unresolved` packets remain
liabilities; `delivered` packets do not. Both directions are included:

```text
Solana Store TVL
  = Robinhood total supply
  + outstanding Solana-to-Robinhood amountReceivedLD
  + outstanding Robinhood-to-Solana amountReceivedLD
```

Escrow balance must be at least Store TVL. This is intentionally conservative
for failed/blocked packets: no operator or API may erase a liability merely by
changing its status.

## Required human approval

Before use, two reviewers must independently verify scanner source commit,
deployment start anchors, full provider retention, provider independence,
manifest checksum, identities, and all nonzero packet evidence. The checksum is
integrity protection, not a digital signature. Archive the manifest, scanner
commit, raw provider/API outputs, and reviewer approvals together.

Any missing field, provider conflict, stale anchor, truncation, orphan receive,
duplicate GUID, API disagreement, or unexplained accounting mismatch is a hard
stop. Never repair evidence by editing the manifest.
