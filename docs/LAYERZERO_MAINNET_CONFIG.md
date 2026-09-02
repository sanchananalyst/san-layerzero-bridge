# LayerZero V2 Mainnet Metadata for SAN

## Verification record

All values below were resolved read-only on `2026-09-01T09:39:17Z` from LayerZero's official metadata API (`https://metadata.layerzero-api.com/v1/metadata`), the installed LayerZero deployment/SDK packages, and the public chain RPCs. They were re-resolved from that official metadata API on `2026-09-03`; no material Endpoint, send/receive library, Executor, LayerZero/Nethermind/Horizen DVN, EID, or deprecated Dead-DVN drift was found for Solana or Robinhood. Relevant installed versions are:

- `@layerzerolabs/metadata-tools` `4.0.0`
- `@layerzerolabs/lz-definitions` `3.1.10`
- `@layerzerolabs/lz-evm-sdk-v2` `3.1.10` (transitive)
- `@layerzerolabs/lz-solana-sdk-v2` `3.0.168`
- `@layerzerolabs/oft-v2-solana-sdk` `3.0.168`
- `@layerzerolabs/lz-evm-messagelib-v2` `3.0.168`

Addresses are current observations, not authorization to configure or deploy. They must be re-resolved immediately before Phase 4 because LayerZero metadata and defaults can change.

## Robinhood Chain mainnet

| Component               | Address/value                                | Source                                                                       |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| Chain ID                | `4663`                                       | Robinhood public RPC `eth_chainId`; official Robinhood network documentation |
| LayerZero EID           | `30416`                                      | official metadata and `lz-definitions`                                       |
| EndpointV2              | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` | official metadata; RPC `eid()` returned `30416`                              |
| SendUln302              | `0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7` | official metadata `sendUln302`                                               |
| ReceiveUln302           | `0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043` | official metadata `receiveUln302`                                            |
| Executor worker         | `0x4208D6E27538189bB48E603D6123A94b8Abe0A0b` | official metadata `executor`                                                 |
| LzExecutor contract     | `0x41Bdb4aa4A63a5b2Efc531858d3118392B1A1C3d` | official metadata `lzExecutor`                                               |
| Blocked message library | `0xc1ce56b2099ca68720592583c7984cab4b6d7e7a` | official metadata                                                            |
| Deprecated Dead DVN     | `0x6788f52439ACA6BFF597d3eeC2DC9a44B8FEE842` | official metadata, marked `deprecated: true`                                 |

Read-only calls to EndpointV2 for remote EID `30168` resolved the current default send library to SendUln302 and default receive library to ReceiveUln302. Direct ULN queries for the zero-address/default OApp returned:

| Default             | Confirmations | DVNs                      | Executor config                           |
| ------------------- | ------------: | ------------------------- | ----------------------------------------- |
| Send to Solana      |           `5` | one required **Dead DVN** | max message `200`, Executor `0x4208…0A0b` |
| Receive from Solana |          `32` | one required **Dead DVN** | n/a                                       |

**Do not inherit these defaults.** A Dead DVN cannot attest, so delivery cannot complete. SAN must explicitly pin a live custom ULN/Executor configuration on both libraries.

### Robinhood mainnet DVNs in official metadata

| Provider       | Address                                      | Status                    |
| -------------- | -------------------------------------------- | ------------------------- |
| LayerZero Labs | `0xd01ae6905d48315f7be10c7330aecf8360ef5b12` | active                    |
| Nethermind     | `0x0ffe02df012299a370d5dd69298a5826eacafdf8` | active                    |
| Horizen        | `0x1258a278519c7f4bd997a9c3bfd4aa802a028d89` | active                    |
| BitGo          | `0xdde8de68deb0080572e252f855d0485e8bbde14c` | active                    |
| Paxos          | `0x2832b240200c13d02250ec39bd0c20c199757891` | active                    |
| Canary         | `0x8d77d35604a9f37f488e41d1d916b2a0088f82dd` | active                    |
| StablecoinX    | `0x786804435f1a9f583ca0cd7a4584ebbfcae35855` | active                    |
| Luganodes      | `0x72b1d44c7b0bbd597831fc1e70bbcfdb97e90f0b` | active                    |
| P2P            | `0x8ed0a851964604bb1b6b1a703f4c8234ee684d76` | active                    |
| Superform      | `0xa45caa85283f2d8153f6250686f6d0a16fad92da` | active                    |
| ApeDVN         | `0x43b4a08ec8dbbfdfb1c8d7d453a0c57ed75a9ac1` | active                    |
| Frax           | `0xc685167bc4546caf2d3f5263d199d17d3f732c4c` | active                    |
| LZDeadDVN      | `0x6788f52439aca6bff597d3eec2dc9a44b8fee842` | **deprecated; forbidden** |

## Solana mainnet

| Component                                                  | Address/value                                  | Source                                              |
| ---------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| LayerZero EID                                              | `30168`                                        | official metadata and `lz-definitions`              |
| EndpointV2 program                                         | `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6` | official metadata / Solana SDK deployment           |
| SendUln302 program                                         | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH` | official metadata / SDK deployment                  |
| ReceiveUln302 program                                      | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH` | official metadata / SDK deployment                  |
| ULN message-library PDA currently resolved for EID `30416` | `2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ` | official SDK plus finalized public RPC              |
| Executor program                                           | `6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn` | official metadata / SDK deployment                  |
| Executor worker PDA                                        | `AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK` | official metadata / SDK deployment                  |
| Generic DVN program                                        | `HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW` | official metadata                                   |
| Nethermind DVN program                                     | `4fs6aL12L18K5giDy9Dgxgrb3aNRYiuRV2a7JPPj3e7F` | installed official `dvn-nethermind.json` deployment |
| Pricefeed program                                          | `8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP` | official metadata                                   |
| Blocked message library                                    | `2XrYqmhBMPJgDsb4SVbjV1PnJBprurd5bzRCkHwiFCJB` | official metadata                                   |

The Endpoint program stores the OApp registry and per-path send/receive library choices. The ULN program stores DVN, confirmation, and Executor configurations. For remote EID `30416`, read-only SDK queries returned:

| Default                | Confirmations | Required DVNs               | Executor config                  |
| ---------------------- | ------------: | --------------------------- | -------------------------------- |
| Send to Robinhood      |          `20` | LayerZero Labs + Nethermind | max message `10000`; `Awrb…Y7xK` |
| Receive from Robinhood |          `28` | LayerZero Labs + Nethermind | n/a                              |

These defaults also cannot be used as a SAN pathway: Solana send `20` is below Robinhood receive `32`, Robinhood send `5` is below Solana receive `28`, and the Robinhood default DVN is dead. Explicit symmetric configuration is mandatory.

### Solana mainnet DVNs in official metadata

These addresses are the Solana DVN configuration/worker identities used in OApp ULN configuration, not interchangeable with the underlying DVN program IDs.

| Provider                               | Address                                        |
| -------------------------------------- | ---------------------------------------------- |
| Google                                 | `F7gu9kLcpn4bSTZn183mhn2RXUuMy7zckdxJZdUjuALw` |
| LayerZero Labs                         | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` |
| Nethermind                             | `GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab` |
| Horizen                                | `HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX` |
| P2P                                    | `29EKzmCscUg8mf4f5uskwMqvu2SXM8hKF1gWi1cCBoKT` |
| 01node                                 | `8sF9yQhUcHpEte29L2ofvd9TNCB9M57YeWHQpn3E46K7` |
| Luganodes                              | `41QAdzUraTcvk1P2B6fcs5nQ4EeEKEGnQy5EPpCQ5AdX` |
| P-OPS                                  | `CratyHhkQXbRAgck3sooXFYbBADsCtjoxhjVbPKAAhK2` |
| Paxos                                  | `4HxXbLv37XrivKukEbofybpHr7C8HUGJzd4B5T9USpGh` |
| Ondo Staging                           | `4npJTMgVbLn2jAiLGg7pNEBv4RjQ5HScjLeSQPZAdJdq` |
| Canary                                 | `7jMeX5mzXnSSKYd8DxBDP4xMnkNFZZZm5W28FWUTbwU3` |
| Ondo                                   | `D1A8NPP4S5RX5jFLprNQGytLFCrV9ZiaFykLmat4WGA7` |
| USDT0                                  | `JBt34GkVns6VSoP2dCPpViW28eqE4GNgKaoZPRP63wZs` |
| Nansen                                 | `Fn8yyjaLbqw9FZyyLaTkb8o8RWp3vztxNChtPxcV1cLV` |
| Mantle Bank                            | `GfG8FCkhxmkgXd2yZQbogUV669jX5t9RK87jL2bWBkKK` |
| Deutsche Telekom                       | `FxFxe8j7e2xgpP9bw8LUehmz7DoQXaNFadJMEUKwBcRs` |
| Frax                                   | `6YB63FDuyYLt5gnJeiVmYRE4c6tFid5SrBZzMLQFfexm` |
| Wyoming                                | `6bdMfqghzhFpMsbrfy6qiyXnGkYGcamn3WYxeKx8Muik` |
| Brale                                  | `4EsNicsBtbNE2ZQqB24DVjjqgKh1sWjSKNcdxEgD5d8b` |
| Worldpay                               | `SzcKuPbuMGwMqd9pWTRQDEyL3qZT8YJU4Q5DY9M2aee`  |
| Fidelity Center for Applied Technology | `AQGjhJcqEVZP5WHd3NhidpbL743eiTti2Mxgc6XZeKPV` |
| MantleCross                            | `AKPKvgSvx4XocG7rMBv3qycKpZWaSCE4gZUCaTZp3J5W` |
| B-Harvest                              | `F8tr3GMivioYFEvJAR2WW5CKjPtgMQtM5CEuSjjVkjWL` |
| FBTC New                               | `9VnAW2RcRbGUGKMCnbEpdS5miJoozcWJvVghDJQVX5ws` |
| Bridge                                 | `BhMKkFMTTS1DWgazTjUZBe2BYft2GwoEUqgBGAH7Bp3p` |
| FurtherFP                              | `EqkXVEeapm7JqrS1W3AGeN5ZwCRLDUHtr1XY9TuVr4rD` |
| StablecoinX                            | `5EfaXYCJKiVi3jcgeacmJXaQCHcQDWT3qMDGCt2bBPRt` |
| ApeDVN                                 | `H5d1R6zC2vYpa5a7Sjh1yFpFthDjkLTfgbrMhmXkfy6x` |

## Robinhood testnet

Official metadata **does support** LayerZero V2 on Robinhood testnet:

| Component     | Value                                        |
| ------------- | -------------------------------------------- |
| Chain ID      | `46630`                                      |
| LayerZero EID | `40451`                                      |
| EndpointV2    | `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32` |
| SendUln302    | `0x45841dd1ca50265Da7614fC43A361e526c0e6160` |
| ReceiveUln302 | `0xd682ECF100f6F4284138AA925348633B0611Ae21` |
| Executor      | `0x701f3927871EfcEa1235dB722f9E608aE120d243` |

Official testnet DVNs include LayerZero Labs, Nethermind, Horizen, and Paxos. The public RPC returned chain ID `46630` and Endpoint `eid()` returned `40451`. This finding does not authorize a testnet deployment in Phase 3.
