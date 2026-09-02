# Phase 5A.3 — Reproducibility and Evidence Hardening Report

Date: 2026-09-03. This was a pre-mainnet, read-only phase. It does not authorize
Phase 5B.

| Required field | Result |
| --- | --- |
| **A. Starting branch/HEAD** | `production/phase5a1` at `09e9b0dbda221a3c148dd0daa492858a2b9258d1`; clean at entry; Node `v22.23.2`. Commits after the bridge target (`5263e4a`, `09e9b0d`) were documentation only. |
| **B. Bridge-code audit target** | `d28762288bb5180ff292f57eef7132191f2037ec`. |
| **C. Hardening branch** | `security/phase5a3-evidence-hardening`. The reviewed working-tree tooling snapshot initially covered 26 changed/untracked files with aggregate file-hash-list SHA-256 `787c135dfd3b22b4198e0ca0fbb2b686cb4d7aab76cc9ade4b6bf2aacd239f46`; this report and final doc corrections are additional documentation changes. |
| **D. Docker status** | **PASS.** Docker Desktop `4.88.1 (237512)`, Engine/client `29.7.2`, `desktop-linux`, server `linux/arm64`, `overlayfs`, `/var/lib/docker`, 8 CPUs, and about 4.1 GB RAM. About 25 GiB was available before the independently completed two-build run. |
| **E. Pinned image/digest** | `solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326`, `linux/amd64`; Anchor 0.31.1; image base Agave 2.1.0; requested build Agave 2.2.20; host Rust/Cargo 1.86.0; base platform-tools 1.43/SBF Rust 1.79.0. |
| **F. Build 1 raw ELF hash** | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543`. |
| **G. Build 2 raw ELF hash** | `b6c6a071143b263579e0d1313a7a9fe88c2a84024d42103c691ee8939d6ce543`. |
| **H. Build 1 executable hash** | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6`. |
| **I. Build 2 executable hash** | `5068a15a15899e96d2b9a2c331573d490f064f2cd84cf88f43314371ed7d33d6`. |
| **J. Reproducibility result** | **PASS.** Both clean digest-pinned builds at exact target `d287622…` were byte-identical and 571,864 bytes. |
| **K. Program-ID embedding result** | **PASS.** Production ID exactly once in each ELF; testnet and starter IDs zero; `pnpm san:check-program-id` passed; tracked key material none. |
| **L. Common-context checker model** | `COMMON_CONTEXT_STRONG`. All custody-critical Solana accounts are decoded from one finalized `getMultipleAccountsInfoAndContext` response with `minContextSlot`, finalized-before/after bounds, exact context-slot blockhash, account hashes, and a repeated complete observation. |
| **M. Common-context slot/block evidence** | The checker emits context slot, finalized-after slot, blockhash, and bound-account list. Tests cover stale context, missing/moved finalized bounds, account integrity, and exact byte decoding. No live production Store/escrow exists, so no production slot/blockhash can yet be recorded. |
| **N. Remaining Solana read consistency gap** | The account batch is one RPC context, but blockhash/finalized-head calls are adjacent calls bounded around it, not one atomic ledger transaction. Robinhood is a separate chain snapshot. The approved manifest may end before the live context; the explicit gap is reported and only paused preactivation or all-zero initial canary states are accepted. |
| **O. In-flight scanner implementation** | `scripts/scanProductionInFlight.ts` plus strict schema/parser in `scripts/inFlightInventory.ts`; both directions supported; no signer or transaction construction. |
| **P. Scanner provenance/completeness model** | Two operationally independent RPCs per chain must canonically agree over explicit complete finalized ranges. Source OFT plus Endpoint packet evidence is reconciled with destination OFT receives; LayerZero Scan is corroboration only. Schema v2 binds scanner commit, bridge target, identities, boundary hashes, ranges, pagination, each GUID, directional totals, and canonical checksum. |
| **Q. Scanner test results** | 15/15 focused scanner/manifest cases passed, including empty, pending, delivered, both directions, duplicate/replay, missing destination, truncation, pagination, API conflict, provider conflict, incomplete range, identity/range mismatch, and inconsistent status evidence. |
| **R. Production checker integration result** | **PASS locally**. The checker accepts only the approved schema-v2 manifest, validates all accounts from the common context, pins EVM reads to one `finalized` block/hash, checks owners/programs/authorities, and now binds Store mint/escrow/PDA before using custody accounts. Live execution remains blocked on undeployed identities and approvals. |
| **S. Supply/in-flight reconciliation result** | Policy/tests pass the exact identity `Store TVL = Robinhood supply + outstanding Solana→Robinhood + outstanding Robinhood→Solana`; escrow must be at least TVL. Live reconciliation is unavailable until deployment and an independently approved manifest exist. |
| **T. Dependency alerts found** | 99 open GitHub alerts: 1 critical, 41 high, 47 moderate, 10 low. Every record, affected/fixed version, manifest/scope, dependency route, deployed reachability, and tooling decision is in `DEPENDENCY_ALERT_TRIAGE.md`. |
| **U. Dependency alerts remediated** | 0. None established a deployed bridge vulnerability. No dependency/lockfile was changed; risky legacy off-chain paths are deferred to a separate dependency branch because blind upgrades could change audited artifacts or transaction tooling. |
| **V. Whether production bytecode changed** | **No**. No contract, Solana program, dependency lockfile, compiler, or build setting changed in this hardening diff. |
| **W. Audit-target drift result** | Only A (docs), B (tests), and C (checker/scanner tooling) changed. No D dependency/toolchain or E production bridge code change. Bridge target `d287622…` remains valid; the tooling diff is a separate review target. |
| **X. Robinhood finality refresh result** | **UNAPPROVED / FAIL-CLOSED**. Current Nitro/Robinhood evidence distinguishes L2 inclusion, L1 posting/finality, and the optimistic challenge horizon. RPC `finalized` is a coherent state anchor but not documented challenge-complete proof. No 32/64/128 value was approved. |
| **Y. LayerZero metadata refresh result** | Official metadata was re-resolved on 2026-09-03. EIDs, Endpoints, send/receive libraries, Executors, and relevant deprecated defaults showed no material drift. No configuration was applied. |
| **Z. DVN availability result** | LayerZero Labs, Nethermind, and Horizen remain listed active for both Solana and Robinhood. Dead DVN remains deprecated; inherited Robinhood defaults remain unacceptable. |
| **AA. Focused fail-closed patch re-audit** | **PASS for target `d287622…`**. Both applications initialize paused; quote/send and intended receive paths are blocked before activation; ordinary Robinhood ERC-20 transfers remain live; pause roles and unauthorized unpause are enforced; states A–F and interrupted batches stay inert; missing limits/configs fail closed; public permissionless behavior begins only after explicit unpause. |
| **AB. CRITICAL findings** | 0 unresolved. |
| **AC. HIGH findings** | 0 unresolved. One HIGH checker regression was found during review (Store asset fields not bound to certified accounts), fixed with canonical mint, approved escrow, and Store-PDA assertions, tested 4/4, and independently bypass-reviewed with no surviving issue. |
| **AD. MEDIUM findings** | 0 unresolved. The two earlier evidence gaps—common-context reads and scanner provenance—are remediated in this tooling diff; live operational evidence remains a blocker, not a code finding. |
| **AE. Forge results** | 17/17 passed; `forge build` passed. |
| **AF. Hardhat results** | 23/23 passed. |
| **AG. Anchor results** | 8/8 passed on the local validator. Existing upstream cfg/deprecation/undefined-syscall build warnings were retained and not hidden. |
| **AH. Script/policy results** | 99/99 passed across 10 suites, including 4/4 Store-binding and 3/3 common-context tests. |
| **AI. TypeScript result** | `pnpm exec tsc --noEmit` passed. |
| **AJ. Lint result** | Passed with 0 errors; 20 pre-existing warnings. Prettier and Solhint completed. |
| **AK. Secret/key-material result** | Gitleaks 8.30.1 scanned 172 tracked/nonignored files with 0 findings. Only placeholder `.env.example` is tracked; program-ID check reported no tracked key material. No key contents were read or printed. Arbitrary-mint ABI check found 0 `mint`, `ownerMint`, `adminMint`, `emergencyMint`, or `roleMint` functions. |
| **AL. Public PR result** | This hardening branch is to remain open for public/external review and must not be merged automatically. Reproducibility passing does not close the remaining human-policy gates. |
| **AM. Reviewer-document update** | Updated activation checker, in-flight evidence, reproducible build, dependency ledger, finality, audit scope, handoff, quickstart, checklist, blockers, metadata, and README material. |
| **AN. Remaining blockers before Phase 5B** | Independent approval of the reproducible hashes; named external audit; human-approved Robinhood finality/DVN confirmation semantics; final independently verified Squads/Safe addresses, members, thresholds, signer independence, recovery and all authorities; live production identities; approved independent RPC providers and scanner manifest; fresh economic limits; successful live read-only checker archives; explicit Phase 5B authorization. |
| **AO. Explicit confirmation ZERO blockchain transactions occurred** | **Confirmed: zero Solana mainnet, zero Robinhood mainnet, zero Solana Devnet, and zero Robinhood Testnet transactions. No wallet signing occurred.** |

## Final change classification

Every path in the completed branch diff is classified below. No production
bridge-code path, dependency version, lockfile, compiler setting, or deployment
script changed.

| Classification | Paths |
| --- | --- |
| Docs | `.env.example`; `README.md`; `docs/AUDITOR_HANDOFF.md`; `docs/AUDIT_SCOPE.md`; `docs/AUDIT_TARGET.md`; `docs/DEPENDENCY_ALERT_TRIAGE.md`; `docs/IN_FLIGHT_EVIDENCE_MODEL.md`; `docs/LAYERZERO_MAINNET_CONFIG.md`; `docs/PHASE_5A1_BLOCKERS.md`; `docs/PHASE_5A3_REPORT.md`; `docs/PRE_DEPLOYMENT_CHECKLIST.md`; `docs/PRODUCTION_ACTIVATION_CHECKER.md`; `docs/PRODUCTION_SECURITY_REVIEW.md`; `docs/PRODUCTION_VERIFIABLE_BUILD.md`; `docs/PUBLIC_REPO_READINESS.md`; `docs/REPRODUCIBLE_BUILD_EVIDENCE.md`; `docs/REVIEWER_CHECKLIST.md`; `docs/REVIEWER_QUICKSTART.md`; `docs/ROBINHOOD_FINALITY_POLICY.md`; `docs/SOLANA_PROGRAM.md`; `docs/examples/production-inflight-inventory.example.json` |
| Tests | `test/scripts/checkProductionMainnet.script.test.ts`; `test/scripts/checkProductionStoreBindings.script.test.ts`; `test/scripts/productionMainnetPolicy.script.test.ts`; `test/scripts/solanaCommonContext.script.test.ts` |
| Checker/scanner tooling | `scripts/checkLayerZeroConfig.ts`; `scripts/checkProductionMainnet.ts`; `scripts/inFlightInventory.ts`; `scripts/productionMainnetPolicy.ts`; `scripts/productionStoreBindings.ts`; `scripts/scanProductionInFlight.ts`; `scripts/solanaCommonContext.ts` |
| Dependency/tooling | `package.json` (one read-only scanner command registration; no dependency or lockfile change) |
| Production bridge code | None |

STOP. Do not proceed to Phase 5B.
