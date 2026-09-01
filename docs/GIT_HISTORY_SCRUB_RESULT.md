# Git History Scrub Result

## Result

The local repository history was deterministically rewritten across every local
ref. No remote was configured and nothing was pushed. A verified, sensitive,
local-only recovery bundle exists at `../san-layerzero-pre-scrub.bundle`; its
SHA-256 is
`76fa11e56ddddce4177b294ad5c2cc07311f3c1682bfb2334ec1e7a9db1f860f`.
It must never be uploaded or included in a public distribution.

Pre-scrub findings, without secret values:

| Path           | Historical blob                            | Category                        | Derived public identity                                | Classification/use                                                                        |
| -------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `junk-id.json` | `8ccf579ceb1de46f3fbd6292d27989480bc9f3b9` | valid Solana keypair JSON       | `JD5ype5b3NTRDddDtoqLXHcJcCoBToxs9ZnsKMkFbguD`         | HIGH; compromised retired Devnet-capable starter wallet; no known SAN production identity |
| `README.md`    | `ee250f32c12c33b2f58075ecccb213905ab47977` | valid standard Hardhat mnemonic | account 0 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | HIGH; public test mnemonic; no known SAN deployment identity                              |

No finding matched the production program identity, a production deployer, or a
known live SAN deployment key. That permitted the authorized local rewrite.

## Rewrite and verification

`git filter-repo --force` removed `junk-id.json` from all history and replaced
the mnemonic assignment with a placeholder. Reflogs were expired and
unreachable objects pruned. The known sensitive blobs are no longer present,
`git fsck` is clean, the current index contains no key material, and the
production keypair remains ignored under `target/deploy/`.

| Ref                                | Old tip    | New tip                                    |
| ---------------------------------- | ---------- | ------------------------------------------ |
| `main`                             | `280c165…` | `f5d7782e45d0657678a4fb48697c10fc80d8b7e4` |
| `production/phase5a`               | `9a926f5…` | `b6a7198e97a6a1e3319c31889a563657c4fb91cb` |
| `production/phase5a1` pre-work tip | `e4bcd14…` | `0962a9d2a2d30a21ff38e84d9357b961eec64242` |
| `testnet/phase4a`                  | `759e57c…` | `ae80aac0270fd1c4d016f1a8e07e25878c70cf8e` |

Gitleaks 8.30.1 post-scrub reported only two reviewed public-address false
positives (`associatedTokenAccount` and `deployerTokenAccount`). The known
Devnet deployer, Robinhood testnet deployer, tSAN program, and production OFT
private material are absent from rewritten history. Because no remote or tags
exist, prior publication cannot be proven or disproven from local metadata;
external archives must be checked before publication.
