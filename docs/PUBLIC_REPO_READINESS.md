# Public Repository Readiness

## Phase 5A.2 status

A recreated, scrubbed GitHub repository now exists at
<https://github.com/sanchananalyst/san-layerzero-bridge> and has been verified
through authenticated and anonymous checks. It is **PUBLIC**. The superseded
report-bearing commit and report path are unavailable in the recreated
repository. The responsible-disclosure contact is
[@SanChanSecurity](https://t.me/SanChanSecurity), with
[@SanChanRun](https://x.com/SanChanRun) on X for public coordination and GitHub
Private Vulnerability Reporting enabled as the primary intake path. Private
phase reports are excluded from every branch and tag and retained only as
ignored local files.

## Phase 5A.1 baseline

The rewritten local repository is materially safer but **must not be made
public in Phase 5A.1**. No remote is configured, nothing was pushed, and prior
publication cannot be established from local metadata alone.

Completed controls:

- a verified local-only pre-scrub bundle exists and is excluded from public
  distribution;
- historical Solana keypair material was removed and the historical mnemonic
  replaced across all refs;
- reflogs/unreachable objects were pruned and `git fsck` is clean;
- Gitleaks reports no findings in the public branch history; the complete local
  branch set has only two documented public-address false positives;
- current tracked files contain no keypair/private-key material;
- `.env`, generated keypairs, `target/`, and operator material are ignored;
- GitHub secret scanning, push protection, dependency vulnerability alerts,
  private vulnerability reporting, and default-branch protection are enabled;
  and
- canonical identity, source, architecture, tests, security/rate/governance
  models, future runbooks, vulnerability policy, and auditor scope are present.

## Post-publication and pre-mainnet follow-ups

1. independently confirm both historical credentials are retired and check any
   prior mirrors, archives, CI artifacts, forks, or clones;
2. obtain legal/license and LayerZero dependency/source-obligation review; and
3. independently approve the reproducible Solana hashes and close Robinhood
   finality, governance, current LayerZero configuration, and independent
   security-audit blockers before any Phase 5B authorization.

Future deployment records may publish verified addresses and transaction/GUID
evidence only after those events occur. This repository does not invent them.
