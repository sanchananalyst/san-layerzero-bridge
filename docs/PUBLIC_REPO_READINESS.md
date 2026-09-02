# Public Repository Readiness

## Phase 5A.2 status

A scrubbed GitHub copy now exists at
<https://github.com/sanchananalyst/san-layerzero-bridge> and has been verified
through an authenticated fresh clone. It remains **PRIVATE**. The responsible-
disclosure contact placeholder is unresolved, so the fail-closed publication
gate prohibits switching the repository to public visibility. See
`docs/PHASE_5A2_PUBLICATION_REPORT.md`.

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
- Gitleaks 8.30.1 full-history scan has only two documented public-address false
  positives;
- current tracked files contain no keypair/private-key material;
- `.env`, generated keypairs, `target/`, and operator material are ignored; and
- canonical identity, source, architecture, tests, security/rate/governance
  models, future runbooks, vulnerability policy, and auditor scope are present.

Remaining publication gates:

1. replace the responsible-disclosure contact placeholder in `SECURITY.md`;
2. independently confirm both historical credentials are retired and check any
   prior mirrors, archives, CI artifacts, forks, or clones;
3. add repository-host secret scanning and protected-branch rules;
4. obtain legal/license and LayerZero dependency/source-obligation review;
5. close Docker reproducibility and independent security audit blockers;
6. review the exact public archive to exclude the sensitive local bundle,
   `.env`, ignored keys, logs, caches, and deployment workspaces; and
7. separately authorize creation/push of a public remote.

Future deployment records may publish verified addresses and transaction/GUID
evidence only after those events occur. This repository does not invent them.
