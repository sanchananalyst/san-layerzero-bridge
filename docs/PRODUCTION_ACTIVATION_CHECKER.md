# Production Activation Checker

`pnpm san:check-production` is a read-only, fail-closed production snapshot
checker. It creates no signer, instruction, transaction, or proposal. It queries
Solana and Robinhood at finalized anchors, resolves current LayerZero
metadata/configuration, and exits nonzero on any missing or unexpected value.

## Explicit expected state

The caller must select exactly one state:

- `PRE_ACTIVATION_INERT`: both the Solana Store and Robinhood SanOFT are paused.
- `CANARY_ACTIVE`: initial public activation only. Both applications are
  unpaused, Store TVL, escrow, remote supply, both in-flight directions, and
  the message inventory are all exactly zero, and every other condition passes.

A one-sided pause/unpause, missing state, or unknown state is rejected. The
checker is observational; it never offers an option to repair or activate state.

## Coverage

The checker reads and validates:

- mainnet chain IDs/EIDs and canonical SAN mint, token program, decimals, Store,
  escrow, program, contract, and Endpoint identities; Store mode must be
  `Adapter`, and mint supply/mint authority/freeze authority must equal reviewed
  values;
- Solana Store pause state, pauser, unpauser, admin, Endpoint delegate, program
  executable flag, upgradeable-loader owner, ProgramData address, ProgramData
  owner/non-executable state, upgrade authority, and executable SHA-256;
- the approved Squads v4 multisig account, its program owner, exact complete
  member and voting-member sets, threshold, and vault PDA derived from the
  approved vault index; that vault must be both Store admin and Endpoint
  delegate;
- escrow account program ownership, canonical mint, Store authority, balance,
  and Store TVL; the decoded Store's immutable token mint and escrow must equal
  canonical SAN and the approved escrow, and the Store must be the production
  `OFT` PDA derived from that escrow;
- Robinhood pause state, owner, Endpoint delegate, Safe threshold, exact Safe
  owner set, runtime bytecode hash, and EIP-1967 implementation/admin slots; the
  same approved Safe must be owner and delegate, and any SanOFT proxy slot is
  rejected;
- exact bidirectional peers, explicitly app-selected send/receive libraries,
  raw non-inherited ULN configs, DVNs, thresholds, Executor, confirmations, and
  enforced receive options;
- Solana inbound/outbound and Robinhood inbound/outbound rate limits against one
  explicitly selected `canary`, `publicLaunch`, `normal`, or `mature` profile;
- Robinhood supply, both in-flight directions, Solana TVL, escrow backing, and
  positive finalized snapshot heights. Robinhood reads are pinned to one
  `finalized` block number and hash. All critical Solana accounts are fetched in
  one `getMultipleAccountsInfoAndContext` response and decoded only from those
  returned bytes. Its context slot is bounded by finalized heads and bound to a
  fetched blockhash. Two consecutive complete observations must match before
  success.
- every privileged role differs from all explicitly supplied bootstrap/deployer
  identities.

The checker now reads observable Squads threshold/membership/permissions and
Safe threshold/owners at the pinned chain snapshots. It still cannot prove
signer-device independence, beneficial ownership, geographic or employer
separation, recovery/offboarding readiness, or the review quality of a pending
proposal. Safe modules, guards, and fallback handlers also remain a separate
signed governance-evidence gate. If the upgrade authority uses a different
multisig from the operations Squads, the checker exact-matches its vault address
but does not currently decode that second multisig's internal threshold or
members; separate signed evidence is mandatory.

The exact accounting identity is:

```text
Solana Store TVL
  = Robinhood total supply
  + Solana-to-Robinhood in-flight raw amount
  + Robinhood-to-Solana in-flight raw amount
```

Escrow balance must be at least Store TVL; any surplus is separately governed by
the fee-withdrawal policy.

## Approved inputs

Every blank in `.env.example` is deliberate. Values must be copied from reviewed
governance, reproducible-build, finality, and deployment records. The checker
does not infer a multisig, signer set, threshold, confirmation count, deployment
address, or bytecode hash.

Phase 5A.4 freezes Robinhood-source confirmations at 30 and Solana-source
confirmations at 32. `SAN_RATE_LIMIT_PROFILE` is mandatory and accepts only the
four frozen policy names. The checker also requires independently approved
ProgramData address, executable hash, and upgrade authority for the Solana
LayerZero Endpoint and ULN302 programs, and binds every Solana observation and
in-flight manifest to the exact mainnet genesis hash. An address-only trust-root
match is insufficient.

In-flight messages are not represented by one authoritative on-chain counter.
`pnpm san:scan-production-inflight` therefore scans the complete approved range
through each chain's finalized head using two independent RPC providers per
chain. It reconciles OFT source events with Endpoint packet evidence, reconciles
destination OFT receive events, rejects duplicate GUIDs and provider
disagreement, and uses LayerZero Scan only as corroboration. The API never
overrides missing on-chain evidence.

The schema-v2 manifest binds scanner name/version/source commit, bridge code
target, exact EIDs/Endpoints/OApps, both finalized ranges and boundary hashes,
pagination/completeness flags, provider identities, per-message evidence,
directional raw totals, and a canonical checksum. The checker separately pins
the approved scanner commit, ranges, manifest checksum, inventory ID, and
totals. Its range ends must be finalized and no later than the checker's Solana
common-context slot and Robinhood finalized block; if a height is equal, its
blockhash must also match. See
`IN_FLIGHT_EVIDENCE_MODEL.md` and the example manifest.

An approved checksum prevents substitution after review; it is not a signature
and does not prove reviewer independence. Human review of the scanner commit,
ranges, provider separation, and final manifest remains mandatory.

## Invocation

First generate and independently review the manifest with two Solana and two
Robinhood RPC providers. Then populate only non-secret approved values and run:

```bash
SAN_EXPECTED_ACTIVATION_STATE=PRE_ACTIVATION_INERT \
SOLANA_MAINNET_RPC_URL=<READ_ONLY_SOLANA_RPC> \
ROBINHOOD_RPC_URL=<READ_ONLY_ROBINHOOD_RPC> \
pnpm san:check-production
```

The approved manifest must be recent enough for the ceremony and cannot extend
beyond the checker's state snapshot. The checker exposes any intervening range;
in supported pre-activation/initial-canary states, pause/zero-state requirements
and exact accounting provide the additional fail-closed guard. RPC providers
must be operationally independent; merely using two URLs for one backend does
not satisfy the human evidence requirement.

Every authority handoff must occur only while `PRE_ACTIVATION_INERT` passes;
`CANARY_ACTIVE` is not a valid handoff state. Before initial activation, archive
successful `PRE_ACTIVATION_INERT` results from two provider pairs. Unpause
Robinhood first only while Robinhood supply and both in-flight directions are
zero. If the ceremony is interrupted, re-pause Robinhood and stop. Unpause
Solana last; that Solana transaction is the public activation boundary. Archive
successful `CANARY_ACTIVE` results immediately.
This state is a bounded public canary window, not an exclusive one-message lane.
Any later reactivation with nonzero settled or in-flight state requires a
separately reviewed protocol and is rejected by `CANARY_ACTIVE`.

RPC errors, missing accounts, missing custom configs, malformed bytecode/loader
state, empty runtime code, missing pause roles, unresolved finality, absent
limits, mismatched inventory, or any unexpected value are terminal failures.
Operators stop; they do not substitute defaults or change live state to make the
checker pass.
