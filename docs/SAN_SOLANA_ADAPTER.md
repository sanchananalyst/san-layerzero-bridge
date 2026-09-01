# Proposed SAN Solana OFT Adapter

## Status and prohibition

This is a Phase 2A/2B read-only design record. **Do not run the command in this document.** No OFT Store, escrow account, peer, or LayerZero pathway has been created.

## Verified canonical SAN mint

The repository's read-only inspector queried finalized Solana mainnet state through `https://api.mainnet-beta.solana.com/`. It verified the mainnet genesis hash and most recently observed the mint at slot `443394921` on 2026-09-01.

| Property              | On-chain value                                 |
| --------------------- | ---------------------------------------------- |
| Mint                  | `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump` |
| Owner                 | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`  |
| Token program         | Legacy SPL Token                               |
| Account data length   | 82 bytes                                       |
| Decimals              | 6                                              |
| Raw supply            | `999998816193310`                              |
| Human-readable supply | `999998816.19331 SAN`                          |
| Mint authority        | revoked (`null`)                               |
| Freeze authority      | revoked (`null`)                               |
| Token-2022 extensions | not applicable                                 |

Because the mint authority is revoked, the current supply is also the maximum possible supply under the legacy SPL Token program. Adapter creation must not and does not restore an authority.

Re-run `SAN_SOLANA_MINT=GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump pnpm san:inspect` before any later phase and compare the complete output. The script is read-only and refuses a non-mainnet RPC, non-canonical mint, or unsupported token-program owner.

## OFT Adapter compatibility

SAN is compatible with the installed LayerZero existing-token OFT Adapter's lock/unlock mechanism:

- SAN is transferable under the legacy SPL Token program.
- It has no Token-2022 transfer fee, transfer hook, permanent delegate, non-transferable, confidential-transfer, default-frozen, pausable, scaled-amount, or other extension.
- The adapter's `OFTType.Adapter` send branch uses `transfer_checked` to move holder-authorized SAN into escrow.
- Its authenticated receive branch uses `transfer_checked` signed by the OFT Store PDA to release SAN.
- Adapter initialization does not invoke `mint_to`, `burn`, or `set_authority` and does not modify the canonical mint.

MABA is neither needed nor permitted by this architecture.

## Decimal model

Phase 3 approves matching local precision on both chains:

| Quantity                          |          Value |
| --------------------------------- | -------------: |
| Solana local decimals             |              6 |
| Robinhood local decimals          |              6 |
| Shared decimals                   |              6 |
| Solana decimal conversion rate    | `10^(6-6) = 1` |
| Robinhood decimal conversion rate | `10^(6-6) = 1` |
| Smallest cross-chain amount       | `0.000001 SAN` |

There is no decimal dust on either chain: one base unit on either side equals one shared-decimal unit. Any integer local amount is exactly representable cross-chain.

The LayerZero shared amount is encoded as `uint64`. At 6 shared decimals, the maximum representable omnichain supply is:

```text
18,446,744,073,709,551,615 shared units
= 18,446,744,073,709.551615 SAN
```

SAN's fixed supply of `999,998,816.19331 SAN` is approximately 18,446 times below that limit. Its full supply is safely representable.

`SanOFT.sol` overrides only `decimals()` to return `6`; LayerZero's standard debit, credit, burn, mint, and authenticated receive behavior remains unchanged.

## Exact proposed creation command

The installed task is `lz:oft-adapter:solana:create`. The exact proposed command is:

```bash
SAN_SOLANA_MINT=GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump \
pnpm hardhat lz:oft-adapter:solana:create \
  --eid 30168 \
  --program-id 9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD \
  --mint GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump \
  --token-program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
```

**Do not execute this command in Phase 3.** The public program ID was generated locally with Anchor and is not deployed. The task is guarded to reject a missing or different `SAN_SOLANA_MINT`, a different mint argument, a non-mainnet EID, and an unsupported token program before it derives signing state or constructs a transaction.

The installed SDK passes LayerZero's default shared decimals (`6`) to `initOft`; this adapter task does not expose a shared-decimals flag.

## Accounts the command would create

The command submits one `initOft` transaction. If authorized in a later phase, it would create:

1. **Escrow token account** — a newly generated token account for the canonical SAN mint. It is owned by the legacy SPL Token program. Its token authority is the OFT Store PDA. It is a new signer-backed account, not an associated token account and not a PDA.
2. **OFT Store PDA** — a program-owned account derived from `['OFT', escrow public key]` under `<VERIFIED_OFT_PROGRAM_ID>`. It stores adapter type, mint, escrow, decimal conversion rate, TVL, admin, pause configuration, and default fee configuration. It signs token operations through program-derived seeds.
3. **LzReceiveTypesAccounts PDA** — derived from `['LzReceiveTypes', OFT Store PDA]` under the OFT program. It records the OFT Store and canonical mint used to resolve receive accounts.
4. **LayerZero Endpoint OApp registry PDA** — created by the EndpointV2 `register_oapp` CPI for the OFT Store. The task sets its delegate to the adapter admin.

The canonical mint, legacy token program, system program, EndpointV2 program, and OFT program are existing accounts and are not created.

**Peer configuration accounts are not created by this command.** Each peer PDA is created later by `set_peer_config`/wiring for a specific remote EID. Wiring is explicitly outside Phase 2.

## Authorities and control of escrow

- The OFT Store PDA is the direct SPL token authority over the escrow account.
- The OFT program is the only entity capable of producing the OFT Store PDA signature, subject to the deployed program code.
- The adapter admin can configure peers, fees, pause roles, and other OFT settings. The current task sets admin to the transaction payer.
- The Endpoint OApp delegate can configure LayerZero message libraries and security settings for the OApp. The current task registers the same admin as delegate.
- The OFT program's Solana upgrade authority can change program behavior and therefore has indirect power over escrow. It must be a reviewed production multisig or be otherwise constrained according to the approved upgrade policy.
- Endpoint, peer, DVN, Executor, and message-library security determine which inbound messages can cause releases.

The current adapter task has no `--admin` or multisig parameter and would initially assign admin/delegate to its payer. That governance bootstrap must be reviewed before Phase 3; no private key or operator has been selected in Phase 2.

## Capability assessment and conditions

Under the inspected code and `Adapter` mode:

- **Mint original SAN:** No. The adapter transfers SAN and never receives mint authority. The canonical mint authority is already revoked.
- **Alter original SAN supply:** No through the adapter path. Adapter sends and receives transfer existing SAN; they do not mint or burn it.
- **Change mint or freeze authority:** No. Adapter initialization contains no authority-change instruction; both authorities are already revoked.
- **Access holder wallets:** No arbitrary access. A holder must sign the adapter `send`, and the source token account must have that signer as its token authority.
- **Arbitrarily withdraw escrowed SAN:** Not through the current program's direct admin functions. `withdraw_fee` can transfer only the balance above recorded adapter TVL. Backing TVL is released by authenticated inbound messages.

The last statement is conditional on program integrity and governance. A compromised/malicious OFT upgrade authority could replace the program. A compromised admin could set a malicious peer or fee policy, and a compromised Endpoint delegate/security stack could permit fraudulent messages that release escrow. These are not mint-authority risks, but they are custody risks and must be resolved through multisig governance, peer verification, security-stack review, rate limits, and program verification before any SAN is deposited.
