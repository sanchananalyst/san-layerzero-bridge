# Public Repository Readiness

## Status

The repository is not ready to become public. Phase 5A did not rewrite history,
publish the repository, reveal secret values, or access local ignored key
contents.

## Scan coverage

- All 12 commits reachable from the three local branches were enumerated.
- 203 unique Git blob/path pairs were inspected by a value-redacting local scan.
- The scan checked Solana 64-byte JSON keypairs, PEM private keys, private-key
  assignments, mnemonic/seed assignments, Alchemy credential URLs, GitHub
  tokens, and AWS access keys.
- Dedicated scanners `gitleaks`, `trufflehog`, `detect-secrets`, `git-secrets`,
  and `ggshield` are not installed. This is a tooling gap; the custom scan is not
  a substitute for independent scanner coverage.
- No Git remote or tags are currently configured.
- The current index contains no tracked keypair/wallet/PEM/mnemonic file.
- `.env` and `target/` are ignored. Their private contents were not displayed or
  copied and must never be added to a public archive.

## Findings requiring history cleanup

### Historical Solana keypair JSON

- Path: `junk-id.json`
- Reachable commit: `14611ec983c307bcc651afaf3e554845ad616b56`
- Git blob: `8ccf579ceb1de46f3fbd6292d27989480bc9f3b9`
- Blob size: 306 bytes
- Blob SHA-256: `9fa92b676190cde219da1ec7b9cf30998860a21534a85bb02e3d893c45085513`
- Classification: structurally valid 64-byte Solana keypair JSON

The file was deleted by `280c165…`, but deletion does not remove the blob from
history. Treat the key as compromised. Confirm it has no present authority or
funds, retire it permanently, and remove the blob from every published ref.

### Historical 12-word mnemonic assignment

- Path: `README.md`, line 134 in the initial commit
- Reachable commit: `14611ec983c307bcc651afaf3e554845ad616b56`
- Git blob: `ee250f32c12c33b2f58075ecccb213905ab47977`
- Blob size: 22,467 bytes
- Blob SHA-256: `1936b86fd4f7ade58d3e2500ab36bf99c3fc37d4f9a2d9ed8ae92c3f0abf8be6`
- Classification: a non-placeholder 12-word value assigned to `MNEMONIC`

The value was not printed during this audit. Treat it as compromised, determine
every derived account without exposing it in review artifacts, retire/rotate any
use, and replace it throughout history before publication.

## Required cleanup before publication

1. Confirm both historical credentials are test-only and have no funds,
   authorities, deployment roles, API access, or reused derivations. Rotate or
   retire them regardless.
2. Create an offline backup and record all refs before rewriting.
3. Use `git filter-repo` or an equivalent reviewed tool to remove
   `junk-id.json` from every ref and replace the historical mnemonic with an
   obvious placeholder. Keep replacement material outside the repository and do
   not put the old value in shell history.
4. Re-run at least two independent maintained scanners across the rewritten
   working tree and full history.
5. Verify the two identified blob IDs and all secret-pattern matches are absent
   from every branch and tag.
6. Review `.env.example`, CI configuration, package-manager settings, deployment
   records, logs, and documentation for RPC/API credentials and internal URLs.
7. Purge old CI artifacts, release archives, caches, mirrors, forks, and backups
   intended for publication. Coordinate force-push and clone invalidation.
8. Add automated secret scanning and protected-branch checks before creating a
   remote.
9. Obtain human approval of licensing, LayerZero source-license obligations,
   security contact, disclosure policy, and public documentation.

History rewriting is intentionally deferred to a separately approved task.
