# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities through GitHub Private Vulnerability
Reporting. If that flow is unavailable, contact
[@SanChanSecurity](https://t.me/SanChanSecurity) by Telegram direct message to
establish a private reporting channel. For public coordination only, contact
[@SanChanRun](https://x.com/SanChanRun) on X. Do not send vulnerability details
through X or public Telegram channels or groups. For sensitive details sent
through Telegram, request a Secret Chat first.

Include, where possible:

- affected commit, file, contract/program, chain, and address;
- impact and the security invariant that can be violated;
- prerequisites, a minimal reproduction, and relevant logs or traces;
- whether exploitation may already be occurring; and
- a safe remediation or containment idea, if known.

Do not include private keys, seed phrases, personal data, or live exploitation
against public networks. Potentially exploitable critical vulnerabilities must
be reported privately before public disclosure. Please allow maintainers a
reasonable opportunity to investigate and patch an unpatched critical issue.
There is no promised bounty unless a separate written program explicitly says
otherwise.

High-priority areas include unbacked Robinhood SAN minting, Solana escrow loss,
peer/Endpoint/DVN bypass, replay, decimal/accounting errors, upgrade/admin
compromise, rate-limit bypass, and unsafe deployment or key-handling tooling.
