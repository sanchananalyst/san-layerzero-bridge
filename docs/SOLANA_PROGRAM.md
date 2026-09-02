# SAN Solana OFT Program

## Phase 3 identity

The public identity reserved for SAN's own copy of LayerZero's OFT Solana program is:

```text
9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD
```

It was generated locally with the official Anchor workflow:

```bash
anchor keys sync -p oft
```

That command generated local keypair files and synchronized the public identity in `Anchor.toml`. It did not contact a chain, submit a transaction, or deploy a program. The keypair contents were never displayed. `target/` and `*-keypair.json` are gitignored, and `git ls-files '*-keypair.json' 'target/deploy/*'` returned no tracked file.

Phase 3.5 pins the approved identity directly in `declare_id!`. This prevents a build-time environment override from silently producing a different program and lets Anchor emit the exact ID into the generated IDL. The build command still supplies `OFT_ID` for compatibility with the starter tooling:

```bash
OFT_ID=9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD anchor build
```

Current LayerZero documentation and the starter's Docker-based verifiable build pass the variable with Anchor's `-e` option:

```bash
anchor build -v -e OFT_ID=9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD
```

`-e` is a Docker environment option and must not be mistaken for setting the environment of a non-verifiable local build.

After building, `pnpm san:check-program-id` verifies `Anchor.toml`, literal source declaration, generated IDL, embedded ELF public-key bytes, and the absence of tracked key material. The Phase 3.5 host build had SHA-256 `1bb1093d63402e680d5d52fb3cb7cff44a0ada7b9e5835e35d44eca07b79a395`. The current local build, made with Anchor `0.31.1` and a locally installed Agave `2.1.0` toolchain, has SHA-256 `4f45291eb36debe54675fbe5427a86ecfad09ab0f6e08118802662af84091b15`. The differing host toolchains mean these raw artifacts are not expected to establish reproducibility by themselves.

`solana-verify 0.5.1 get-executable-hash target/deploy/oft.so` reports the current local executable hash `531b13c26c54f372a412b5b9c06a2d162c81a7a0a7488eefc32b4a0788de01af`. This is the Solana executable hash, not the ELF file's raw SHA-256.

## Phase 3.6 Docker build result

Docker Desktop reported client/engine `29.7.2` and Server `4.88.1`. Anchor CLI `0.31.1` was installed and the exact command above was attempted twice. The pinned official image `solanafoundation/anchor:v0.31.1` was resolved with digest `sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326`.

No verifiable ELF was produced. The first attempt failed while Docker committed a downloaded layer (`input/output error`). After freeing recoverable cache space and retrying, the image downloaded, but Docker's internal filesystem became read-only while Rustup initialized in the container; Docker could not clean up the container. Restarting Docker Desktop left its VM API unreachable (`no route to host`). These are Docker storage/VM failures before OFT compilation, not Rust or SAN source failures.

Before the attempts, Docker reported zero images, containers, volumes, and build cache. The failed pull then expanded Docker's sparse disk to fill the host. After Docker was stopped, that exact task-created empty-state disk (`Docker.raw`) was removed to recover the space; no pre-existing Docker artifact existed in it. This resets local Docker Desktop state and is recoverable by letting Docker initialize a new disk and re-pulling images. Docker is currently stopped, so a healthy-host retry remains required.

Therefore `target/verifiable/oft.so`, its SHA-256, and a local-vs-Docker byte comparison remain blocked. Local `solana-verify` analysis succeeded for the non-Docker ELF, but that artifact must not be described as verifiable. On an independently healthy Docker host, rerun the exact pinned command and then:

```bash
shasum -a 256 target/verifiable/oft.so
solana-verify get-executable-hash target/verifiable/oft.so
pnpm san:check-program-id
```

Byte equality with the local artifact is not assumed: the local and verifiable workflows use different host/container toolchain environments. Record both hashes and investigate any difference; only the Docker output is the candidate reproducible artifact.

This ID is only a local deployment identity until the program is deployed in an explicitly approved later phase. Do not treat its presence in configuration as evidence of an on-chain program.

## Why SAN has its own program

The repository builds LayerZero's official `oft-solana` program source pinned by
this workspace with one documented SAN activation-boundary change: a new OFT
Store initializes with `paused = true` instead of `false`. Account layout,
instruction arguments, Adapter custody, debit/credit, Endpoint/peer
authentication, and rate-limit logic remain unchanged. The exact delta and its
compatibility impact are recorded in `PARTIAL_CONFIGURATION_SECURITY.md` and
must be included in independent source and reproducible-bytecode review. SAN
does not select a shared third-party OFT program. Its own program identity gives
the SAN governance process control over upgrade policy, bytecode verification,
and emergency response while retaining LayerZero's standard Adapter behavior.

The program supports both native mint/burn OFTs and existing-token adapters. SAN must initialize only `OFTType::Adapter`. In that mode it:

- transfers holder-authorized canonical SAN into escrow on outbound sends;
- tracks backed principal in the OFT Store;
- authenticates and clears LayerZero messages on inbound receives; and
- signs as the OFT Store PDA to release existing SAN from escrow.

It does not receive or change the canonical SAN mint authority.

## Program ID versus OFT Store

The **program ID** identifies executable Solana bytecode. It is common to every account and instruction handled by this deployed SAN OFT program.

The **OFT Store** is a state PDA created later for one token/escrow pair. It is derived under the program ID from `['OFT', escrow public key]`. It stores the canonical mint, escrow address, Adapter type, decimal conversion rate, accounted TVL, admin, fees, and pause roles. The OFT Store is also the SPL token authority over its escrow.

Neither the OFT Store nor escrow exists in Phase 3.

## Upgrade authority

On a normal Solana program deployment, the deployment signer is initially the program's upgrade authority unless a different authority is supplied. Upgrade authority is equivalent to custody authority here: upgraded bytecode could ignore the peer/Endpoint checks or transfer escrowed SAN. It is therefore security-critical even though it is not the SAN mint authority.

Before public bridging, the intended upgrade authority is the approved **Solana SAN multisig vault PDA**, not an individual deployer. The exact bytecode hash, loader state, multisig address, quorum, signer set, timelock/emergency policy, and authority handoff must be independently reviewed. See [`AUTHORITY_HANDOFF.md`](./AUTHORITY_HANDOFF.md).

## Key handling gate

- Never commit, print, paste, or place a generated program keypair in an environment file.
- `target/deploy/oft-keypair.json` and `target/deploy/endpoint-keypair.json` are local only.
- The tracked starter `junk-id.json` wallet was removed in Phase 3.5.
- Human operators must decide the approved custody/backup procedure before any deployment authorization.
