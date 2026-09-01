# Testnet-to-Production Review

## Scope and method

Phase 5A compared `production/phase5a` at
`a5aae4d024d818761cc4bbb40308ba29dbf1cfa0` with `testnet/phase4a` at
`759e57fd41f386099dcd116d21ae945bdff3fd5a`. Both branches descend from
`280c165be2328d1eb20d1d0926c6cff579ab795a`. The testnet branch was not merged.

Classification:

- **A** — production-safe generic improvement or operational lesson
- **B** — testnet-only tooling/configuration
- **C** — testnet identity/address change
- **D** — deployment artifact
- **E** — documentation/test-only change

## Complete path classification

| Path                                         | Class | Production disposition                                                                                                                                              |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                               | B     | Reject testnet deployer and tSAN variables from production execution. Keep production placeholders only.                                                            |
| `AGENTS.md`                                  | E     | Reject prior phase authorization; Phase 5A rules are independently committed.                                                                                       |
| `Anchor.toml`                                | C     | Reject Devnet program identity; retain `9myHz…TvcD`.                                                                                                                |
| `config/testnet.ts`                          | B/C   | Reject all tSAN and testnet addresses.                                                                                                                              |
| `config/testnetWiring.ts`                    | B     | Reject the executable testnet graph.                                                                                                                                |
| `deployments/phase4a-roundtrip-summary.json` | D     | Retain only as test evidence on the testnet branch.                                                                                                                 |
| `deployments/phase4a3-testnet-wiring.json`   | D     | Reject as production configuration.                                                                                                                                 |
| `deployments/phase4a4a-forward-canary.json`  | D     | Retain as measurement/evidence only.                                                                                                                                |
| `deployments/phase4a4b-return-canary.json`   | D     | Retain as measurement/evidence only.                                                                                                                                |
| `deployments/robinhood-testnet.json`         | D     | Reject every address and chain identity.                                                                                                                            |
| `deployments/solana-devnet.json`             | D     | Reject every address and cluster identity.                                                                                                                          |
| `deployments/solana-testnet/OFT.json`        | D     | Reject the Devnet deployment artifact.                                                                                                                              |
| `docs/TESTNET_EXECUTION_OPTIONS.md`          | E/A   | Port only measured receive-cost evidence and the conditional ATA-rent lesson.                                                                                       |
| `hardhat.config.ts`                          | B     | Reject testnet RPC, account loading, and Phase 4 confirmation gates. Production remains accountless in Phase 5A.                                                    |
| `layerzero.testnet.config.ts`                | B/C   | Reject the entire testnet graph and its identities.                                                                                                                 |
| `package.json`                               | B/C   | Reject Devnet program IDs and testnet execution commands. Retain production build/test commands.                                                                    |
| `programs/oft/src/lib.rs`                    | C     | Reject the tSAN `declare_id!`; retain production `9myHz…TvcD`.                                                                                                      |
| `scripts/assertSolanaDevnet.ts`              | B     | Reject Devnet-only genesis enforcement from production execution. Port the generic pre-sign genesis check requirement to runbooks.                                  |
| `scripts/checkTestnetKeySafety.ts`           | B/A   | Do not port test wallet paths. Port the `0600`, ignored, untracked key-material gate as an operational requirement.                                                 |
| `scripts/checkTestnetLayerZeroConfig.ts`     | B/A   | Reject identities. Port the complete post-operation read-back pattern.                                                                                              |
| `scripts/checkTestnetProgramId.ts`           | B/C   | Reject test program identity. Production already has `scripts/checkSolanaProgramId.ts`.                                                                             |
| `scripts/deployRobinhoodTestnet.ts`          | B/D   | Reject testnet deployment logic and wallet loading.                                                                                                                 |
| `scripts/inspectTestnetAdapter.ts`           | B/D   | Reject test deployment addresses. Port escrow/TVL/authority read-back requirements.                                                                                 |
| `scripts/phase4a4aForwardCanary.ts`          | B/A   | Reject executable testnet send logic. Port one-shot marker, exact-amount assertions, and no-resend policy to the future canary runbook.                             |
| `scripts/phase4a4bReturnCanary.ts`           | B/A   | Reject executable return logic. Port final pause and accounting reconciliation requirements.                                                                        |
| `scripts/previewTestnetWiring.ts`            | B/A   | Reject test identities. Port independent address derivation and preview-before-sign requirements.                                                                   |
| `scripts/testnetPolicy.ts`                   | B/C   | Reject testnet identities. Preserve structural mainnet/testnet isolation.                                                                                           |
| `scripts/testnetWiringLiveState.ts`          | B/A   | Reject test addresses. Port transaction-by-transaction read-back and Dead-DVN detection.                                                                            |
| `tasks/common/wire.ts`                       | B/A   | Do not port the Phase 4 signer wrapper. Port chain/EID/signer/target allowlists, one-transaction execution, and immediate read-back into future production tooling. |
| `tasks/solana/createOFTAdapter.ts`           | B     | Reject the Devnet branch. Production continues through canonical SAN validation only.                                                                               |
| `test/anchor/oftAdapter.runtime.test.ts`     | E/C/A | Reject tSAN identity. Retain custody tests and use the compute measurement as profiling evidence.                                                                   |
| `test/scripts/testnetPolicy.script.test.ts`  | E     | Keep testnet isolation coverage on the testnet branch; production policy has separate tests.                                                                        |
| `test/scripts/testnetWiring.script.test.ts`  | E/B   | Reject testnet graph fixtures; port fail-closed concepts into mainnet policy tests.                                                                                 |

## Production-safe lessons adopted

- All future mainnet transaction tooling must verify chain/genesis, EID, signer,
  target, calldata class, and expected state immediately before each signature.
- Execute and read back one administrative transaction at a time. A batch must
  stop after the first failed or ambiguous receipt.
- A send command must create an exclusive durable attempt marker before signing;
  pending, blocked, or failed messages are never automatically resent.
- Both supported Solana peer limiters must be explicitly configured and read
  back. The testnet absence of a Solana limiter is not an acceptable mainnet
  default.
- Phase 5A found that the inherited Solana outbound task ignored `dstEid` and
  hardcoded Sepolia testnet. Production now uses the caller-supplied EID,
  rethrows failures, and has a source regression guard. The inbound task also
  rethrows failures. Neither task was executed.
- A production policy helper now rejects a rate-limit plan unless Solana
  outbound, Solana inbound, Robinhood outbound, and Robinhood inbound are all
  present and nonzero; both EVM directions also require an explicit 86,400-second
  refill duration.
- Destination ATA existence and current rent must be queried per transfer.
- Use measured testnet execution as a lower-bound observation, not as a copied
  mainnet limit.
- Every wiring field and authority must be independently read back after any
  future transaction.

## Explicitly rejected identities and material

The following never enter production configuration or artifacts:

- tSAN mint `Hec7jHowvQnD1ZHYUt98mWfqh5VoBXdjciC2DQPHcja`
- Devnet OFT program `EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8`
- Devnet OFT Store `49DdSvei9Yo2ymJYDYgNTo8JqGha6HNynKxSXxqzggSv`
- Devnet escrow `H4cKFcGsYoU2X7LMmF8pSrbv9VUruFCfWiqwxMN8nStb`
- Robinhood Testnet SanOFT `0x9086b51FE070188fb16d80DfDEde36F1E0E4E1C9`
- Robinhood Testnet chain ID/EID `46630/40451`
- all testnet deployer addresses, wallet files, private keys, markers, and RPC
  credentials

The production identities remain canonical SAN
`GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump` and Solana OFT program
`9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`.
