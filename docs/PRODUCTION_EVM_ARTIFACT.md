# Production EVM Artifact

> **Superseded by Phase 5A.2:** the hashes below describe the pre-fail-closed
> constructor and are retained only as historical evidence. Adding the default
> `_pause()` changes creation and runtime bytecode. New reproducible hashes and
> independent review are required before deployment.

## Build identity

The production contract is non-upgradeable `SanOFT`, configured at deployment
as name `San Chan`, symbol `SAN`, decimals `6`, initial supply `0`. The constructor
accepts the current LayerZero Endpoint and the approved Safe as delegate/owner.

| Field                         | Value                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Compiler                      | solc `0.8.22`                                                                      |
| EVM target                    | `paris`                                                                            |
| Optimizer                     | enabled, `200` runs                                                                |
| Metadata                      | literal source content enabled                                                     |
| Creation bytecode size/hash   | `16324` bytes / `6769923ed725590f7a28f05f3e75d5c7bf47aa62c7feef99eff47812f6a5c06d` |
| Runtime bytecode size/hash    | `14498` bytes / `97997ac5162118757e4f311db039d4df9999030a1ff02031ea859a9915ffa690` |
| Canonical compact ABI SHA-256 | `ee20f8f68924c41c3a269b69c29ab8214c0e7cbb7cdd29789c2f47ea718e9da3`                 |
| Hardhat artifact SHA-256      | `aeb9517c3702fac4ae71d6296e54bfb3cecb53b1cdb4d8be623c87805cd2e812`                 |

## Security properties verified

- no proxy or upgrade function is introduced;
- no public/external `mint`, `ownerMint`, `adminMint`, or alternative credit ABI;
- standard LayerZero Endpoint and peer authentication remain inherited;
- outbound sends burn and authenticated inbound receives credit through the
  standard OFT path;
- bridge pause blocks quotes/debit/credit but ordinary ERC-20 transfers remain
  live;
- independent inbound and outbound token buckets are owner-configurable;
- ownership renunciation is disabled; and
- the canary bucket is `500,000 SAN`, not the superseded 100k value.

The pre-patch Hardhat (21 tests) and Foundry (16 tests) results below are
historical. The Phase 5A.2 validation report records the patched suite. These
tests cover constructor identity,
authentication, burn/credit, pause behavior, limiter boundaries/refill/rollback,
owner authorization, disabled renunciation, malformed messages, and absence of
an arbitrary emergency mint path.
