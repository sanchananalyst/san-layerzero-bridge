# Intended Production Configuration

## Status and metadata refresh

This is an inert Phase 5A.4 policy record, not deployed state and not authority
to transact. A read-only refresh of LayerZero's official metadata endpoint was
performed at `2026-09-03T16:03:29Z`–`16:03:32Z`. It found **no drift** in the
selected EIDs, Endpoint, ULN302 libraries, Executors, selected DVNs, or
deprecated Dead DVN relative to `LAYERZERO_MAINNET_CONFIG.md`. Addresses must be
resolved again immediately before any separately authorized execution; drift
must be flagged and independently reviewed, never silently adopted.

## Chain and LayerZero identities

| Component                         | Intended value                                 |
| --------------------------------- | ---------------------------------------------- |
| Solana EID                        | `30168`                                        |
| Solana EndpointV2                 | `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6` |
| Solana SendUln302 / ReceiveUln302 | `7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH` |
| Solana Executor program           | `6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn` |
| Solana Executor worker PDA        | `AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK` |
| Robinhood chain ID / EID          | `4663` / `30416`                               |
| Robinhood EndpointV2              | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`   |
| Robinhood SendUln302              | `0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7`   |
| Robinhood ReceiveUln302           | `0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043`   |
| Robinhood Executor worker         | `0x4208D6E27538189bB48E603D6123A94b8Abe0A0b`   |

The OApp configuration must explicitly select these libraries and Executors;
Endpoint defaults are forbidden. The current Robinhood default path includes a
deprecated Dead DVN and cannot be inherited.

## Security stack

Use optional DVNs with threshold **2-of-3**, zero required DVNs:

| Provider       | Solana identity                                | Robinhood identity                           |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| LayerZero Labs | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` | `0xd01ae6905d48315f7be10c7330aecf8360ef5b12` |
| Nethermind     | `GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab` | `0x0ffe02df012299a370d5dd69298a5826eacafdf8` |
| Horizen        | `HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX` | `0x1258a278519c7f4bd997a9c3bfd4aa802a028d89` |

Robinhood Dead DVN `0x6788f52439ACA6BFF597d3eeC2DC9a44B8FEE842`
is deprecated and forbidden. Any missing, added, reordered-with-semantic-change,
deprecated, inherited, or otherwise unexpected DVN state fails review.

## Path policy

- Solana-source confirmations: **32**.
- Robinhood-source confirmations: **30**, with the limitations in
  `ROBINHOOD_FINALITY_POLICY.md`.
- Standard-send enforced receive option on both destinations: gas/compute
  `200000`, native value `0`.
- Rate limits: one explicitly selected CANARY, EARLY PUBLIC, NORMAL, or MATURE
  profile from `PRODUCTION_RATE_LIMIT_POLICY.md`, identically applied to all
  four directions.
- Canonical Solana asset: mint
  `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`, official Adapter mode, production
  OFT program `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`.

The real OFT Store, escrow, Robinhood SanOFT, peers, and governance addresses do
not yet exist or are not approved. They remain blank and must never be guessed.

## Activation sequence

1. Deploy infrastructure paused and inert in a separately authorized phase.
2. Configure LayerZero and all security controls while paused.
3. Transfer every governance authority; remove bootstrap/deployer control.
4. Perform an independent complete read-back.
5. Require the production policy checker to pass.
6. Obtain explicit multisig approval for public canary activation.
7. Activate with the 500,000 SAN CANARY capacity in all four directions.
8. Observe messages, accounting, capacity, posting, finality signals, and pause readiness.
9. Move to 30M EARLY PUBLIC only through a separate governance-approved change.
10. Move to 50M NORMAL only when evidence supports it.

The 100M MATURE profile remains a later governance decision. Once publicly
unpaused, the bridge is permissionless: there is no exclusive operator-first
transfer mechanism, and any holder may race or consume available capacity.
