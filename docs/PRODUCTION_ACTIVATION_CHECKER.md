# Production Activation Checker

`pnpm san:check-production` is a read-only, fail-closed production snapshot
checker. It creates no signer, instruction, transaction, or proposal. It queries
Solana at `finalized`, queries Robinhood JSON-RPC, resolves current LayerZero
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
- escrow account program ownership, canonical mint, Store authority, balance,
  and Store TVL;
- Robinhood pause state, owner, Endpoint delegate, runtime bytecode hash, and
  EIP-1967 implementation/admin slots; any proxy slot is rejected;
- exact bidirectional peers, explicitly app-selected send/receive libraries,
  raw non-inherited ULN configs, DVNs, thresholds, Executor, confirmations, and
  enforced receive options;
- Solana inbound/outbound and Robinhood inbound/outbound rate limits against the
  selected canary profile;
- Robinhood supply, both in-flight directions, Solana TVL, escrow backing, and
  positive RPC snapshot heights. Robinhood reads are pinned to one block;
  Solana reads use finalized commitment plus `minContextSlot` where supported.
  Two consecutive complete observations must match before success.
- every privileged role differs from all explicitly supplied bootstrap/deployer
  identities.

Squads/Safe threshold, membership, modules, guards, signer independence, and
recovery policy are not derivable from a role-address comparison. They remain a
separate signed governance-evidence gate; the checker must not be described as
verifying them.

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
does not infer a multisig, confirmation count, deployment address, or bytecode
hash.

In-flight messages are not represented by one authoritative on-chain counter.
An independent event/message scanner must therefore write the JSON inventory
shape in `docs/examples/production-inflight-inventory.example.json`. Each entry
has a unique 32-byte LayerZero GUID, direction, positive decimal `amountRaw`,
and literal `in_flight` status. The checker derives both directional totals from
the file; no `SAN_OBSERVED_IN_FLIGHT_*` amount is accepted. The reviewed
`SAN_APPROVED_IN_FLIGHT_INVENTORY_SHA256`, ID, and totals must match exactly.

The inventory generator and its chain-range evidence remain a separately
reviewed input. A hash binds the checker to that exact artifact; it does not make
an operator-authored inventory independent by itself.

## Invocation

Use two independent Solana providers and two independent Robinhood providers in
separate runs. After populating only non-secret approved values:

```bash
SAN_EXPECTED_ACTIVATION_STATE=PRE_ACTIVATION_INERT \
SOLANA_MAINNET_RPC_URL=<READ_ONLY_SOLANA_RPC> \
ROBINHOOD_RPC_URL=<READ_ONLY_ROBINHOOD_RPC> \
pnpm san:check-production
```

Before initial activation, archive successful `PRE_ACTIVATION_INERT` results
from two provider pairs. Unpause Robinhood first only while Robinhood supply and
both in-flight directions are zero. If the ceremony is interrupted, re-pause
Robinhood and stop. Unpause Solana last; that Solana transaction is the public
activation boundary. Archive successful `CANARY_ACTIVE` results immediately.
This state is a bounded public canary window, not an exclusive one-message lane.
Any later reactivation with nonzero settled or in-flight state requires a
separately reviewed protocol and is rejected by `CANARY_ACTIVE`.

RPC errors, missing accounts, missing custom configs, malformed bytecode/loader
state, empty runtime code, missing pause roles, unresolved finality, absent
limits, mismatched inventory, or any unexpected value are terminal failures.
Operators stop; they do not substitute defaults or change live state to make the
checker pass.
