# EVM Emergency Controls Design

## Scope and exact dependencies

This Phase 3.6 design is pre-deployment. It applies only to cross-chain movement by Robinhood `SanOFT`; ordinary ERC-20 transfers remain available. No LayerZero package is modified and no custom message authentication is introduced.

Installed versions inspected directly:

| Package                   | Version |
| ------------------------- | ------- |
| `@layerzerolabs/oft-evm`  | `4.0.1` |
| `@layerzerolabs/oapp-evm` | `0.4.1` |
| `@openzeppelin/contracts` | `5.6.1` |

Inheritance is:

```text
SanOFT
├── OFT
│   ├── OFTCore
│   │   ├── OApp (OAppSender + OAppReceiver)
│   │   │   └── OAppCore (Ownable)
│   │   ├── OAppPreCrimeSimulator (Ownable)
│   │   └── OAppOptionsType3 (Ownable)
│   └── ERC20
└── Pausable
```

`SanOFT` remains constructor-deployed and non-upgradeable.

## Exact installed OFT flow

### Outbound

- `OFTCore.quoteOFT(SendParam calldata)` and `quoteSend(SendParam calldata,bool)` call:
  `function _debitView(uint256 _amountLD,uint256 _minAmountLD,uint32 _dstEid) internal view virtual returns (uint256,uint256)`.
- `OFTCore.send(SendParam calldata,MessagingFee calldata,address)` calls internal `_send`, which calls:
  `function _debit(address _from,uint256 _amountLD,uint256 _minAmountLD,uint32 _dstEid) internal virtual returns (uint256,uint256)`.
- `OFT._debit` calls `_debitView`, then OpenZeppelin ERC-20 `_burn(_from, amountSentLD)`.
- `_send` subsequently calls LayerZero `_lzSend`. A later Endpoint failure reverts the complete transaction, including burn and bucket state.

### Inbound and authentication

- `OAppReceiver.lzReceive(Origin calldata,bytes32,bytes calldata,address,bytes calldata)` first requires `msg.sender == endpoint`, then requires `origin.sender == peers[origin.srcEid]`.
- Only after those checks does it call `OFTCore._lzReceive`.
- `_lzReceive` decodes the standard OFT message and calls:
  `function _credit(address _to,uint256 _amountLD,uint32 _srcEid) internal virtual returns (uint256)`.
- `OFT._credit` uses OpenZeppelin ERC-20 `_mint` and has no external/public mint wrapper.

The production contract does **not** override `lzReceive`, `_lzReceive`, peer lookup, message decoding, `_mint`, `_burn`, `_update`, or any Endpoint function.

## Overrides

Only these installed hooks are overridden:

1. `_debitView(...)`: require bridge-not-paused, obtain the exact dust/slippage-adjusted amount from `super`, and fail if current outbound availability is insufficient. This makes both quote paths fail fast without consuming capacity.
2. `_debit(...)`: call standard OFT debit/burn, then consume the returned `amountReceivedLD` from the outbound bucket. Any subsequent failure reverts both burn and bucket accounting.
3. `_credit(...)`: require bridge-not-paused and consume inbound capacity for `_amountLD` before calling standard OFT mint. Any mint or later receive failure reverts bucket accounting.

Rate limiting uses actual local-denomination amounts. SAN local and shared decimals are both six, so `decimalConversionRate == 1` and there is no bridge dust.

## Bucket policy

Each direction has an independent on-chain token bucket. Initial values are:

```text
capacity      = 100,000 * 10^6 raw units
refill amount = 100,000 * 10^6 raw units
refill window = 24 hours
```

Refill uses `block.timestamp`, OpenZeppelin `Math.mulDiv`, and an explicit fractional remainder. Availability is capped at capacity after arbitrarily long elapsed time. Configuration rejects zero values, refill amounts above capacity, and capacity above LayerZero's six-shared-decimal `uint64` maximum.

Before a configuration change, the old bucket is settled. New availability is `min(old available, new capacity)`: lowering capacity clamps immediately; raising capacity does not grant an instantaneous burst. A new rate/window resets only the fractional remainder, not available tokens.

Only the existing OFT owner can pause, unpause, or configure either bucket. Configuration and OpenZeppelin pause transitions emit explicit events.

## Failed receive and retry

Installed `EndpointV2.lzReceive` calls `_clearPayload` and then the OApp in one EVM transaction. If `SanOFT` reverts because it is paused or inbound capacity is unavailable, transaction atomicity rolls back both payload clearing and all OApp state. `PacketDelivered` is not emitted, no SAN is minted, and the already-verified payload remains available for a later executor/manual retry after unpause or refill.

The test suite proves this using LayerZero's actual Foundry EndpointV2/test-helper delivery queue: failed delivery leaves the packet queued and a later delivery succeeds exactly once.
