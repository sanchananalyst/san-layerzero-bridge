# Production Audit Scope

## Immutable code boundary

Audit production code commit
`d28762288bb5180ff292f57eef7132191f2037ec`. This is the squash merge of
[security PR #2](https://github.com/sanchananalyst/san-layerzero-bridge/pull/2)
and supersedes `a53a86bcc0a18934a19f2889ba61ceb1633fa359`. The target changed
because the previous code initialized the Solana Store unpaused and did not
contain the both-chain fail-closed activation patch or its checker/regressions.

The later `Update audit target after fail-closed activation fix` commit is
documentation-only and does not change this production-code boundary. Any later
production-code, dependency-resolution, or compiler/build-setting change
creates a new bridge-code audit target. Phase 5A.4 policy/checker changes are a
separate review target and do not modify production bridge bytecode.

## Production source and dependency boundary

Review every line of:

- `contracts/SanOFT.sol`
- `programs/oft/Cargo.toml`, `programs/oft/Xargo.toml`,
  `programs/oft/build.rs`
- `programs/oft/src/lib.rs`, `compose_msg_codec.rs`, `msg_codec.rs`, `errors.rs`,
  `events.rs`
- `programs/oft/src/state/mod.rs`, `oft.rs`, `peer_config.rs`
- `programs/oft/src/instructions/mod.rs`, `init_oft.rs`, `send.rs`,
  `quote_oft.rs`, `quote_send.rs`, `lz_receive.rs`, `lz_receive_types.rs`,
  `set_oft_config.rs`, `set_peer_config.rs`, `set_pause.rs`, `withdraw_fee.rs`
- `Cargo.toml`, `Cargo.lock`, `Anchor.toml`, `package.json`, `pnpm-lock.yaml`,
  `hardhat.config.ts`, `foundry.toml`, `tsconfig.json`, `layerzero.config.ts`
- the pinned Solana `oapp-latest`/`utils-latest` dependency at LayerZero-v2
  revision `c09287a`, EVM `@layerzerolabs/oft-evm` 4.0.1,
  `@layerzerolabs/oapp-evm` 0.4.1, and OpenZeppelin Contracts 5.6.1 insofar as
  their inherited behavior defines authentication, debit/burn, credit/mint,
  replay clearing, ownership, and pause semantics.

## Production configuration and tooling

- `config/mainnet.ts`
- `deploy/SanOFT.ts`
- `scripts/checkLayerZeroConfig.ts`, `checkProductionMainnet.ts`,
  `inFlightInventory.ts`, `scanProductionInFlight.ts`,
  `solanaCommonContext.ts`, `checkSolanaProgramId.ts`,
  `productionStoreBindings.ts`, `inspectSanMint.ts`, `sanMintConfig.ts`, `layerZeroConfigPolicy.ts`,
  `productionMainnetPolicy.ts`, `productionRateLimitPolicy.ts`,
  `productionToolingPolicy.ts`
- `tasks/index.ts`, `tasks/common/config.get.ts`, `tasks/common/types.ts`,
  `tasks/common/utils.ts`, `tasks/common/wire.ts`, `tasks/common/sendOFT.ts`
- `tasks/evm/sendEvm.ts`
- `tasks/solana/index.ts`, `utils.ts`, `multisig.ts`, `createOFT.ts`,
  `createOFTAdapter.ts`, `initConfig.ts`, `sendSolana.ts`, `retryMessage.ts`,
  `setAuthority.ts`, `setUpdateAuthority.ts`, `updateMetadata.ts`, `debug.ts`,
  `getPrioFees.ts`, `getRateLimits.ts`, `setInboundRateLimit.ts`, and
  `setOutboundRateLimit.ts`
- `tasks/solana/endpoint/endpointUtils.ts`, `skip.ts`, `burn.ts`, `clear.ts`, and
  `nilify.ts`, including these currently unregistered mutation/recovery
  implementations because any future registration is a security boundary.

Exclude Aptos and testnet policy from the production behavior audit, but verify
that their IDs/RPCs cannot cross into the production registry or policy.

## Required tests and evidence

- `test/foundry/SanOFT.t.sol`
- `test/hardhat/SanOFT.test.ts`, `SanOFTActivation.test.ts`,
  `SanOFTEmergency.test.ts`
- `test/anchor/oftAdapter.runtime.test.ts`
- `test/scripts/inspectSanMint.script.test.ts`,
  `checkProductionMainnet.script.test.ts`,
  `layerZeroConfigPolicy.script.test.ts`,
  `oftEscrowSecurity.script.test.ts`,
  `productionMainnetPolicy.script.test.ts`,
  `productionRateLimitPolicy.script.test.ts`,
  `productionToolingPolicy.script.test.ts`, and
  `testnetPolicy.script.test.ts`, `checkProductionStoreBindings.script.test.ts`,
  and `solanaCommonContext.script.test.ts`
- `contracts/mocks/OFTTestPeer.sol`, `test/mocks/ERC20Mock.sol`,
  `test/mocks/OFTComposerMock.sol` only as test isolation/support
- `docs/ARCHITECTURE.md`, `ESCROW_SECURITY_REVIEW.md`,
  `PARTIAL_CONFIGURATION_SECURITY.md`, `PRODUCTION_ACTIVATION_CHECKER.md`,
  `PRODUCTION_SECURITY_REVIEW.md`, `FINAL_RATE_LIMIT_ANALYSIS.md`,
  `PRODUCTION_RATE_LIMIT_POLICY.md`, `PRODUCTION_CONFIGURATION.md`,
  `ROBINHOOD_FINALITY_EVIDENCE.md`, `ROBINHOOD_FINALITY_POLICY.md`, `PRODUCTION_GOVERNANCE.md`,
  `AUTHORITY_HANDOFF.md`, and all three mainnet runbooks/checklist.

Verify source-to-artifact equivalence against the hashes in
`PRODUCTION_EVM_ARTIFACT.md`, `PRODUCTION_VERIFIABLE_BUILD.md`, and
`REPRODUCIBLE_BUILD_EVIDENCE.md`. The Phase 5A.3 Solana reproducibility gate
passes; its hashes still require independent approval and later
deployed-bytecode equivalence. All hashes recorded before the initialize-paused
patch are superseded and must not be used to approve deployment.

## Review objectives

Prove no unbacked mint or escrow drain; exact Endpoint/peer/replay semantics;
six-decimal/no-dust accounting; limiter/pause atomicity and omission handling;
governance and upgrade powers; no testnet/wrong-chain execution; no unsafe retry
or partial wiring; no key disclosure; and fail-closed behavior for every absent
production identity or approval. Explicitly verify that both applications start
paused, every partial wiring state remains inert, interrupted activation is
recoverable by re-pausing, and public activation is permissionless rather than
an exclusive operator canary.

Phase 5A.3 implements remediations for the two prior evidence findings: all
critical Solana accounts are decoded from one finalized-context batch, and a
dual-RPC range-complete in-flight scanner emits a source-commit-bound schema-v2
manifest. Review these tooling changes as a separate diff target; they do not
change the immutable bridge code target. Docker reproducibility passes; live
pre-deployment evidence, independent hash approval, external audit, and
independent acceptance of Robinhood source-depth limitations still block Phase
5B.

Phase 5A.4 freezes 32 Solana-source and 30 Robinhood-source confirmations and
four rate tiers. Review the activation-race fix, reproducible build, testnet
round trip, current metadata refresh, Solana full-bucket capacity reset, and the
checker trust-root/genesis/packet-destination hardening together with the frozen
bridge target.
