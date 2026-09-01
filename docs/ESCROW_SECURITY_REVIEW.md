# Solana OFT Adapter Escrow Security Review

## Scope and result

This focused Phase 3 review covers the checked-in LayerZero Solana OFT Adapter at `programs/oft`, pinned to LayerZero V2 `oapp`/`utils` revision `c09287a`. No vendor program code was modified.

For canonical legacy SPL SAN with six decimals and no token transfer fee, the reviewed code preserves:

```text
escrow SAN balance >= OFTStore.tvl_ld
```

at every successful transaction boundary, not merely after all messages settle. `withdraw_fee` cannot directly withdraw principal represented by `tvl_ld`. No CRITICAL direct-admin-withdrawal finding was found.

This conclusion is conditional on the exact deployed bytecode, upgrade authority, correct Adapter initialization, canonical mint/escrow accounts, peer and Endpoint security, overflow checks, and Solana transaction atomicity.

## Accounts and authority

- `OFTStore` is a program-owned PDA derived from `['OFT', token_escrow]`.
- The escrow is a legacy SPL Token account whose mint must match `OFTStore.token_mint`, whose address must match `OFTStore.token_escrow`, and whose token authority must be the OFT Store PDA.
- Only the deployed OFT program can sign with OFT Store PDA seeds.
- A user source account on outbound send must have the transaction signer as its token authority. The Adapter cannot pull from unrelated holder wallets.

## Outbound debit and TVL

For `OFTType::Adapter`, `compute_fee_and_adjust_amount`:

1. computes the amount expected after any token-program transfer fee;
2. removes decimal dust;
3. calculates an application OFT fee; and
4. returns `amount_sent_ld`, backed principal `amount_received_ld`, and `oft_fee_ld`.

`send.rs` then:

```text
tvl_ld += amount_received_ld
transfer_checked(user source -> escrow, amount_sent_ld)
```

For SAN, the token transfer fee is zero and `ld2sd_rate = 1`. Therefore:

```text
amount_sent_ld = amount_received_ld + oft_fee_ld
escrow increase = backed TVL increase + withdrawable application fee
```

With the recommended zero application fee, escrow and TVL increase by exactly the same amount. The source account authority/mint/program and escrow authority/mint/program are all constrained. Rate-limit consumption and Endpoint send occur in the same atomic transaction; a later failure rolls back both token transfer and state changes.

Release-build arithmetic overflow checks are explicitly enabled in the workspace `Cargo.toml`, so `tvl_ld +=` cannot wrap.

## Authenticated inbound credit

`lz_receive.rs` requires all of the following before release:

- a peer PDA derived for `params.src_eid`;
- `peer.peer_address == params.sender`;
- the correct OFT Store PDA, canonical mint, escrow, token program, destination owner, and destination ATA; and
- successful EndpointV2 `clear` using the exact receiver, source EID, sender, nonce, GUID, and message.

Only after Endpoint clear succeeds does Adapter mode decode `amount_sd`, convert it one-for-one to local units, consume the inbound rate limiter, execute:

```text
tvl_ld -= amount_received_ld
transfer_checked(escrow -> recipient, amount_received_ld)
```

Underflow checks prevent a release greater than `tvl_ld`; insufficient escrow also makes the SPL transfer fail. If decoding, account slicing, rate limiting, TVL subtraction, token transfer, compose scheduling, or any later instruction fails, Solana transaction atomicity rolls back both the Endpoint clear CPI and OFT/escrow changes.

Consequently, an unauthenticated caller, wrong peer, malformed message, replay, or amount exceeding TVL cannot produce a successful escrow release under the reviewed program.

## `withdraw_fee`

The instruction requires the signer to equal `OFTStore.admin` through:

```text
has_one = admin @ OFTError::Unauthorized
```

It permits a transfer only when:

```text
escrow.amount - tvl_ld >= requested fee_ld
```

and the transfer is signed by the OFT Store PDA. After a valid withdrawal:

```text
new escrow = old escrow - fee_ld >= tvl_ld
```

If `escrow.amount < tvl_ld`, checked subtraction aborts rather than wrapping. Thus the admin can withdraw genuine surplus (application fees or tokens donated directly to escrow) but cannot directly withdraw accounted principal through `withdraw_fee`.

Pause does not block `withdraw_fee`. This does not violate the principal invariant, but incident policy should account for fee withdrawal remaining available while send/receive is paused.

## Inductive invariant proof

Base case after Adapter initialization: escrow is empty and `tvl_ld = 0`, so the invariant holds.

- Outbound SAN: escrow increases by `amount_sent_ld`; TVL increases by `amount_received_ld`; with no transfer fee, `amount_sent_ld >= amount_received_ld`. The invariant is preserved.
- Inbound SAN: both escrow and TVL decrease by the same `amount_received_ld`. Underflow and token balance checks abort invalid attempts. The difference `escrow - TVL` is unchanged.
- Fee withdrawal: only an amount at most `escrow - TVL` is removed. The invariant is preserved.
- Direct donation to escrow: escrow increases while TVL is unchanged. The invariant is strengthened.
- Failed instruction: the transaction is atomic and no state transition commits.

By induction, the invariant holds across all successful reviewed state transitions.

## Governance and upgrade limits of the proof

The proof does **not** mean governance is non-custodial:

- The OFT Store admin can change the configured peer. A malicious remote peer can create valid LayerZero messages with arbitrary recipient/amount fields. If the configured DVN/delegate security also accepts those messages, the normal authenticated receive path can release up to all TVL. This is indirect custody power, not a `withdraw_fee` bypass.
- The Endpoint delegate can change libraries and verification configuration. Weak or malicious configuration can make forged messages deliverable.
- The program upgrade authority can deploy code that removes every restriction and transfers escrow. A malicious upgrade can bypass the invariant entirely.
- A program built from different source, compiler/toolchain, feature flags, dependencies, or loader state is outside this proof.

All three authorities must be controlled by reviewed multisig governance, monitored, and handed off before deposits.

## Tests and limitations

`test/scripts/oftEscrowSecurity.script.test.ts` adds source-regression guards for:

- admin authorization and the surplus-only withdrawal expression;
- checked release arithmetic configuration;
- outbound TVL increase and escrow transfer;
- peer validation and Endpoint clear preceding release;
- inbound TVL/escrow decrease; and
- an arithmetic model covering outbound, inbound, and fee withdrawal.

These guards are complemented by `test/anchor/oftAdapter.runtime.test.ts`. Its
eight local-validator tests passed in Phase 5A.1 and exercise initialization,
atomic escrow/TVL transitions, unauthorized debit/withdrawal, surplus-only
withdrawal, wrong peer/Endpoint/malformed messages, pause behavior, and both
rate-limit buckets. Artifact equivalence and independent review remain required.

## Findings

### CRITICAL

None found. In particular, OFT Store admin cannot directly withdraw collateralized SAN through the reviewed `withdraw_fee` instruction.

### HIGH

1. **Upgrade authority is a custody authority.** A malicious upgrade can transfer all escrow. Mitigation: verified build plus multisig upgrade authority, monitoring, and governed upgrade policy before deposits.
2. **Admin/delegate configuration can indirectly drain escrow.** A malicious peer or weakened security stack can turn forged or malicious remote messages into authenticated releases. Mitigation: multisig control, explicit two-of-three DVNs, peer/read-back checks, pause/rate limits, and config monitoring.
3. **Current Robinhood default uses the deprecated Dead DVN.** Inheriting defaults makes the channel undeliverable and current cross-chain defaults mismatch. Mitigation: explicit custom configuration on all four send/receive surfaces.

### MEDIUM

1. **Governance can reconfigure security.** Multisig separation, monitoring,
   transaction-by-transaction read-back, and an independent audit remain
   mandatory.
2. **Runtime tests do not prove deployed bytecode equivalence.** Close the
   digest-pinned reproducible-build gate before deployment.

### LOW

1. **`withdraw_fee` remains callable while paused.** Principal remains protected, but emergency expectations should document this behavior.

The tracked starter wallet `junk-id.json` was inspected without displaying its secret bytes, confirmed to be sample key material used only by the starter configuration, removed, and replaced for runtime tests by an ignored, generated, test-only wallet.
