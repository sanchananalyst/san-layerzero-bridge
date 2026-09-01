# Robinhood Testnet LayerZero Validation

## Conclusion

**Robinhood Testnet LayerZero pathway is officially usable.**

This is a read-only Phase 3.5 finding, not authorization to deploy or configure a testnet bridge.

## Installed-package evidence

The lockfile resolves `@layerzerolabs/lz-definitions` version `3.1.10`. Its installed distribution contains:

- `dist/index.d.ts:1562`: `ROBINHOOD_V2_TESTNET = 40451`
- `dist/index.cjs:1265`: the same enum value
- network key: `robinhood-testnet`
- environment/stage: `testnet`

The current official LayerZero metadata API associates that network with chain ID `46630`, EID `40451`, and EndpointV2 `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32`. The metadata marks the chain deployment `ACTIVE`; it is not marked experimental, deprecated, internal/staging, or stale.

## Read-only RPC verification

RPC: `https://rpc.testnet.chain.robinhood.com`

| Check                              | Result                                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| `eth_chainId`                      | `0xb626` = `46630`                                                   |
| Endpoint bytecode                  | present                                                              |
| Runtime bytecode size              | `24,005` bytes                                                       |
| Runtime bytecode Keccak-256        | `0xd80c03fcc5b6614fcaf0d68c257214a14131c03a47432f86c02930c83777478c` |
| `eid()`                            | `40451`                                                              |
| default send/receive libraries     | match current official metadata                                      |
| libraries registered with Endpoint | yes                                                                  |
| `isSupportedEid(40168)`            | `true` for Solana Devnet                                             |

The expected EndpointV2 read interface was present: EID, owner, library resolution/registration, delegate/config lookup, and supported-EID behavior were callable without state changes.

## Robinhood testnet components

| Component          | Address                                      |
| ------------------ | -------------------------------------------- |
| EndpointV2         | `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32` |
| SendUln302         | `0x45841dd1ca50265Da7614fC43A361e526c0e6160` |
| ReceiveUln302      | `0xd682ECF100f6F4284138AA925348633B0611Ae21` |
| Executor           | `0x701f3927871EfcEa1235dB722f9E608aE120d243` |
| LayerZero Labs DVN | `0xA78A78A13074eD93aD447a26Ec57121f29E8FEc2` |
| Nethermind DVN     | `0xCde82f74624525e24853B1f59C8B20a162A3d297` |
| Horizen DVN        | `0x52F615eCbCbF40E47A315C2D84D14fa2851e55b7` |

The metadata also contains a deprecated Dead DVN identity. It is not part of the observed Robinhood-testnet default path and must never be selected for SAN.

## Solana Devnet pathway check

Solana Devnet uses LayerZero EID `40168`. Read-only Endpoint/ULN SDK queries for remote EID `40451` found compatible ULN302 message libraries on both ends and mutually compatible confirmation requirements:

| Direction                         | Source send | Destination receive | Common required DVN | Executor                |
| --------------------------------- | ----------: | ------------------: | ------------------- | ----------------------- |
| Solana Devnet → Robinhood testnet |        `10` |                `10` | LayerZero Labs      | configured on Solana    |
| Robinhood testnet → Solana Devnet |         `1` |                 `1` | LayerZero Labs      | configured on Robinhood |

LayerZero Labs is present on both ends. Paxos is also represented on both networks' official testnet metadata; Nethermind and Horizen are present on Robinhood testnet but were not present in the current Solana Devnet metadata, so they must not be assumed usable for that test pathway. A supported pathway therefore exists, but the observed defaults have only one required DVN and are not a production-security template.

Re-resolve all values immediately before any separately authorized testnet work because LayerZero metadata and defaults can change.
