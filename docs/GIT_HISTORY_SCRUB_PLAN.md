# Git History Scrub Plan

## Scope and safety boundary

This plan covers a local-only Phase 5A.1 rewrite. It authorizes no remote push,
repository publication, credential use, or blockchain transaction. Secret values
must never be printed. The pre-scrub bundle is stored outside the repository at
`../san-layerzero-pre-scrub.bundle`; it is sensitive, local-only recovery material
and must never be uploaded or included in a public distribution.

## Pre-rewrite checkpoint

- Branch: `production/phase5a1`
- Phase 5A HEAD before this task: `9a926f528f6a02d01e87dacd3495197d0a36100e`
- Parent Phase 5A authorization commit: `a5aae4d024d818761cc4bbb40308ba29dbf1cfa0`
- Backup bundle SHA-256:
  `76fa11e56ddddce4177b294ad5c2cc07311f3c1682bfb2334ec1e7a9db1f860f`
- Bundle verification: passed; complete history and all ten refs recorded
- Configured remotes: none
- Tags: none
- Push history conclusion: no configured remote, remote-tracking ref, or reflog
  entry evidences a push. This local evidence cannot prove that no copy was ever
  manually uploaded or that a remote never existed elsewhere.

## Sensitive historical material

No secret value is reproduced here.

| Classification | Path           | Introducing/reachable commit               | Blob                                       | Secret category                                | Safely derived public identity                                   | Known project identity/use                                                                                                                                                                                                                                                                               |
| -------------- | -------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH           | `junk-id.json` | `14611ec983c307bcc651afaf3e554845ad616b56` | `8ccf579ceb1de46f3fbd6292d27989480bc9f3b9` | Structurally valid 64-byte Solana keypair JSON | `JD5ype5b3NTRDddDtoqLXHcJcCoBToxs9ZnsKMkFbguD`                   | Not the production program ID, known Devnet deployer, tSAN program, or another recorded SAN identity. Zero Solana-mainnet balance/token accounts at audit time. The address has Devnet-only balance, token accounts, and activity, so it is a compromised retired test wallet and must never be trusted. |
| HIGH           | `README.md`    | `14611ec983c307bcc651afaf3e554845ad616b56` | `ee250f32c12c33b2f58075ecccb213905ab47977` | Valid 12-word BIP-39 mnemonic assignment       | standard account 0: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Standard public Hardhat test mnemonic/account. It does not derive the known Robinhood Testnet deployer in the first 100 standard EVM accounts. Zero native balance observed on Ethereum mainnet and Robinhood mainnet; Robinhood Testnet contains only dust. Not a recorded SAN deployment identity.     |

Maintained `gitleaks` 8.30.1 scanning of `--all` reported two additional
generic-key matches. Redacted structural inspection classified both as
TEST-ONLY / NON-SENSITIVE false positives: public Solana
`associatedTokenAccount` and `deployerTokenAccount` addresses in testnet
deployment evidence.

No pre-rewrite finding maps to the production program keypair, a production
deployer, either known live testnet deployer, the tSAN program keypair, or a
wallet with observed mainnet native/token assets. The CRITICAL stop condition is
therefore not triggered.

## Known ignored local key safety

The following files were inspected only to derive and compare public identities;
their contents were not printed. They are mode `0600` where required, ignored by
`target/`, and untracked:

- `target/deploy/testnet-solana-deployer.json` →
  `7AdveMTZZX5C5FbhXL6UcxvuBWQdXLGsXVuBF974dTEi`
- `target/deploy/robinhood-testnet-deployer.json` →
  `0x45d06ac243B30758610D55102aa917eb4D6f6fDe`
- `target/deploy/testnet-oft-keypair.json` →
  `EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8`
- `target/deploy/oft-keypair.json` →
  `9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD`

Exact-object comparison found none of these secret keys in any pre-rewrite Git
blob.

## Deterministic rewrite

Use `git-filter-repo` locally and force only because the verified offline bundle
exists and this is the explicitly authorized repository:

1. Remove `junk-id.json` from every local ref.
2. Replace only a quoted 12-word value assigned to `MNEMONIC` with the literal
   invalid placeholder `<REDACTED_TEST_MNEMONIC>` through a blob callback. The
   old mnemonic is never placed in the command line, a replacement file, shell
   history, or output.
3. Rewrite every current ref, including custom local Codex checkpoint refs, so
   `git log --all` cannot retain the sensitive objects through a nonstandard ref.
4. Do not push rewritten refs.

## Required post-rewrite gates

- Record old-to-new branch tip mappings.
- Verify `junk-id.json` is absent from `git log --all` and every tree.
- Verify blobs `8ccf579c…` and `ee250f3…` are unreachable from all refs.
- Verify no valid mnemonic assignment remains.
- Run redacted `gitleaks git --log-opts=--all`; document public-address false
  positives if the testnet evidence remains.
- Run exact local-key fingerprint comparison and prove the production and known
  testnet keys are absent from history.
- Verify the current index tracks no credential/key material and `.gitignore`
  continues to cover `.env`, `target/`, `*-keypair.json`, and generated wallets.
- Verify the production public program ID remains consistent and
  `pnpm san:check-program-id` passes.
