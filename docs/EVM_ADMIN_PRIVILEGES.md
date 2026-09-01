# SanOFT EVM Administrator Privileges

The intended production owner is the SAN Safe multisig. There is one owner role and no minter, pauser-only, rate-limiter-only, upgrader, or custom verifier role. `SanOFT` is non-upgradeable.

| Function                                       | Source                            | Owner capability / security effect                                                                                                       |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `transferOwnership(address)`                   | OpenZeppelin `Ownable`            | Transfers every owner power. Operational procedure must verify the Safe before handoff.                                                  |
| `renounceOwnership()`                          | `SanOFT` override                 | Disabled: always reverts, preventing permanent loss of emergency/configuration control.                                                  |
| `setPeer(uint32,bytes32)`                      | LayerZero `OAppCore`              | Selects the authenticated remote OApp per EID. A wrong peer can stop or redirect future pathway semantics; it cannot directly call mint. |
| `setDelegate(address)`                         | LayerZero `OAppCore`              | Changes the Endpoint delegate authorized to configure message libraries/DVNs.                                                            |
| `setEnforcedOptions(EnforcedOptionParam[])`    | LayerZero `OAppOptionsType3`      | Sets mandatory Executor options per pathway/message type. Bad gas can make delivery fail until corrected/retried.                        |
| `setMsgInspector(address)`                     | LayerZero `OFTCore`               | Installs/removes an outbound message/options inspector. A bad inspector can block sends.                                                 |
| `setPreCrime(address)`                         | LayerZero `OAppPreCrimeSimulator` | Selects the pre-crime simulation contract; does not authenticate or credit a receive.                                                    |
| `pause()` / `unpause()`                        | `SanOFT`                          | Stops/restores cross-chain debit and credit only. Ordinary ERC-20 transfers remain live.                                                 |
| `setOutboundRateLimit(uint256,uint256,uint64)` | `SanOFT`                          | Changes outbound capacity, refill amount, and window subject to validation/no-capacity-gift policy.                                      |
| `setInboundRateLimit(uint256,uint256,uint64)`  | `SanOFT`                          | Changes inbound capacity, refill amount, and window under the same policy.                                                               |

Endpoint library/DVN configuration itself is controlled through the Endpoint by its delegate. `setDelegate` is the OApp owner entry point that changes that authority.

There is no externally callable `mint`, `ownerMint`, `adminMint`, `bridgeMint`, `emergencyMint`, arbitrary `_credit` wrapper, arbitrary burn, or custom receive verifier. Owner functions cannot increase `totalSupply`. Minting remains reachable only after the installed Endpoint and peer checks invoke the standard OFT credit path.
