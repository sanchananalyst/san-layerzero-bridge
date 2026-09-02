# Production Verifiable Solana Build

> **Phase 5A.3 reproducibility gate: PASS.** The two clean Docker builds below
> cover the post-Phase 5A.2 initialize-paused bridge target. The older host
> artifact is retained for history but is superseded for deployment purposes.

## Phase 5A.3 Docker health gate (2026-09-03)

The initial gate stopped with an unavailable daemon and about 350 MiB free. A
human freed disk space and explicitly asked for a retry. Docker Desktop was then
started successfully: Desktop `4.88.1`, client/Engine `29.7.2`, client
`darwin/arm64`, server `linux/arm64` (`aarch64`), context `desktop-linux`,
`overlayfs`, root `/var/lib/docker`, 8 CPUs, about 4.1 GB RAM, and 15 GiB host
space free. Earlier attempts stopped safely when storage was insufficient. The
authorized reproducibility run began with about 25 GiB available and completed
without a Docker storage failure.

## Pinned environment

The installed Anchor `0.31.1` CLI and repository documentation select the
official `solanafoundation/anchor:v0.31.1` verifiable-build image. The registry
resolved it to the single-platform `linux/amd64` manifest digest below; the arm
host uses Docker emulation. The floating tag is never used as the build input.

| Field                         | Pinned value                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Bridge source target          | `d28762288bb5180ff292f57eef7132191f2037ec`                                                        |
| Image                         | `solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326` |
| Image platform                | `linux/amd64`                                                                                     |
| Anchor                        | `0.31.1`                                                                                          |
| Requested Agave/Solana        | `2.2.20` (`anchor build --solana-version 2.2.20`)                                                 |
| Selected `cargo-build-sbf`    | `2.2.20`                                                                                          |
| Selected SBF platform-tools   | `1.48`                                                                                            |
| Image base Agave/Solana       | `2.1.0`                                                                                           |
| Image host Rust/Cargo         | `1.86.0` / `1.86.0`                                                                               |
| Image base SBF platform-tools | `1.43` (SBF Rust `1.79.0`)                                                                        |
| Repository Rust pin           | `1.84.1`                                                                                          |
| Build command                 | shown below                                                                                       |

```bash
anchor build --verifiable --program-name oft \
  --solana-version 2.2.20 \
  --docker-image solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326 \
  --env OFT_ID=9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD
```

The build selected `solana-cargo-build-sbf 2.2.20` and platform-tools `1.48`.
Both clean checkouts independently initialized the requested toolchain and
built the exact bridge-code audit target.

## Reproducibility result

Two independent clean temporary clones were checked out detached at exactly
`d28762288bb5180ff292f57eef7132191f2037ec`. Neither reused the other's working
directory, `target/`, compiled ELF, or generated artifacts. Only the immutable
digest-pinned Docker image layers were shared.

| Evidence                          | Build 1                                                            | Build 2                                                            |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Raw ELF SHA-256                   | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` |
| Solana executable hash            | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6` | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6` |
| ELF size                          | `571864` bytes                                                     | `571864` bytes                                                     |
| Production program-ID occurrences | `1`                                                                | `1`                                                                |
| Testnet program-ID occurrences    | `0`                                                                | `0`                                                                |
| Starter program-ID occurrences    | `0`                                                                | `0`                                                                |

`pnpm san:check-program-id` passed against the verifiable artifact. The
production identity is
`9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`; the testnet identity
`EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8` and original starter identity
`9UovNrJD8pQyBLheeHNayuG1wJSEAoxkmM14vw5gcsTT` occur zero times. No tracked key
material was found.

**REPRODUCIBILITY GATE = PASS.** No deploy, on-chain verification, blockchain
RPC, transaction, or wallet-signing command was used.

## Superseded local artifact evidence

| Field                                  | Value                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| Program ID                             | `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`                     |
| Anchor                                 | `0.31.1`                                                           |
| Agave/Solana CLI and `cargo-build-sbf` | `2.2.20`                                                           |
| Rust/Cargo                             | `1.84.1`                                                           |
| platform-tools                         | `1.48`                                                             |
| Local command                          | `pnpm compile` / pinned `anchor build` flow                        |
| Raw ELF SHA-256                        | `1bb1093d63402e680d5d52fb3cb7cff44a0ada7b9e5835e35d44eca07b79a395` |
| `solana-verify get-executable-hash`    | `955f6b81689a285cd7fe9875d7575347d9766149698b306f3b74e00e0f4bdf45` |
| ELF size                               | `571888` bytes                                                     |
| Production program-ID occurrences      | `1`                                                                |
| Starter/test program-ID occurrences    | `0`                                                                |

These pre-patch hashes identify an old host-built artifact only. They remain as
historical evidence but are superseded and forbidden as deployment approval
evidence. They are not expected to match the digest-pinned container output.
