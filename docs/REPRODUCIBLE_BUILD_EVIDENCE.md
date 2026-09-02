# Reproducible Solana Build Evidence

## Result

**REPRODUCIBILITY GATE = PASS**

On 2026-09-03, two independent clean temporary clones of the scrubbed public
repository were checked out detached at exactly the immutable production
bridge-code audit target:

```text
d28762288bb5180ff292f57eef7132191f2037ec
```

The builds did not reuse either checkout's working directory, `target/`, ELF,
or generated artifacts. Both used the same immutable official Anchor image:

```text
solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326
```

## Exact command

```bash
anchor build --verifiable --program-name oft \
  --solana-version 2.2.20 \
  --docker-image solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326 \
  --env OFT_ID=9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD
```

## Toolchain

| Tool                                           | Version                                 |
| ---------------------------------------------- | --------------------------------------- |
| Anchor                                         | `0.31.1`                                |
| Requested Agave/Solana CLI                     | `2.2.20` (`src:dabc99a5`, client Agave) |
| `solana-cargo-build-sbf`                       | `2.2.20`                                |
| SBF platform-tools                             | `1.48`                                  |
| Repository Rust pin                            | `1.84.1`                                |
| Image host Rust/Cargo                          | `1.86.0` / `1.86.0`                     |
| `solana-verify` used for local hash inspection | `0.5.1`                                 |

Docker Desktop was `4.88.1 (237512)` with client/Engine `29.7.2`, context
`desktop-linux`, and server architecture `linux/arm64`. The pinned image is
`linux/amd64` and ran under Docker Desktop emulation. About 25 GiB was available
before the two-build run.

## Artifact comparison

| Evidence                          | Build 1                                                            | Build 2                                                            |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Git HEAD                          | `d28762288bb5180ff292f57eef7132191f2037ec`                         | `d28762288bb5180ff292f57eef7132191f2037ec`                         |
| Raw ELF SHA-256                   | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` |
| Solana executable hash            | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6` | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6` |
| ELF size                          | `571864` bytes                                                     | `571864` bytes                                                     |
| Production program-ID occurrences | `1`                                                                | `1`                                                                |
| Testnet program-ID occurrences    | `0`                                                                | `0`                                                                |
| Starter program-ID occurrences    | `0`                                                                | `0`                                                                |

The two ELF files were also byte-compared directly and were identical.

## Identity and key-material checks

The production program ID
`9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD` occurs exactly once in each
ELF. The testnet ID `EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8` and
the original starter ID `9UovNrJD8pQyBLheeHNayuG1wJSEAoxkmM14vw5gcsTT` occur
zero times in each ELF.

`pnpm san:check-program-id` confirmed the production identity in `Anchor.toml`,
the source `declare_id!`, the generated IDL, and the verifiable ELF. It also
confirmed that no key material is tracked.

## Superseded host artifact

The earlier host/local artifact is retained as historical evidence but is
superseded for deployment purposes:

| Evidence        | Superseded host artifact                                           | Reproducible container artifact                                    |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Raw ELF SHA-256 | `1bb1093d63402e680d5d52fb3cb7cff44a0ada7b9e5835e35d44eca07b79a395` | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543` |
| Executable hash | `955f6b81689a285cd7fe9875d7575347d9766149698b306f3b74e00e0f4bdf45` | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6` |
| ELF size        | `571888` bytes                                                     | `571864` bytes                                                     |

Host/container equality was not the reproducibility gate. The two independent
digest-pinned clean container builds are the gate.

## Safety statement

This was a build-and-inspection exercise only. It submitted zero blockchain
transactions, made zero blockchain RPC calls, created no production account,
used no wallet or production key material, and produced zero wallet signatures.
