# SAN Bridge Pre-Deployment Checklist

Every item requires recorded evidence and human approval. Phase 3.6 does not authorize checking any deployment/wiring item merely because a proposed value is documented.

## Solana

- [ ] Canonical SAN mint re-verified as `GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump`
- [ ] SAN decimals re-verified as `6`
- [ ] Mint authority re-verified revoked
- [ ] Freeze authority re-verified revoked
- [ ] Legacy SPL Token program re-verified as `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- [ ] SAN OFT program ID verified as `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`
- [ ] Program built with explicit `OFT_ID=9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`
- [ ] Program source, dependency revisions, declared ID, reproducible bytecode, and deployed bytecode verified
- [ ] Docker-verifiable `oft.so` produced on a healthy Docker host; Phase 3.6 host failed before compilation because Docker storage became read-only
- [ ] Docker ELF SHA-256, `solana-verify` executable hash, and program-ID embedding recorded and independently reproduced
- [x] Current non-Docker ELF recorded: SHA-256 `4f45291eb36debe54675fbe5427a86ecfad09ab0f6e08118802662af84091b15`; local `solana-verify` executable hash `531b13c26c54f372a412b5b9c06a2d162c81a7a0a7488eefc32b4a0788de01af`
- [ ] Program upgrade authority and governance policy known
- [ ] OFT Store PDA independently derived and verified
- [ ] Escrow address independently derived/recorded and canonical SAN mint verified
- [ ] OFT Store initialized as `Adapter`, never `Native`
- [ ] OFT Store `ld2sd_rate == 1` and `tvl_ld == 0` before deposits
- [ ] OFT Store admin handoff planned and proposal calldata reviewed
- [ ] LayerZero Endpoint delegate handoff planned and proposal calldata reviewed
- [ ] Program upgrade-authority handoff planned and proposal calldata reviewed
- [ ] Native pauser/unpauser assignments approved
- [ ] Native inbound/outbound rate-limit values approved from a maximum-loss budget

## Robinhood

- [ ] Chain ID re-verified as `4663`
- [ ] LayerZero EID re-verified as `30416`
- [ ] EndpointV2 re-verified as `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`
- [ ] `SanOFT` source, compiler settings, constructor arguments, reproducible bytecode, and deployed bytecode verified
- [ ] `SanOFT.decimals() == 6`
- [ ] `SanOFT.sharedDecimals() == 6` and `decimalConversionRate() == 1`
- [ ] SanOFT owner Safe selected; owners, threshold, modules, guards, and fallback handler reviewed
- [ ] LayerZero delegate Safe selected and matches the approved Safe
- [x] EVM bridge-only pause and independent inbound/outbound canary rate-limit implementation tested locally
- [ ] EVM emergency settings, Safe policy, monitoring, and deployment bytecode independently reviewed

## LayerZero

- [ ] Solana and Robinhood peer bytes independently derived and verified both ways
- [ ] All selected DVNs currently active on both chains
- [ ] No default sentinel or Dead DVN in any resolved config
- [ ] Two-of-three threshold semantics and sorted address encoding verified
- [ ] `32/32` confirmation proposal reviewed against current Solana and Robinhood finality behavior
- [ ] Solana send and receive libraries explicitly pinned and verified
- [ ] Robinhood SendUln302 and ReceiveUln302 explicitly pinned and verified
- [ ] Solana Executor worker PDA explicitly pinned and verified
- [ ] Robinhood Executor explicitly pinned and verified
- [ ] Standard-send enforced options reviewed and destination execution profiled
- [ ] Solana missing-ATA dynamic rent handling tested without a static overpayment
- [ ] Compose support disabled by launch policy or separately audited/configured
- [ ] All four custom ULN configs read back and compared with the approved matrix
- [ ] Manual delivery/retry path tested

## Security and operations

- [ ] Escrow invariant runtime tests passing
- [ ] Unauthorized, wrong-peer, malformed, replayed, and over-TVL receives fail in runtime tests
- [ ] `withdraw_fee` source and runtime behavior independently reviewed
- [ ] Full Hardhat compile/tests passing on a pinned supported Node version (tests pass locally, but Node `23.11.0` is outside Hardhat's supported range)
- [ ] Full Foundry build/tests passing on the pinned toolchain
- [ ] Full Anchor build/tests passing with actual local-validator integration coverage
- [ ] TypeScript, ESLint, Prettier, and Solhint checks passing
- [ ] No `*-keypair.json`, mnemonic, private key, or production secret tracked or staged
- [x] Tracked starter `junk-id.json` removed; local runtime wallet is ignored and test-only
- [ ] No deployer retains OFT Store admin
- [ ] No deployer retains Solana Endpoint delegate
- [ ] No deployer retains program upgrade authority
- [ ] No deployer retains `SanOFT` ownership
- [ ] No deployer retains Robinhood Endpoint delegate
- [ ] Multisig/Safe governance drills and signer recovery completed
- [ ] Monitoring covers escrow, TVL, remote supply, peers, libraries, DVNs, Executors, authorities, pause/rate limits, and upgrades
- [ ] Tiny mainnet canary amount and loss limit explicitly approved
- [ ] Rollback, pause, retry, incident communications, and emergency governance procedure documented and rehearsed
- [ ] Independent smart-contract/Solana/security review complete
- [ ] Human Phase 4 go/no-go approval recorded

## Testnet-only gate

- [x] Mainnet and testnet identities structurally separated in code
- [x] Testnet policy rejects canonical SAN mint and all mainnet EID/chain identities
- [ ] New legacy SPL `SAN Bridge Test Token` (`tSAN`, 6 decimals) created and inspected on Devnet in an explicitly authorized later phase
- [ ] Solana Devnet and Robinhood Testnet deployment addresses recorded independently
- [ ] Destination execution gas/compute profiled; enforced options reviewed rather than copied from examples
- [ ] Testnet peers, supported default DVN pathway, libraries, Executor, confirmations, and max message size re-resolved immediately before wiring
