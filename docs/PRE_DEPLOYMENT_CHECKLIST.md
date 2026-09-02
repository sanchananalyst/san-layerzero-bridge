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
- [ ] Docker-verifiable `oft.so` produced on a healthy Docker host; Phase 5A.1 Docker client is present but the daemon is unavailable
- [ ] Docker ELF SHA-256, `solana-verify` executable hash, and program-ID embedding recorded and independently reproduced
- [ ] Patched Phase 5A.2 ELF and executable hashes recorded and independently reproduced; the Phase 5A.1 hashes are superseded
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
- [x] New OFT Stores initialize paused; partial peer/options/limiter states are covered by local runtime regression tests

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
- [x] New SanOFT deployments initialize paused and partial configuration remains inert until explicit unpause
- [ ] EVM emergency settings, Safe policy, monitoring, and deployment bytecode independently reviewed

## LayerZero

- [ ] Solana and Robinhood peer bytes independently derived and verified both ways
- [ ] All selected DVNs currently active on both chains
- [ ] No default sentinel or Dead DVN in any resolved config
- [ ] Two-of-three threshold semantics and sorted address encoding verified
- [ ] Solana-source `32` and a separately approved Robinhood-source confirmation/finality policy reviewed; missing Robinhood value fails closed
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

- [x] Escrow invariant runtime tests passing locally (8/8)
- [x] Unauthorized, wrong-peer, malformed/replayed, and over-TVL receives fail in local runtime tests
- [ ] `withdraw_fee` source and runtime behavior independently reviewed
- [x] Full Hardhat compile/tests passing on pinned Node `22.23.2` (23/23)
- [x] Full Foundry build/tests passing on the pinned toolchain (17/17)
- [x] Full Anchor build/tests passing with local-validator integration coverage (8/8)
- [x] TypeScript, ESLint, Prettier, and Solhint checks passing (20 non-blocking lint warnings, zero errors)
- [x] No `*-keypair.json`, mnemonic, private key, or production secret tracked or staged
- [x] Tracked starter `junk-id.json` removed; local runtime wallet is ignored and test-only
- [ ] No deployer retains OFT Store admin
- [ ] No deployer retains Solana Endpoint delegate
- [ ] No deployer retains program upgrade authority
- [ ] No deployer retains `SanOFT` ownership
- [ ] No deployer retains Robinhood Endpoint delegate
- [ ] Multisig/Safe governance drills and signer recovery completed
- [ ] Monitoring covers escrow, TVL, remote supply, peers, libraries, DVNs, Executors, authorities, pause/rate limits, and upgrades
- [x] Production policy checker has explicit `PRE_ACTIVATION_INERT` and initial-zero-state `CANARY_ACTIVE` states and rejects mixed state, deployer-held roles, missing/implicit LayerZero controls, wrong Adapter/mint/bytecode/escrow state, and accounting mismatches
- [ ] Tiny mainnet canary amount and loss limit explicitly approved
- [ ] Rollback, pause, retry, incident communications, and emergency governance procedure documented and rehearsed
- [ ] Independent smart-contract/Solana/security review complete
- [ ] Human Phase 5B go/no-go approval recorded

## Testnet-only gate

- [x] Mainnet and testnet identities structurally separated in code
- [x] Testnet policy rejects canonical SAN mint and all mainnet EID/chain identities
- [ ] New legacy SPL `SAN Bridge Test Token` (`tSAN`, 6 decimals) created and inspected on Devnet in an explicitly authorized later phase
- [ ] Solana Devnet and Robinhood Testnet deployment addresses recorded independently
- [ ] Destination execution gas/compute profiled; enforced options reviewed rather than copied from examples
- [ ] Testnet peers, supported default DVN pathway, libraries, Executor, confirmations, and max message size re-resolved immediately before wiring
