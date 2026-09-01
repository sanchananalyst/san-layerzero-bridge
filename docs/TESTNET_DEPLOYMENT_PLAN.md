# Solana Devnet ↔ Robinhood Testnet Plan

## Scope and hard stop

This is a preparation document only. Phase 3.6 creates no token, OFT Store, escrow, adapter, EVM deployment, peer, library configuration, or LayerZero message. It submits no transaction.

The test asset must be a **new** legacy SPL token named `SAN Bridge Test Token`, symbol `tSAN`, with 6 decimals. It is not SAN and must never use canonical SAN mint `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`. The test mint is intentionally absent from committed configuration. `pnpm san:testnet:prepare-asset` fails until an explicit valid non-canonical public mint is supplied, and remains non-executing even then.

## Re-resolved official metadata

Values were re-resolved on 2026-09-01 from the installed LayerZero definitions/metadata and checked read-only against the networks. Address case is cosmetic on EVM.

| Setting            | Solana Devnet                                  | Robinhood Chain Testnet                      |
| ------------------ | ---------------------------------------------- | -------------------------------------------- |
| Chain/cluster      | devnet                                         | chain ID `46630`                             |
| LayerZero EID      | `40168`                                        | `40451`                                      |
| Endpoint V2        | `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6` | `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32` |
| Send library       | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH` | `0x45841dD1Ca50265Da7614fC43A361e526C0E6160` |
| Receive library    | same ULN program                               | `0xD682ECF100f6F4284138aA925348633B0611Ae21` |
| Executor           | `AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK` | `0x701f3927871eFCEa1235Db722F9e608Ae120D243` |
| LayerZero Labs DVN | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` | `0xA78A78A13074ED93ad447a26eC57121f29E8FEc2` |

The current supported defaults for this path are:

- Solana send / Robinhood receive: one required LayerZero Labs DVN, no optional DVNs, threshold 0, 10 confirmations, max message size 10,000.
- Robinhood send / Solana receive: one required LayerZero Labs DVN, no optional DVNs, threshold 0, 1 confirmation, max message size 10,000.

Paxos is common to both testnets (`4HxX...` on Solana and `0x771d...` on Robinhood), but is not in the supported default pathway and is not automatically added. Production's future DVN policy is not copied into testnet.

## Enforced options

Enforced options are OApp configuration, not chain metadata. A conservative review candidate is message type 1, `lzReceive` gas/compute value `200,000`, destination native value `0`. This is **not approved or wired**. Before any testnet transaction, profile both destinations with the emergency-control code and confirm:

- sufficient EVM gas for inbound bucket settlement plus OFT mint;
- sufficient Solana compute for OFT Adapter receive;
- recipient ATA existence handling. LayerZero recommends per-send extra value when a Solana ATA must be created rather than always enforcing rent value.

## Future, separately authorized sequence

1. Create a new legacy SPL mint on Solana Devnet with decimals 6 and no initial supply.
2. Create Metaplex metadata with the exact test-only name and symbol; visibly label explorers and records as testnet.
3. Independently inspect the mint, token program, authorities, supply, and metadata.
4. Record its address as `TESTNET_SOLANA_MINT`; run the policy tests and non-executing preparer.
5. Deploy the approved OFT program to Devnet and create an Adapter/OFT Store and escrow for **tSAN only**.
6. Deploy a test `SanOFT` instance to Robinhood Testnet.
7. Review actual peer addresses and profiled enforced options, then prepare a separate wiring approval.
8. Run small, bounded two-way integration tests and reconcile escrow, EVM supply, and in-flight messages.

Steps 1–8 are out of scope now. No command in this repository currently performs them automatically.

## Structural isolation

`config/mainnet.ts` owns canonical SAN and mainnet identities. `config/testnet.ts` contains only testnet metadata and has no mint default. `scripts/testnetPolicy.ts` rejects canonical SAN, malformed/missing test mints, mainnet EIDs, and mainnet Robinhood chain ID. `layerzero.config.ts` remains the unwired mainnet graph and does not import the testnet module.
