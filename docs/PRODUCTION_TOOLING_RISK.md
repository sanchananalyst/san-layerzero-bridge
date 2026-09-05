# Production Tooling and Signing Risk

## Decision and alert snapshot

Do not mass-upgrade dependencies before Phase 5B. The 2026-09-03 triage recorded
99 open Dependabot alerts in `docs/DEPENDENCY_ALERT_TRIAGE.md`. A read-only
refresh on 2026-09-06 found 101 open alerts: **1 critical, 42 high, 48 moderate,
and 10 low**; 99 are NPM and two are Rust. The two new records are:

- HIGH `toml` (`GHSA-v5mp-jgw5-2x6j`), reachable through Anchor/LayerZero build
  tooling and relevant when parsing hostile TOML; and
- MODERATE `stream-json` (`GHSA-528h-pc64-c93x`), reachable through
  `@solana/web3.js`/`jayson` and relevant to resource-exhaustion from deeply
  nested or oversized untrusted RPC JSON.

No dependency was changed. Updating transitive dependencies without rebuilding
and re-auditing could change compiled artifacts or transaction encoding and is
not a safe signing-day response.

## Risk categories

| Category                                    | Relevant alerts/packages                                                                                           | Production-signing exposure                                                                                                                                              | Required treatment                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network/RPC/API input                       | `axios`, `undici`, `request`, `qs`, `tough-cookie`, `stream-json`, `ws`, `web3-core-subscriptions`                 | SSRF/proxy/config confusion, malformed-response denial of service, prototype/object issues, or resource exhaustion while resolving chain state and building proposals    | Only preapproved HTTPS RPC/API endpoints; separate provider operators; outbound allowlist; response-size/time limits where supported; no URL from user content; fail closed on disagreement/error   |
| Configuration/deserialization               | `toml`, `js-yaml`, `lodash`, `serialize-javascript`, `yargs-parser`, `decode-uri-component`                        | Hostile repository/config/CLI data may trigger prototype pollution, denial of service, or code/template behavior in build/deployment tools                               | Use only reviewed, commit-pinned repository configuration; no downloaded or pasted TOML/YAML/JSON/CLI fragments; validate manifests and hashes before use                                           |
| Archive/filesystem/build                    | `tar`, `adm-zip`, `tmp`                                                                                            | Crafted archives or temporary-path behavior can overwrite/read unexpected files or corrupt an artifact/signing workspace                                                 | Never extract untrusted archives; use a clean disposable build host with least filesystem privilege; obtain toolchains from digest-pinned official sources; destroy workspace after evidence export |
| Crypto/buffer helpers                       | `bigint-buffer`, `elliptic`, Rust `keccak`/`rand`, `uuid`                                                          | Malformed buffer handling, legacy cryptographic implementation, or incorrect assumptions in off-chain transaction/governance tooling                                     | Hardware wallet or native multisig approval is the signing boundary; do not expose key material to Node/Rust helper processes; use reviewed encodings and independent decode/read-back              |
| Legacy Safe/web3/Swarm path                 | `form-data` (critical/high), `request`, legacy `web3` transitive packages                                          | Multipart boundary weakness, SSRF, HTTP state, and obsolete transport behavior are relevant if legacy tooling handles network/config input during governance preparation | Do not use the vulnerable legacy path to create, sign, upload, or relay a production proposal; build the Safe proposal with a separately reviewed pinned path or direct verified calldata           |
| Test/dev-only or non-selected source copies | vulnerable old OpenZeppelin copies, `cookie`, `serialize-javascript`, `yargs-parser`, some `ws`/Hardhat test paths | No deployed SAN runtime reachability in the reviewed artifact; risks remain to developer host availability/integrity                                                     | Exclude test runners and nonessential services from the signing environment; do not treat “dev-only” as safe for a host containing keys                                                             |

The vulnerable transitive OpenZeppelin 3.x/4.x copies are tooling or
library-source paths; production `SanOFT` resolves OpenZeppelin 5.6.1 and is
non-proxy. The two Rust advisories are present in the Solana dependency graph,
but the reviewed SBF program does not invoke the vulnerable functions/features.
These reachability conclusions do not make the signing workstation safe for
untrusted input.

## Phase 5B isolation requirements

The production preparation and signing environment must satisfy all of the
following:

1. **Pinned toolchain:** exact lockfiles, package-manager version, compiler
   versions, Docker image digests, Solana/Anchor tooling, Safe/Squads tooling,
   and transaction-building source commit are recorded and immutable for the
   ceremony.
2. **Reproducible build:** at least two clean builds produce byte-identical
   artifacts and approved hashes. The deployed/runtime/ProgramData read-back
   must equal the approved artifact evidence.
3. **Trusted RPC:** only allowlisted, independently operated providers are used.
   TLS, chain ID/genesis hash, finalized anchors, blockhashes, and response
   agreement are verified. Public default endpoints are not a signing-day
   fallback.
4. **No untrusted config or archive input:** all configuration is
   repository-owned, reviewed, checksum-pinned, and supplied before isolation.
   No email/chat attachment, downloaded archive, pasted TOML/YAML, third-party
   proposal JSON, browser extension, or remote script is opened.
5. **Isolated signing:** signing devices never expose seeds/private keys to the
   build host. The host has no email, chat, general browser, clipboard manager,
   CI token, developer SSH key, or unrelated wallet. Network egress is limited
   to approved RPC/multisig endpoints only when required.
6. **Separation of duties:** proposal construction, independent decoding,
   signer approval, execution, monitoring, and finalized read-back are assigned
   to different people/devices where practical.
7. **Artifact-only transfer:** move only checksummed, human-readable ceremony
   manifests and approved proposal encodings through a controlled medium. Scan
   and compare hashes on both sides; never move key material.
8. **Fail closed:** a dependency alert change, lockfile drift, unexpected
   network request, parser error, provider disagreement, or artifact mismatch
   cancels the ceremony. Do not install an ad hoc fix on the signing host.

## Follow-up

Handle alerts in a separate non-production maintenance branch. Prefer removing
legacy request/web3/Swarm/Safe paths at their direct parents, then update
network/config/archive parsers deliberately. Rebuild twice and re-audit any
change that affects Solidity compilation, Cargo dependencies, Solana ELF,
runtime bytecode, ABI/IDL, proposal construction, or transaction encoding.
