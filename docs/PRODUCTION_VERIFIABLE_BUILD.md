# Production Verifiable Solana Build

> **Superseded by Phase 5A.2:** the local hashes below were produced before the
> Store default changed to `paused = true`. They must not be used as approved
> deployment hashes. The next authorized reproducible-build phase must produce
> and independently reproduce the patched ELF/executable hashes.

## Status

The local pinned build succeeds, but a Docker/verifiable and independently
reproduced build is **blocked**. Docker client 29.7.2 is installed; `docker
version` cannot reach the daemon at
`unix://USER_HOME/.docker/run/docker.sock`, so no server version, image name,
or image digest can honestly be recorded.

Human remediation: start Docker Desktop on this workstation, wait until
`docker version` reports both Client and Server/Engine, then rerun the pinned
official Anchor/LayerZero verifiable build from a clean temporary checkout using
the same digest-pinned image. Do not install or reconfigure privileged software
silently. Repeat in a second clean checkout and require identical hashes.

## Current local artifact evidence

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

These hashes identify the successful local artifact only. They are not labeled
verifiable or reproducible until the Docker gate and second-build comparison
close. No deploy or on-chain verification instruction was called.
